// Thin client for the Countersign backend (see ../Countersign-backend, FastAPI docs at {API_BASE}/docs).

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8010").replace(/\/$/, "");
const TOKEN_KEY = "cs_token";
const SELLER_SESSION_CHANGE = "countersign:seller-session";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SELLER_SESSION_CHANGE));
  } catch {
    /* Browser storage may be unavailable. */
  }
}

export function subscribeSellerSession(listener: () => void) {
  window.addEventListener(SELLER_SESSION_CHANGE, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SELLER_SESSION_CHANGE, listener);
    window.removeEventListener("storage", listener);
  };
}

function clearRejectedSellerSession(status: number, token: string | null) {
  if (status === 401 && token && getToken() === token) setToken(null);
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === "object" && body && "detail" in body ? String((body as { detail: unknown }).detail) : `HTTP ${status}`);
  }
}

// Public buyer pages pass { auth: false } so a seller session in the same browser is never sent from them.
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const shopping = path.startsWith("/api/demo/shopping/");
  const token = shopping || init.auth === false || path === "/api/login" ? null : getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: shopping ? "include" : init.credentials, headers, body });
  clearRejectedSellerSession(res.status, token);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// PDF previews only: relative /api/ paths, and the blob is always typed application/pdf so a hostile response
// can never be rendered as same-origin HTML.
export async function apiPdfUrl(path: string): Promise<string> {
  if (!path.startsWith("/api/")) throw new ApiError(400, { detail: "unexpected PDF path" });
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  clearRejectedSellerSession(res.status, token);
  if (!res.ok) throw new ApiError(res.status, null);
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "application/pdf" }));
}

// --- shapes returned by the backend --------------------------------------------------------

export type CaseRow = {
  dispute_id: string;
  reason: string | null;
  stage: string | null;
  status: string | null;
  amount: string | null;
  currency: string | null;
  due_at: string | null;
  hours_left: number | null;
  fee: string | null;
  sp_eligible: boolean | null;
  receipt_strength: string | null;
  evidence_completeness: number | null;
  decision: string | null;
  ev_saving: string | null;
  state: string;
  outcome: string | null;
  dry_run: boolean;
};

export type Metrics = {
  dispute_rate_90d: number;
  txns_90d: number;
  disputes_90d: number;
  hv_threshold: number;
  warn_threshold: number;
  open_cases: number;
  due_48h: number;
  won: number;
  lost: number;
  dollars_defended: string;
  simulated_history: boolean;
};

export type Mandate = {
  mandate_id: string;
  status: string;
  instruction: string;
  constraints: { max_amount: string; currency: string; attributes: Record<string, string>; expires_at: string };
  cart: { items: { sku: string; name: string; qty: number; unit_price: string }[]; item_total: string; shipping: string; total: string };
  agent: { id?: string; claimed_platform?: string; signed: boolean };
  expires_at: string;
  paypal_order_id: string | null;
  approve_url: string | null;
};

export function money(value: string | number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}
