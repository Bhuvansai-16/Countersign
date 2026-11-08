"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { API_BASE, api, ApiError, Mandate as ReceiptStatus, money } from "@/lib/api";
import { PaidReceipt, readPaidReceipt, watchCheckout } from "@/lib/checkout-return";


type Message = { role: "user" | "assistant"; content: string };
type Product = {
  candidate_id: string; title: string; price: string; currency: string; source_url: string;
  source_domain: string; attributes: Record<string, string>; image_url: string | null; fetched_at: string;
};
type Browser = { candidate_id: string; session_id: string; live_view_url: string };
type Mandate = { mandate_id: string; confirm_url: string; quote: { total: string; shipping: string }; sandbox_copy: boolean };
type Chat = { reply: string; products: Product[]; browser: Browser | null; mandate: Mandate | null; steps: { tool: string; ok: boolean }[] };

const BASE = "/api/demo/shopping";
const ACTION_LABELS: Record<string, string> = { find_products: "Searched the product catalog", inspect_listing: "Visited the source listing", prepare_purchase: "Checked your purchase limits" };

export default function ShopPage() {
  const [status, setStatus] = useState<{ channel3: boolean; kernel: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [cap, setCap] = useState("90.00");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [observation, setObservation] = useState("");
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [paid, setPaid] = useState<PaidReceipt | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const checkoutId = mandate?.mandate_id ?? paid?.mandate_id;
  const conversationEnd = useRef<HTMLDivElement>(null);
  const purchasePanel = useRef<HTMLElement>(null);
  const selectedId = selected?.candidate_id;

  useEffect(() => { conversationEnd.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, busy]);
  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1100px)").matches) purchasePanel.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    api<{ channel3: boolean; kernel: boolean }>(`${BASE}/status`).then(setStatus).catch((e) => setError(String(e.message)));
    const receiptId = new URLSearchParams(window.location.search).get("paid");
    if (receiptId) readPaidReceipt(receiptId, (id) => api<ReceiptStatus>(`/api/mandates/${id}`, { auth: false }))
      .then((receipt) => { if (receipt) setPaid(receipt); })
      .catch(() => setError("Could not check the payment status. Please try again."));
  }, []);

  useEffect(() => watchCheckout(checkoutId,
    (id) => api<ReceiptStatus>(`/api/mandates/${id}`, { auth: false }),
    (receipt) => {
      setPaid(receipt);
      setMessages((m) => [...m, { role: "assistant", content: `Payment received: ${money(receipt.total, receipt.currency)}. Your purchase is complete and your signed receipt is ready below.` }]);
      setSteps((s) => [...s, "Payment verified; signed receipt ready"]);
    }), [checkoutId]);

  function attributes() {
    return { ...(color.trim() ? { color: color.trim() } : {}), ...(material.trim() ? { material: material.trim() } : {}) };
  }

  function fail(e: unknown) {
    let detail = e instanceof Error ? e.message : "Request failed";
    if (e instanceof ApiError && e.body && typeof e.body === "object" && "violations" in e.body) {
      const violations = e.body.violations;
      if (Array.isArray(violations) && violations.length) detail = violations.map((v) => {
        if (v.code === "OVER_CAP") return `Total $${v.total} exceeds your $${v.max_amount} budget.`;
        if (v.code === "ATTRIBUTE_MISMATCH") return `${v.attribute}: requires “${v.wanted}”; ${v.got == null ? "the listing does not supply this attribute" : `the listing says “${v.got}”`}.`;
        return "This cart does not meet your purchase limits.";
      }).join(" ");
    }
    setError(detail);
  }

  async function send() {
    if (!draft.trim() || busy || !status?.channel3) return;
    const text = draft.trim();
    const next: Message[] = [...messages, { role: "user", content: text }];
    const history = next.length > 12 ? [next[0], ...next.slice(-11)] : [...next];
    if (selected) history[history.length - 1] = { ...history[history.length - 1], content: `${text}\nSelected candidate: ${selected.candidate_id} (${selected.title})` };
    setMessages(next); setDraft(""); setBusy("Finding a few good options…"); setError(""); setMandate(null); setPaid(null);
    try {
      if (browser) await stop();
      const out = await api<Chat>(`${BASE}/chat`, { method: "POST", json: { messages: history, max_amount: cap,
        attributes: attributes(), candidate_ids: products.map((p) => p.candidate_id) } });
      setMessages((m) => [...m, { role: "assistant", content: out.reply }]);
      if (out.steps.some((s) => s.tool === "find_products" && s.ok)) { setProducts(out.products); setSelected(null); }
      if (out.browser) setBrowser(out.browser);
      if (out.mandate) setMandate(out.mandate);
      setSteps((s) => [...s, ...out.steps.map((x) => `${ACTION_LABELS[x.tool] ?? "Reviewed the request"}${x.ok ? "" : " · needs attention"}`)]);
    } catch (e) { fail(e); }
    finally { setBusy(""); }
  }

  async function stop() {
    if (!browser) return;
    await api(`${BASE}/${encodeURIComponent(browser.candidate_id)}/browser`, { method: "DELETE" });
    setBrowser(null); setObservation("");
    setSteps((s) => [...s, "Kernel browser stopped"]);
  }

  async function inspect(product: Product) {
    setSelected(product); setBusy("Inspecting the source listing in Kernel…"); setError("");
    try {
      if (browser && browser.candidate_id !== product.candidate_id) await stop();
      const created = await api<Omit<Browser, "candidate_id">>(`${BASE}/${encodeURIComponent(product.candidate_id)}/browser`, { method: "POST" });
      setBrowser({ candidate_id: product.candidate_id, ...created });
      setObservation("");
      const out = await api<{ title: string; observed_at: string }>(`${BASE}/${encodeURIComponent(product.candidate_id)}/inspect`, { method: "POST" });
      setObservation(`Observed “${out.title}” at ${out.observed_at}. This is supplementary browsing context; retailer facts are not verified.`);
      setSteps((s) => [...s, `Kernel inspected ${product.source_domain}`]);
    } catch (e) { fail(e); }
    finally { setBusy(""); }
  }

  async function prepare(product: Product) {
    setSelected(product); setBusy("Checking the purchase against your limits…"); setError(""); setMandate(null);
    try {
      const out = await api<Mandate>(`${BASE}/${encodeURIComponent(product.candidate_id)}/mandate`, {
        method: "POST", json: { instruction: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n").slice(-2000) || product.title,
          max_amount: cap, attributes: attributes() },
      });
      setMandate(out);
      setMessages((m) => [...m, { role: "assistant", content: `Ready to review: $${out.quote.total} including shipping. You approve payment with PayPal.` }]);
      setSteps((s) => [...s, "Countersign validated the cart; waiting for human confirmation"]);
    } catch (e) { fail(e); }
    finally { setBusy(""); }
  }

  function changeConstraint(set: (v: string) => void, value: string) {
    set(value); setMandate(null);
  }

  async function newSearch() {
    if (busy) return;
    if (browser) { try { await stop(); } catch (e) { fail(e); return; } }
    setMessages([]); setProducts([]); setSelected(null); setMandate(null); setPaid(null); setDraft(""); setError(""); setSteps([]);
  }

  const currentAttributes = attributes();
  const purchaseComplete = !!paid && paid.mandate_id === mandate?.mandate_id;
  const showPurchase = !!(selected || mandate || paid || browser);
  const starting = !messages.length && !products.length && !showPurchase && !busy;

  return (
    <div className="shopping-page shopping-app">
      <header className="app-workspace-heading">
        <div className="app-workspace-title"><h1>Shop</h1><span className="environment-label">Sandbox payments</span></div>

      <details className="purchase-preferences">
        <summary><span className="preference-current">Budget {money(cap)}{color ? ` · ${color}` : ""}{material ? ` · ${material}` : ""}</span><span className="preference-edit">Preferences ⌄</span></summary>
        <div className="preference-fields">
          <label>Maximum total (USD)<input type="number" min="6.01" max="10000" step="0.01" className="form-field" value={cap} disabled={!!busy} onChange={(e) => changeConstraint(setCap, e.target.value)} /></label>
          <label>Required colour<input className="form-field" placeholder="Any colour" value={color} disabled={!!busy} maxLength={200} onChange={(e) => changeConstraint(setColor, e.target.value)} /></label>
          <label>Required material<input className="form-field" placeholder="Any material" value={material} disabled={!!busy} maxLength={200} onChange={(e) => changeConstraint(setMaterial, e.target.value)} /></label>
          <p>Total includes $6 shipping. These limits govern checkout; a missing required detail blocks the purchase.</p>
        </div>
      </details>
        {!starting && <button className="secondary-button" onClick={() => void newSearch()} disabled={!!busy}>+ New chat</button>}
      </header>
      {error && <div role="alert" className="inline-error app-error">{error}</div>}

      <div className={`shopping-workspace ${showPurchase ? "has-purchase" : ""} ${starting ? "is-starting" : ""}`}>
        <aside className="conversation-panel" aria-label="Shopping assistant">
          <div className="conversation-heading"><span className="assistant-monogram" aria-hidden="true">c.</span><div><h2>Your assistant</h2></div></div>
          <div role="log" aria-label="Shopping conversation" className="conversation-history">
            {starting && <div className="chat-welcome"><h2>What are we<br /><em>finding today?</em></h2><p>A few good options. Your final say.</p></div>}
            {messages.map((m, i) => {
              const [lead, ...details] = m.content.trim().split(/\n\s*\n/);
              const compact = m.role === "assistant" && details.length > 0 && m.content.length > 300;
              return <div key={i} className={`chat-message chat-${m.role}`}><span>{m.role === "user" ? "You" : "Countersign"}</span><p>{compact ? lead : m.content}</p>{compact && <details className="chat-response-details"><summary>More details</summary><p>{details.join("\n\n")}</p></details>}</div>;
            })}
            {!!busy && <p role="status" className="agent-thinking"><span />{busy}</p>}
            <div ref={conversationEnd} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="conversation-composer">
            <label htmlFor="shopping-message" className="sr-only">Your message</label>
            <textarea id="shopping-message" rows={3} maxLength={1500} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} placeholder={starting ? "Tell me what you’re looking for…" : "Refine your search or ask a question…"} disabled={!!busy} />
            <div className="composer-bottom"><span>You approve every purchase.</span><button type="submit" aria-label="Send message" title="Send message (Enter)" disabled={!!busy || !draft.trim() || !status?.channel3}>{starting ? <>Find products <span aria-hidden="true">↗</span></> : <span aria-hidden="true">↑</span>}</button></div>
          </form>
          {starting && <div className="app-prompts" aria-label="Shopping suggestions">{[{ label: "For your home", title: "A linen throw", query: "A linen throw for my living room" }, { label: "Everyday style", title: "A pair of sneakers", query: "Everyday sneakers" }, { label: "A thoughtful gift", title: "Something for a friend", query: "A gift for a friend" }].map((prompt) => <button key={prompt.label} onClick={() => { setDraft(prompt.query); document.getElementById("shopping-message")?.focus(); }}><span>{prompt.label}</span><strong>{prompt.title} <span aria-hidden="true">↗</span></strong></button>)}</div>}
        </aside>

        {!starting && <section className="discovery-column" aria-label="Product results">
          <div className="discovery-heading"><h2>{products.length ? "Finds for you" : paid ? "Payment complete" : busy ? "Finding your options…" : "Your finds"}</h2>{!!products.length && <span>{products.length} options · USD</span>}</div>
          <div className="product-grid">
            {products.map((p, index) => {
              const matches = Object.entries(currentAttributes).every(([k, v]) => p.attributes[k] === v);
              return <article key={p.candidate_id} className={`discovery-product ${selected?.candidate_id === p.candidate_id ? "is-selected" : ""}`}>
                <button className="product-select" disabled={!!busy} aria-pressed={selected?.candidate_id === p.candidate_id} onClick={() => { setSelected(p); setMandate(null); setPaid(null); setError(""); }}>
                  <div className="product-media"><span className="product-number">{String(index + 1).padStart(2, "0")}</span>{p.image_url ? <Image src={p.image_url} alt={p.title} width={400} height={330} unoptimized /> : <span className="product-image-missing">Image unavailable</span>}<span className="product-select-mark" aria-hidden="true">{selected?.candidate_id === p.candidate_id ? "✓" : "+"}</span></div>
                  <div className="product-info"><span className="product-merchant">{p.source_domain.replace(/^www\./, "")}</span><h3>{p.title}</h3><div className="product-price"><strong>{money(p.price)}</strong><span>{selected?.candidate_id === p.candidate_id ? "Selected" : "Select →"}</span></div></div>
                </button>
                {!matches && <p className="product-caution">A required detail is missing or different.</p>}
                <a className="product-source" href={p.source_url} target="_blank" rel="noopener noreferrer">Source listing ↗</a>
              </article>;
            })}
            {!!busy && !products.length && [1, 2, 3, 4].map((n) => <div key={n} className="product-skeleton" aria-hidden="true"><div /><span /><span /></div>)}
          </div>
          {!products.length && !busy && <div className="results-empty"><h3>{paid ? "You’re all set." : "Let’s narrow it down."}</h3><p>{paid ? "Your signed receipt is ready in Purchase details." : "Try a product type, a different budget, or fewer requirements."}</p></div>}
          {!!products.length && <p className="source-note">Prices are source snapshots. Source-retailer shipping and availability may differ.</p>}
          {!!steps.length && <details className="activity-details"><summary>Search activity <span>+</span></summary><ol>{steps.map((s, i) => <li key={i}><span aria-hidden="true">✓</span>{s}</li>)}</ol><p>Product discovery by Channel3. Source browsing by Kernel. Purchase checks and receipts by Countersign.</p></details>}
        </section>}

        {showPurchase && <aside className="purchase-context" aria-label="Purchase details" ref={purchasePanel}>
          <div className="context-heading"><p className="eyebrow">Purchase details</p><h2>{paid ? "Payment received" : mandate ? "Ready to review" : "Your selection"}</h2></div>
          {paid && <section className="purchase-success"><span className="success-mark" aria-hidden="true">✓</span><div><h2>Paid</h2><p>{money(paid.total, paid.currency)} confirmed. Your signed receipt is ready.</p><a className="primary-button" href={`${API_BASE}/verify/${paid.mandate_id}`} target="_blank" rel="noopener noreferrer">View receipt ↗</a></div></section>}
          {(selected || mandate) && !purchaseComplete && <section className="selection-panel">
            <div className="selection-top"><p className="eyebrow">{mandate ? "Limits checked" : "Product details"}</p>{!mandate && <button aria-label="Clear selected product" className="close-selection" onClick={() => setSelected(null)}>×</button>}</div>
            {selected && <><div className="selected-product">{selected.image_url && <Image src={selected.image_url} alt={selected.title} width={120} height={120} unoptimized />}<div><h3>{selected.title}</h3><p>{selected.source_domain}</p><p className="selected-price">{money(selected.price)} <span>+ $6 shipping</span></p></div></div><p className="selection-attributes">{Object.entries(selected.attributes).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No structured attributes supplied. Required details cannot be assumed."}</p></>}
            {mandate ? <><div className="selection-total"><span>Total with shipping</span><strong>{money(mandate.quote.total)}</strong></div><p className="purchase-disclosure">This sample purchase uses Maya&apos;s Loom in PayPal Sandbox. No order is placed at the source retailer.</p><a className="primary-button" href={mandate.confirm_url} target="_blank" rel="noopener noreferrer">Review purchase →</a></> : selected && <div className="selection-actions"><button className="primary-button" disabled={!!busy} onClick={() => void prepare(selected)}>Prepare purchase →</button><button className="text-button" disabled={!!busy || !status?.kernel} onClick={() => void inspect(selected)}>Inspect source listing ↗</button></div>}
          </section>}
          {browser && <section className="listing-panel"><div className="listing-heading"><div><p className="eyebrow">Source browser</p><h2>Live inspection</h2></div><button className="text-button" disabled={!!busy} onClick={() => { setBusy("Closing the browser…"); void stop().catch(fail).finally(() => setBusy("")); }}>Close</button></div><iframe title="Source listing browser, read-only" src={browser.live_view_url} allow="autoplay" /><p>{observation || "Browsing is supporting context. A security check means the listing could not be inspected."}</p><a className="text-button" href={browser.live_view_url} target="_blank" rel="noopener noreferrer">Open separate viewer ↗</a></section>}
        </aside>}
      </div>
    </div>
  );
}


