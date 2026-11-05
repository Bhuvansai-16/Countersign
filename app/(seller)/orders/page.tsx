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
  const load = useCallback(() => api<Order[]>("/api/orders").then(setRows).catch(() => setMsg("Could not load orders.")), []);
  useEffect(() => { load(); }, [load]);

  const track = useCallback(async (o: Order, body: Record<string, unknown>) => {
    try {
      await api(`/api/orders/${encodeURIComponent(o.paypal_order_id)}/track`, { method: "POST", json: body });
      setMsg(`Tracking updated for ${o.paypal_order_id}.`);
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Tracking update failed.");
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
              <button className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => {
                const number = window.prompt("USPS tracking number");
                if (number) track(data, { carrier: "USPS", tracking_number: number });
              }}>Add tracking</button>
            )}
            {data.tracking_status && data.tracking_status !== "DELIVERED" && (
              <button className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => track(data, { status: "DELIVERED" })}>Mark delivered</button>
            )}
          </span>
        );
      } },
  ], [track]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      <div className="h-[560px]">
        <AgGridReact<Order> theme={gridTheme} rowData={rows} columnDefs={columns} getRowId={(p) => p.data.paypal_order_id}
          overlayNoRowsTemplate="No orders yet." />
      </div>
    </div>
  );
}
