"use client";

import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api, CaseRow, Metrics, money } from "@/lib/api";
import { Card, DECISION_TONE, gridTheme, hoursLabel, Pill, REASON_LABEL, STATE_TONE, STRENGTH_TONE } from "@/components/ui";

type Cell = ICellRendererParams<CaseRow>;
const COLUMN_STATE_KEY = "cs_cases_columns";

const DueCell = ({ data }: Cell) => {
  const { text, tone } = hoursLabel(data?.hours_left ?? null);
  return <Pill tone={tone} title={data?.due_at ?? ""}>{text}</Pill>;
};
const DisputeCell = ({ data }: Cell) =>
  data ? <Link href={`/cases/${data.dispute_id}`} className="mono text-accent hover:underline">{data.dispute_id}</Link> : null;
const ReasonCell = ({ data }: Cell) => <Pill>{REASON_LABEL[data?.reason ?? "OTHER"] ?? data?.reason}</Pill>;
const StageCell = ({ data }: Cell) => (
  <div className="flex flex-col leading-tight">
    <span>{data?.stage ?? "-"}</span>
    <span className="text-xs text-muted">{data?.status?.replaceAll("_", " ").toLowerCase()}</span>
  </div>
);
const FeeCell = ({ data }: Cell) => (
  <span title="PayPal dispute fee: $0 under $30 or when Seller Protection applies, $15 standard, $30 high-volume">
    {money(data?.fee ?? null)}
  </span>
);
const SpCell = ({ data }: Cell) =>
  data?.sp_eligible ? <Pill tone="ok" title="Seller Protection likely applies">Protected</Pill> : <span className="text-muted">-</span>;
const StrengthCell = ({ data }: Cell) => {
  const s = data?.receipt_strength ?? "NONE";
  return <Pill tone={STRENGTH_TONE[s] ?? "neutral"} title="Intent receipt strength">{s === "NONE" ? "No receipt" : s}</Pill>;
};
const EvidenceCell = ({ data }: Cell) => {
  const v = data?.evidence_completeness;
  if (v === null || v === undefined) return <span className="text-muted">not gathered</span>;
  const pct = Math.round(v * 100);
  return (
    <div className="flex items-center gap-2" title={`${pct}% of required evidence present`}>
      <div className="h-1.5 w-16 overflow-hidden rounded bg-surface-2">
        <div className={`h-full ${pct === 100 ? "bg-ok" : "bg-warn"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">{pct}%</span>
    </div>
  );
};
const DecisionCell = ({ data }: Cell) => {
  if (!data?.decision) return <span className="text-muted">-</span>;
  const saving = data.ev_saving && Number(data.ev_saving) > 0 ? ` · saves ${money(data.ev_saving)}` : "";
  return <Pill tone={DECISION_TONE[data.decision] ?? "neutral"}>{data.decision}{saving}</Pill>;
};
const StateCell = ({ data }: Cell) => (
  <span className="flex items-center gap-1">
    <Pill tone={STATE_TONE[data?.state ?? ""] ?? "neutral"}>
      {data?.dry_run && ["SUBMITTED", "ACCEPTED"].includes(data.state) ? "simulation complete" : data?.state.replaceAll("_", " ").toLowerCase()}
    </Pill>
    {data?.dry_run && <Pill tone="info" title="Submission is simulated">dry run</Pill>}
  </span>
);
const ActionCell = ({ data }: Cell) =>
  data ? (
    <Link href={`/cases/${data.dispute_id}`} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-accent">
      {data.state === "AWAITING_APPROVAL" ? "Review & approve" : "Open"}
    </Link>
  ) : null;

function RateGauge({ m }: { m: Metrics }) {
  const max = 0.03; // gauge shows 0-3%
  const pos = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  const tone = m.dispute_rate_90d >= m.hv_threshold ? "bg-danger" : m.dispute_rate_90d >= m.warn_threshold ? "bg-warn" : "bg-ok";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{(m.dispute_rate_90d * 100).toFixed(2)}%</span>
        <span className="text-xs text-muted">{m.disputes_90d} of {m.txns_90d} txns, 90 days{m.simulated_history ? " (incl. simulated history)" : ""}</span>
      </div>
      <div className="relative mt-2 h-2 rounded bg-surface-2">
        <div className={`h-full rounded ${tone}`} style={{ width: pos(m.dispute_rate_90d) }} />
        <div className="absolute -top-1 h-4 w-px bg-warn" style={{ left: pos(m.warn_threshold) }} title="1.0% warning" />
        <div className="absolute -top-1 h-4 w-px bg-danger" style={{ left: pos(m.hv_threshold) }} title="1.5% PayPal high-volume threshold" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>0%</span><span>warn 1.0% · fee $30 + 3-day window at 1.5%</span></div>
    </div>
  );
}

export default function CasesPage() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filter, setFilter] = useState("");
  const [gridApi, setGridApi] = useState<GridApi<CaseRow> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      Promise.all([api<CaseRow[]>("/api/cases"), api<Metrics>("/api/metrics")])
        .then(([r, m]) => { setRows(r); setMetrics(m); setError(""); })
        .catch(() => setError("Could not reach the Countersign backend."));
    load();
    const t = setInterval(load, 15000); // the agent works in the background; keep the queue fresh
    return () => clearInterval(t);
  }, []);

  const columns = useMemo<ColDef<CaseRow>[]>(() => [
    { headerName: "Due in", field: "hours_left", cellRenderer: DueCell, sort: "asc", width: 110 },
    { headerName: "Dispute", field: "dispute_id", cellRenderer: DisputeCell, width: 150 },
    { headerName: "Reason", field: "reason", cellRenderer: ReasonCell, width: 160, filter: true },
    { headerName: "Stage / status", field: "stage", cellRenderer: StageCell, width: 170 },
    { headerName: "Amount", field: "amount", valueFormatter: (p) => money(p.value, p.data?.currency ?? "USD"), type: "rightAligned", width: 110 },
    { headerName: "Fee", field: "fee", cellRenderer: FeeCell, width: 80 },
    { headerName: "Protection", field: "sp_eligible", cellRenderer: SpCell, width: 120 },
    { headerName: "Receipt", field: "receipt_strength", cellRenderer: StrengthCell, width: 120, filter: true },
    { headerName: "Evidence", field: "evidence_completeness", cellRenderer: EvidenceCell, width: 140 },
    { headerName: "Recommendation", field: "decision", cellRenderer: DecisionCell, width: 200, filter: true },
    { headerName: "State", field: "state", cellRenderer: StateCell, width: 190, filter: true },
    { headerName: "", colId: "action", cellRenderer: ActionCell, width: 150, sortable: false, pinned: "right" },
  ], []);

  function saveColumns() {
    if (!gridApi) return;
    try { localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(gridApi.getColumnState())); } catch { /* optional */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Merchant workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>
          <p className="mt-2 text-sm text-muted">The next right action, in deadline order. Every response waits for your approval.</p>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter disputes…"
          className="w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          aria-label="Filter disputes"
        />
      </div>

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card><p className="text-xs text-muted">Open cases</p><p className="text-2xl font-semibold">{metrics.open_cases}</p>{metrics.awaiting_paypal > 0 && <p className="mt-1 text-xs text-muted">{metrics.awaiting_paypal} under PayPal review</p>}</Card>
          <Card><p className="text-xs text-muted">Due within 48 h</p><p className={`text-2xl font-semibold ${metrics.due_48h ? "text-warn" : ""}`}>{metrics.due_48h}</p></Card>
          <Card><p className="text-xs text-muted">Won / lost</p><p className="text-2xl font-semibold">{metrics.won} <span className="text-muted">/ {metrics.lost}</span></p></Card>
          <Card><p className="text-xs text-muted">Dollars defended</p><p className="text-2xl font-semibold text-ok">{money(metrics.dollars_defended)}</p></Card>
          <Card className="sm:col-span-2 lg:col-span-1"><p className="mb-1 text-xs text-muted">Dispute rate</p><RateGauge m={metrics} /></Card>
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="h-[560px]">
        <AgGridReact<CaseRow>
          theme={gridTheme}
          rowData={rows}
          columnDefs={columns}
          quickFilterText={filter}
          getRowId={(p) => p.data.dispute_id}
          overlayNoRowsTemplate="No disputes need your attention. New cases will appear here."
          onGridReady={(e) => {
            setGridApi(e.api);
            try {
              const saved = localStorage.getItem(COLUMN_STATE_KEY);
              if (saved) e.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
            } catch { /* optional */ }
          }}
          onColumnMoved={saveColumns}
          onColumnResized={(e) => e.finished && saveColumns()}
          onSortChanged={saveColumns}
        />
      </div>
    </div>
  );
}
