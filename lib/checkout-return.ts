const RECEIPT_ID = /^rcpt_[0-9a-f]{24}$/;
const CHANNEL = "countersign-checkout";

type ReceiptStatus = {
  mandate_id: string; status: string; paypal_order_id: string | null;
  cart: { total: string }; constraints: { currency: string };
};
export type PaidReceipt = { mandate_id: string; total: string; currency: string; paypal_order_id: string };
type ReadReceipt = (id: string) => Promise<ReceiptStatus>;
type CheckoutWindow = {
  BroadcastChannel?: typeof BroadcastChannel;
  setTimeout: Window["setTimeout"]; clearTimeout: Window["clearTimeout"];
  close(): void; focus(): void; location: Pick<Location, "replace">;
};

function openChannel(browser: CheckoutWindow) {
  try { return browser.BroadcastChannel ? new browser.BroadcastChannel(CHANNEL) : null; }
  catch { return null; } // Restricted storage still has the same-tab return path.
}

export async function readPaidReceipt(id: string, read: ReadReceipt): Promise<PaidReceipt | null> {
  if (!RECEIPT_ID.test(id)) return null;
  const receipt = await read(id);
  if (receipt.mandate_id !== id || receipt.status !== "CAPTURED" || !receipt.paypal_order_id) return null;
  return { mandate_id: id, total: receipt.cart.total, currency: receipt.constraints.currency,
    paypal_order_id: receipt.paypal_order_id };
}

export function watchCheckout(id: string | undefined, read: ReadReceipt, onPaid: (receipt: PaidReceipt) => void,
  browser: CheckoutWindow = window) {
  const channel = openChannel(browser);
  let disposed = false;
  let notified = false;
  if (channel) channel.onmessage = async ({ data }) => {
    if (!id || data?.type !== "paid" || data.mandate_id !== id) return;
    try {
      // Cross-tab messages are hints, never proof of payment.
      const receipt = await readPaidReceipt(id, read);
      if (disposed || !receipt) return;
      if (!notified) { notified = true; onPaid(receipt); }
      channel.postMessage({ type: "paid-received", mandate_id: id });
      browser.focus();
    } catch { /* No acknowledgement: checkout falls back to a verified paid view. */ }
  };
  return () => { disposed = true; channel?.close(); };
}

export function finishCheckout(id: string, browser: CheckoutWindow = window) {
  if (!RECEIPT_ID.test(id)) throw new Error("Invalid receipt ID");
  const destination = `/shop?paid=${id}`;
  const channel = openChannel(browser);
  const timers = new Set<number>();
  const later = (callback: () => void, delay: number) => {
    const timer = browser.setTimeout(callback, delay);
    timers.add(timer);
    return timer;
  };
  const fallback = later(() => browser.location.replace(destination), 2500);
  let received = false;
  if (channel) {
    channel.onmessage = ({ data }) => {
      if (received || data?.type !== "paid-received" || data.mandate_id !== id) return;
      received = true;
      browser.clearTimeout(fallback);
      later(() => {
        try { browser.close(); }
        finally { later(() => browser.location.replace(destination), 200); }
      }, 1200);
    };
    channel.postMessage({ type: "paid", mandate_id: id });
  }
  return () => { for (const timer of timers) browser.clearTimeout(timer); channel?.close(); };
}
