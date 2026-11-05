"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { Card, Pill } from "@/components/ui";

export default function SimPage() {
  const [log, setLog] = useState<string[]>([]);
  const [create, setCreate] = useState({ buyer_transaction_id: "", buyer_email: "", amount: "84.00", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" });
  const [disputeId, setDisputeId] = useState("");

  async function call(label: string, path: string, json: unknown = {}) {
    try {
      const out = await api(path, { method: "POST", json });
      setLog((l) => [`${label}: ${JSON.stringify(out)}`, ...l]);
      return out;
    } catch (e) {
      setLog((l) => [`${label} failed: ${e instanceof ApiError ? `${e.status} ${e.message}` : String(e)}`, ...l]);
    }
  }

  const input = "rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sandbox controls</h1>
        <Pill tone="warn">SANDBOX ONLY</Pill>
      </div>
      <p className="text-sm text-muted">Drive PayPal&apos;s sandbox dispute lifecycle for demos. Requires SIMULATOR_ENABLED / DEMO_ENABLED on the backend.</p>

      <Card title="Judge demo">
        <button onClick={() => call("demo/run", "/api/demo/run")} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white dark:text-black">
          Run a demo dispute
        </button>
        <p className="mt-2 text-xs text-muted">Takes the next pre-created sandbox dispute, or re-runs the last one as a labelled dry run.</p>
      </Card>

      <Card title="Open a dispute as the buyer">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Buyer transaction ID" value={create.buyer_transaction_id} onChange={(e) => setCreate({ ...create, buyer_transaction_id: e.target.value })} />
          <input className={input} placeholder="Sandbox buyer email" value={create.buyer_email} onChange={(e) => setCreate({ ...create, buyer_email: e.target.value })} />
          <input className={input} placeholder="Amount" value={create.amount} onChange={(e) => setCreate({ ...create, amount: e.target.value })} />
          <select className={input} value={create.reason} onChange={(e) => setCreate({ ...create, reason: e.target.value })}>
            <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">Item not received</option>
            <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">Not as described</option>
          </select>
        </div>
        <button onClick={() => call("create dispute", "/api/sim/disputes", create)} className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm">Create dispute</button>
      </Card>

      <Card title="Move a dispute through PayPal's simulator">
        <input className={`${input} w-64`} placeholder="Dispute ID (PP-D-…)" value={disputeId} onChange={(e) => setDisputeId(e.target.value.trim())} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => call("require-evidence", `/api/sim/disputes/${encodeURIComponent(disputeId)}/require-evidence`, { action: "SELLER_EVIDENCE" })}>Require seller evidence</button>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => call("escalate", `/api/sim/disputes/${encodeURIComponent(disputeId)}/escalate`, { note: "Escalated for review" })}>Escalate</button>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm text-ok" onClick={() => call("adjudicate seller", `/api/sim/disputes/${encodeURIComponent(disputeId)}/adjudicate`, { adjudication_outcome: "SELLER_FAVOR" })}>Decide for seller</button>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm text-danger" onClick={() => call("adjudicate buyer", `/api/sim/disputes/${encodeURIComponent(disputeId)}/adjudicate`, { adjudication_outcome: "BUYER_FAVOR" })}>Decide for buyer</button>
        </div>
      </Card>

      <Card title="Log">
        {log.length ? <ul className="mono space-y-1 text-xs">{log.map((l, i) => <li key={i} className="break-all">{l}</li>)}</ul> : <p className="text-sm text-muted">Nothing yet.</p>}
      </Card>
    </div>
  );
}
