"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, money } from "@/lib/api";
import { Card, Pill } from "@/components/ui";

type Issue = { issue_id: string; receipt_id: string; type: string; description: string; desired_resolution: string;
               proposal: { type: string; amount?: string; summary?: string } | null; state: string; countered: boolean;
               resolution: Record<string, string> | null; created_at: string; payload_hash: string | null };

const TONE: Record<string, "warn" | "info" | "ok" | "neutral"> = { PROPOSED: "warn", OFFERED: "info", RESOLVED: "ok", REJECTED: "neutral" };

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api<Issue[]>("/api/issues").then(setIssues).catch(() => setMsg("Could not load issues.")), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function approve(i: Issue) {
    try {
      await api(`/api/issues/${encodeURIComponent(i.issue_id)}/approve`, { method: "POST", json: { payload_hash: i.payload_hash } });
      setMsg("Offer sent to the buyer's agent. Money moves only if it accepts.");
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not approve.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent issues</h1>
        <p className="text-sm text-muted">Problems reported by buyers&apos; agents before a dispute. Settle them here and avoid the dispute fee.</p>
      </div>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      {issues?.length === 0 && <p className="text-sm text-muted">No issues reported yet.</p>}
      {issues?.map((i) => (
        <Card key={i.issue_id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-sm">{i.issue_id}</span>
            <Pill>{i.type.replaceAll("_", " ").toLowerCase()}</Pill>
            <Pill tone={TONE[i.state] ?? "neutral"}>{i.state.toLowerCase()}</Pill>
            {i.countered && <Pill tone="info">buyer countered</Pill>}
            <span className="ml-auto text-xs text-muted">{new Date(i.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-2 text-sm">{i.proposal?.summary || i.description}</p>
          <p className="mt-1 text-sm text-muted">
            Buyer wants: {i.desired_resolution.replaceAll("_", " ").toLowerCase()} · Proposed:{" "}
            {i.proposal?.type === "REFUND" ? `refund ${money(i.proposal.amount ?? null)}` : i.proposal?.type?.toLowerCase()}
          </p>
          {i.resolution && <p className="mt-1 text-sm text-ok">Resolved: {JSON.stringify(i.resolution)}</p>}
          {i.state === "PROPOSED" && (
            <button onClick={() => approve(i)} className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white dark:text-black">
              Approve this offer
            </button>
          )}
        </Card>
      ))}
    </div>
  );
}
