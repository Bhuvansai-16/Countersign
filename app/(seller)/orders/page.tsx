"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, API_BASE, ApiError, money } from "@/lib/api";
import { gridTheme, Pill, STRENGTH_TONE } from "@/components/ui";

type Order = { paypal_order_id: string; receipt_id: string | null; capture_id: string | null; status: string; amount: string;
               currency: string; created_at: string; tracking_status: string | null; receipt_strength: string };

export default function OrdersPage() {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [msg, setMsg] = useState("");
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Order[]>("/api/orders").then(setRows).catch(() => setMsg("Could not load orders.")), []);
  useEffect(() => { load(); }, [load]);

  const track = useCallback(async (o: Order, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/api/orders/${encodeURIComponent(o.paypal_order_id)}/track`, { method: "POST", json: body });
      setMsg(`Tracking updated for ${o.paypal_order_id}.`);
      load();
      return true;
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Tracking update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const columns = useMemo<ColDef<Order>[]>(() => [
    { headerName: "Order", field: "paypal_order_id", cellClass: "mono", width: 190 },
    { headerName: "Created", field: "created_at", valueFormatter: (p) => new Date(p.value).toLocaleString(), width: 180, sort: "desc" },
    { headerName: "Amount", field: "amount", valueFormatter: (p) => money(p.value, p.data?.currency ?? "USD"), type: "rightAligned", width: 110 },
    { headerName: "Status", field: "status", width: 130 },
    { headerName: "Receipt", field: "receipt_strength", width: 160, cellRenderer: ({ data }: ICellRendererParams<Order>) =>
        data?.receipt_id ? (
          <a href={`${API_BASE}/verify/${data.receipt_id}`} target="_blank" rel="noreferrer">
            <Pill tone={STRENGTH_TONE[data.receipt_strength] ?? "neutral"}>{data.receipt_strength} ↗</Pill>
          </a>
        ) : <Pill>No receipt</Pill> },
    { headerName: "Tracking", field: "tracking_status", width: 130, valueFormatter: (p) => p.value ?? "-" },
    { headerName: "", colId: "actions", width: 260, sortable: false, cellRenderer: ({ data }: ICellRendererParams<Order>) => {
        if (!data?.capture_id) return null;
        return (
          <span className="flex gap-2">
            {!data.tracking_status && (
              <button className="grid-action" disabled={busy} onClick={() => {
                setTrackingOrder(data); setTrackingNumber("");
              }}>Add tracking</button>
            )}
            {data.tracking_status && data.tracking_status !== "DELIVERED" && (
              <button className="grid-action" disabled={busy} onClick={() => track(data, { status: "DELIVERED" })}>Mark delivered</button>
            )}
          </span>
        );
      } },
  ], [track, busy]);

  return (
    <div className="space-y-4">
      <div className="workspace-page-heading"><p className="eyebrow">Merchant workspace</p><h1>Orders</h1><p>Payments, signed receipts, and delivery details. All in one place.</p></div>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      {trackingOrder && <form className="tracking-form" onSubmit={async (e) => {
        e.preventDefault();
        if (!trackingNumber.trim()) { setMsg("Enter a tracking number."); return; }
        if (await track(trackingOrder, { carrier: "USPS", tracking_number: trackingNumber.trim() })) setTrackingOrder(null);
      }}><div><p className="eyebrow">Delivery details</p><h2>Add tracking</h2><p className="mono text-xs text-muted">{trackingOrder.paypal_order_id}</p></div><label>Carrier<input className="form-field" value="USPS" readOnly /></label><label htmlFor="tracking-number">Tracking number<input id="tracking-number" className="form-field" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} required disabled={busy} /></label><div className="tracking-actions"><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save tracking"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setTrackingOrder(null)}>Cancel</button></div></form>}
      <div className="h-[560px]">
        <AgGridReact<Order> theme={gridTheme} rowData={rows} columnDefs={columns} getRowId={(p) => p.data.paypal_order_id}
          overlayNoRowsTemplate="No orders yet." />
      </div>
    </div>
  );
}
