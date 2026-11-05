"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { API_BASE, api, ApiError, Mandate, money } from "@/lib/api";

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
          return load().then(() => setPhase("paid"));
        })
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : "PayPal could not complete the payment.");
          setPhase("error");
        });
    } else {
      load();
    }
  }, [returnedOrder, cancelled, load]);

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
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">
          Your shopping agent <span className="mono text-text">{mandate.agent.claimed_platform ?? "agent"}</span>
          {mandate.agent.signed && <span className="ml-2 rounded bg-ok-soft px-1.5 py-0.5 text-xs text-ok">signed request</span>}{" "}
          wants to buy this for you.
        </p>
        <blockquote className="mt-3 border-l-2 border-accent pl-3 text-base">“{mandate.instruction}”</blockquote>
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

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Cart</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {mandate.cart.items.map((i) => (
              <tr key={i.sku} className="border-b border-border">
                <td className="py-2">{i.name} <span className="text-muted">× {i.qty}</span></td>
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

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {cancelled && phase === "pay" && <p className="text-sm text-warn">You cancelled at PayPal. You can try again.</p>}

      {phase === "review" && (
        <button onClick={confirm} className="w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white dark:text-black">
          Confirm this purchase
        </button>
      )}
      {phase === "pay" && approveUrl && (
        <a href={approveUrl} className="block w-full rounded-lg bg-[#ffc439] px-4 py-3 text-center text-base font-semibold text-[#111]">
          Pay with PayPal
        </a>
      )}
      {phase === "paid" && (
        <div className="rounded-xl border border-ok bg-ok-soft p-5">
          <p className="font-semibold text-ok">Paid. Thank you!</p>
          <p className="mt-1 text-sm">
            {captureId && <>PayPal capture <span className="mono">{captureId}</span>. </>}
            Your confirmation is recorded in a signed receipt.{" "}
            <a className="underline" href={`${API_BASE}/verify/${mandate.mandate_id}`} target="_blank" rel="noreferrer">
              Verify it against PayPal
            </a>
          </p>
        </div>
      )}
      <p className="text-xs text-muted">
        Your agent can quote but cannot pay. Confirming here and approving in PayPal is what authorises this purchase.
      </p>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Confirm your purchase</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ConfirmFlow />
      </Suspense>
    </main>
  );
}
