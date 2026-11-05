"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { api, ApiError, apiPdfUrl, money } from "@/lib/api";
import { Card, DECISION_TONE, hoursLabel, Pill, REASON_LABEL, STATE_TONE, STRENGTH_TONE } from "@/components/ui";

type Section = { heading: string; text: string; refs: string[] };
type Draft = { action: string; evidence_type: string | null; note: string; sections: Section[]; offer: { offer_type: string; amount: string } | null };
type Evidence = { id: string; kind: string; source: string; summary: string };
type Detail = {
  case: { dispute_id: string; state: string; triage: Record<string, string | number | boolean | null> | null; receipt_strength: string | null;
          error: string | null; outcome: string | null; dry_run: boolean };
  evidence: Evidence[];
  evidence_gaps: string[];
  draft: Draft | null;
  check_issues: string[];
  economics: { decision?: string; p_win?: number; fee?: string; ev?: Record<string, string>; offer?: { offer_type: string; amount: string };
               rules_fired?: string[]; hours_left?: number };
  receipt_verification: Record<string, boolean | string> | null;
  payload_hash: string | null;
  pdf_url: string | null;
  allowed_actions: string[];
};

const ACTION_LABEL: Record<string, string> = { PROVIDE_EVIDENCE: "Submit evidence", MAKE_OFFER: "Send offer", ACCEPT_CLAIM: "Accept claim" };

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [override, setOverride] = useState({ decision: "FIGHT", reason: "" });

  const load = useCallback(async () => {
    const detail = await api<Detail>(`/api/cases/${encodeURIComponent(id)}`);
    setD(detail);
    setDraft(detail.draft);
    setDirty(false);
    setProblems(detail.check_issues ?? []);
    if (detail.pdf_url) setPdf(await apiPdfUrl(detail.pdf_url).catch(() => null));
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set after the request resolves
  useEffect(() => { load().catch(() => setMsg("Could not load this case.")); }, [load]);
  useEffect(() => { // while the agent works, poll
    if (d?.case.state !== "ANALYZING") return;
    const t = setInterval(() => load().catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [d?.case.state, load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(label);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.body && typeof e.body === "object" && "problems" in e.body) {
        setProblems((e.body as { problems: string[] }).problems);
        setMsg("The draft has claims the evidence does not support. Fix them and save again.");
      } else setMsg(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return <p className="text-muted">{msg || "Loading…"}</p>;
  const tri = d.case.triage ?? {};
  const econ = d.economics ?? {};
  const due = hoursLabel(typeof tri.hours_left === "number" ? tri.hours_left : null);
  const awaiting = d.case.state === "AWAITING_APPROVAL";

  const setSection = (i: number, patch: Partial<Section>) => {
    if (!draft) return;
    setDraft({ ...draft, sections: draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    setDirty(true);
  };

  return (
    <div className="space-y-5">
      <Link href="/cases" className="text-sm text-muted hover:text-text">← All disputes</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mono text-2xl font-semibold">{d.case.dispute_id}</h1>
        <Pill>{REASON_LABEL[String(tri.reason)] ?? String(tri.reason ?? "")}</Pill>
        <Pill tone={due.tone}>Due {due.text}</Pill>
        <Pill tone={STATE_TONE[d.case.state] ?? "neutral"}>{d.case.state.replaceAll("_", " ").toLowerCase()}</Pill>
        {d.case.dry_run && <Pill tone="info">dry run: submission simulated</Pill>}
        <span className="ml-auto text-xl font-semibold">{money(String(tri.amount ?? ""), String(tri.currency ?? "USD"))}</span>
      </div>
      {d.case.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{d.case.error}</p>}
      {msg && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm" role="status">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Recommendation">
          <Pill tone={DECISION_TONE[econ.decision ?? ""] ?? "neutral"}>{econ.decision ?? "-"}</Pill>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {["fight", "offer", "accept"].map((k) => (
              <div key={k}><dt className="capitalize text-muted">Exp. loss if {k}</dt><dd className="font-medium">{money(econ.ev?.[k] ?? null)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">
            Win chance {econ.p_win !== undefined ? `${Math.round(econ.p_win * 100)}%` : "-"} · fee {money(econ.fee ?? null)}
            {econ.offer && <> · offer {econ.offer.offer_type.replaceAll("_", " ").toLowerCase()} {money(econ.offer.amount)}</>}
          </p>
          {econ.rules_fired?.length ? <p className="mt-1 text-xs text-muted">Because: {econ.rules_fired.join(", ").replaceAll("_", " ")}</p> : null}
        </Card>

        <Card title="Intent receipt">
          <Pill tone={STRENGTH_TONE[d.case.receipt_strength ?? "NONE"] ?? "neutral"}>{d.case.receipt_strength ?? "NONE"}</Pill>
          {d.receipt_verification ? (
            <ul className="mt-3 space-y-1 text-sm">
              {(["chain_ok", "seal_ok", "sig_ok", "custom_id_match"] as const).map((k) => (
                <li key={k} className="flex justify-between">
                  <span className="text-muted">{{ chain_ok: "Hash chain intact", seal_ok: "Seal matches", sig_ok: "Merchant signature", custom_id_match: "Hash stored in PayPal order" }[k]}</span>
                  <span className={d.receipt_verification?.[k] ? "text-ok" : "text-danger"}>{d.receipt_verification?.[k] ? "yes" : "no"}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">This order was not placed through Countersign.</p>}
        </Card>

        <Card title="Evidence">
          {d.evidence.length ? (
            <ul className="space-y-1.5 text-sm">
              {d.evidence.map((e) => <li key={e.id}><span className="mono mr-2 text-accent">{e.id}</span>{e.summary}</li>)}
            </ul>
          ) : <p className="text-sm text-muted">Not gathered yet.</p>}
          {d.evidence_gaps.length > 0 && <p className="mt-2 text-sm text-warn">Missing: {d.evidence_gaps.join(", ").toLowerCase()}</p>}
        </Card>
      </div>

      <Card title="Response to PayPal (drafted by the agent, checked against the evidence)">
        {!draft ? (
          <div className="flex items-center gap-3 text-sm text-muted">
            {d.case.state === "ANALYZING" ? "The agent is preparing this case…" : "No draft yet."}
            {["NEW", "NEEDS_ATTENTION", "MANUAL"].includes(d.case.state) && (
              <button disabled={busy} onClick={() => run("Analysis started.", () => api(`/api/cases/${encodeURIComponent(id)}/analyze`, { method: "POST", json: { force: d.case.state === "MANUAL" } }))}
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-white dark:text-black">Run the agent</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Action: <strong>{ACTION_LABEL[draft.action] ?? draft.action}</strong>
              {draft.offer && <> · {draft.offer.offer_type.replaceAll("_", " ").toLowerCase()} {money(draft.offer.amount)}</>}</p>
            <label className="block text-sm font-medium" htmlFor="note">Note to PayPal ({draft.note.length}/2000)</label>
            <textarea id="note" value={draft.note} maxLength={2000} rows={4} disabled={!awaiting}
              onChange={(e) => { setDraft({ ...draft, note: e.target.value }); setDirty(true); }}
              className="w-full rounded-md border border-border bg-surface-2 p-2 text-sm outline-none focus:border-accent" />
            {draft.sections.map((s, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <input value={s.heading} disabled={!awaiting} onChange={(e) => setSection(i, { heading: e.target.value })}
                  className="w-full bg-transparent font-medium outline-none" aria-label="Section heading" />
                <textarea value={s.text} rows={3} disabled={!awaiting} onChange={(e) => setSection(i, { text: e.target.value })}
                  className="mt-1 w-full rounded bg-surface-2 p-2 text-sm outline-none" aria-label="Section text" />
                <div className="mt-1 flex flex-wrap gap-1">{s.refs.map((r) => <span key={r} className="mono rounded bg-accent-soft px-1.5 text-xs text-accent">{r}</span>)}</div>
              </div>
            ))}
            {problems.length > 0 && (
              <ul className="rounded-md bg-danger-soft p-3 text-sm text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            )}
            {awaiting && (
              <div className="flex flex-wrap items-center gap-2">
                {dirty ? (
                  <button disabled={busy} onClick={() => run("Draft saved and re-checked.", () => api(`/api/cases/${encodeURIComponent(id)}/draft`, { method: "PUT", json: draft }))}
                    className="rounded-md bg-accent px-4 py-2 font-medium text-white dark:text-black">Save & re-check</button>
                ) : (
                  <button disabled={busy || problems.length > 0 || !d.payload_hash}
                    onClick={() => run("Approved. Submitted to PayPal.", () => api(`/api/cases/${encodeURIComponent(id)}/approve`, { method: "POST", json: { action: draft.action, payload_hash: d.payload_hash } }))}
                    className="rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50 dark:text-black">
                    Approve & {ACTION_LABEL[draft.action]?.toLowerCase() ?? "submit"}
                  </button>
                )}
                <button disabled={busy} onClick={() => run("Rejected. Handle this case manually.", () => api(`/api/cases/${encodeURIComponent(id)}/reject`, { method: "POST" }))}
                  className="rounded-md border border-border px-3 py-2 text-sm">Reject</button>
                <span className="mono ml-auto text-xs text-muted" title="Approval covers exactly this payload">payload {d.payload_hash?.slice(0, 12)}…</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {awaiting && (
        <Card title="Disagree with the recommendation?">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={override.decision} onChange={(e) => setOverride({ ...override, decision: e.target.value })}
              className="rounded-md border border-border bg-surface-2 px-2 py-1.5">
              {["FIGHT", "OFFER", "ACCEPT"].map((o) => <option key={o}>{o}</option>)}
            </select>
            <input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} placeholder="Why (the agent reads this)"
              className="min-w-64 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5" />
            <button disabled={busy} onClick={() => run("Decision changed; the agent is redrafting.", () => api(`/api/cases/${encodeURIComponent(id)}/override`, { method: "POST", json: override }))}
              className="rounded-md border border-border px-3 py-1.5">Change decision</button>
          </div>
        </Card>
      )}

      {pdf && (
        <Card title="Evidence pack (PDF sent with the response)">
          <iframe src={pdf} title="Evidence PDF" className="h-[600px] w-full rounded border border-border" />
        </Card>
      )}
    </div>
  );
}
