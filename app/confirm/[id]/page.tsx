"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { API_BASE, api, ApiError, Mandate, money } from "@/lib/api";
import { finishCheckout } from "@/lib/checkout-return";

type Phase = "loading" | "review" | "pay" | "capturing" | "paid" | "error";

// IDs from the URL are validated before they go into an API path (no path traversal, no surprise endpoints).
const MANDATE_ID = /^rcpt_[0-9a-f]{24}$/;
const PAYPAL_ORDER_ID = /^[A-Z0-9]{8,30}$/;

function ConfirmFlow() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const rawToken = search.get("token"); // PayPal sends the buyer back with ?token=<orderId>
  const returnedOrder = rawToken && PAYPAL_ORDER_ID.test(rawToken) ? rawToken : null;
  const cancelled = search.get("cancelled") === "1";
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const captureStarted = useRef(false);

  const load = useCallback(async () => {
    if (!MANDATE_ID.test(id)) {
      setError("This confirmation link is not valid.");
      setPhase("error");
      return;
    }
    try {
      const m = await api<Mandate>(`/api/mandates/${encodeURIComponent(id)}`, { auth: false });
      setMandate(m);
      setApproveUrl(m.approve_url);
      if (m.status === "CAPTURED") setPhase("paid");
      else if (m.status === "ORDERED") setPhase("pay");
      else if (m.status === "PENDING_CONFIRMATION") setPhase("review");
      else {
        setError(`This purchase is ${m.status.toLowerCase()}.`);
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "We could not find this purchase." : "Could not load this purchase.");
      setPhase("error");
    }
  }, [id]);

  useEffect(() => {
    if (returnedOrder && !cancelled) {
      if (captureStarted.current) return;
      captureStarted.current = true;
      setPhase("capturing");
      api<{ status: string; capture_id: string }>(`/api/orders/${encodeURIComponent(returnedOrder)}/capture`, { method: "POST", auth: false })
        .then((out) => {
          setCaptureId(out.capture_id);
          return load();
        })
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : "PayPal could not complete the payment.");
          setPhase("error");
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the request resolves
      load();
    }
  }, [returnedOrder, cancelled, load]);

  useEffect(() => {
    if (phase === "paid" && mandate?.status === "CAPTURED") return finishCheckout(id);
  }, [phase, mandate?.status, id]);

  async function confirm() {
    setError("");
    try {
      const out = await api<{ paypal_order_id: string; approve_url: string }>(`/api/mandates/${encodeURIComponent(id)}/confirm`, {
        method: "POST",
        auth: false,
        json: { method: "hosted_page_click" },
      });
      setApproveUrl(out.approve_url);
      setPhase("pay");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not confirm. Please try again.");
    }
  }

  if (phase === "loading" || phase === "capturing") {
    return <p className="text-muted">{phase === "capturing" ? "Completing your payment with PayPal…" : "Loading…"}</p>;
  }
  if (phase === "error" && !mandate) return <p className="text-danger">{error}</p>;
  if (!mandate) return null;

  const c = mandate.constraints;
  const attrs = Object.entries(c.attributes ?? {});
  if (phase === "paid") return <section className="checkout-paid"><span className="checkout-check" aria-hidden="true">✓</span><p className="eyebrow">Payment received</p><h1>All signed.<br /><em>All yours.</em></h1><p>{money(mandate.cart.total, c.currency)} paid. Your signed receipt keeps the details together.</p><p role="status" className="checkout-returning">Returning to your conversation…<br />This tab closes once your shopping page receives the payment.</p><div className="checkout-paid-actions"><a className="primary-button" href={`/shop?paid=${mandate.mandate_id}`}>Back to shopping →</a><a className="text-button" href={`${API_BASE}/verify/${mandate.mandate_id}`} target="_blank" rel="noreferrer">View signed receipt ↗</a></div>{captureId && <p className="checkout-reference">PayPal reference {captureId}</p>}</section>;

  return (
    <><div className="checkout-page-heading"><h1>{phase === "pay" ? "Continue to PayPal" : "Review purchase"}</h1><span className="environment-label">Sandbox payments</span></div>
    <div className="checkout-layout">
      <section className="checkout-intent">
        <h2>Your request</h2>
        <p className="text-sm text-muted">
          Prepared by your shopping assistant.
          {mandate.agent.signed && <span className="ml-2 rounded bg-ok-soft px-1.5 py-0.5 text-xs text-ok">signed request</span>}{" "}
        </p>
        <blockquote className="checkout-request">“{mandate.instruction.split("\n").filter((line) => !line.startsWith("Selected candidate:")).join("\n")}”</blockquote>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Your spending cap</dt>
            <dd className="font-medium">{money(c.max_amount, c.currency)}</dd>
          </div>
          {attrs.map(([k, v]) => (
            <div key={k}>
              <dt className="capitalize text-muted">Required {k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          <div>
            <dt className="text-muted">Offer expires</dt>
            <dd className="font-medium">{new Date(mandate.expires_at).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="checkout-summary">
        <h2>Order summary</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {mandate.cart.items.map((i) => (
              <tr key={i.sku} className="border-b border-border">
                <td className="py-2">{i.name.replace(/^\[SANDBOX COPY\]\s*/, "")} <span className="text-muted">× {i.qty}</span></td>
                <td className="py-2 text-right">{money(Number(i.unit_price) * i.qty, c.currency)}</td>
              </tr>
            ))}
            <tr><td className="py-2 text-muted">Shipping</td><td className="py-2 text-right">{money(mandate.cart.shipping, c.currency)}</td></tr>
            <tr className="font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{money(mandate.cart.total, c.currency)}</td></tr>
          </tbody>
        </table>
        {Number(mandate.cart.total) <= Number(c.max_amount) && (
          <p className="mt-2 text-sm text-ok">Within your {money(c.max_amount, c.currency)} cap.</p>
        )}
      </section>

      <section className="checkout-actions">
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {cancelled && phase === "pay" && <p className="text-sm text-warn">You cancelled at PayPal. You can try again.</p>}

      {phase === "review" && (
        <button onClick={confirm} className="primary-button w-full">
          Confirm purchase →
        </button>
      )}
      {phase === "pay" && approveUrl && (
        <a href={approveUrl} className="paypal-button">
          Continue with PayPal →
        </a>
      )}
      <p className="checkout-fine-print">You approve the payment in PayPal. This sample order is with Maya&apos;s Loom in PayPal Sandbox, not the source retailer. Your instructions and purchase are recorded in a signed receipt.</p>
      </section>
    </div></>
  );
}

export default function ConfirmPage() {
  return (
    <><a href="#main-content" className="skip-link">Skip to content</a><main id="main-content" className="checkout-page">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ConfirmFlow />
      </Suspense>
    </main></>
  );
}
