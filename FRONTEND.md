# Countersign frontend: brief and progress

Read with `../Countersign-backend/docs/HANDOFF.md` (backend status, how to run) and
`../Countersign-backend/docs/design.md` §12 (API contract). Live API docs: `http://localhost:8010/docs` when the
backend runs. This file is the frontend's plan and handoff; update the Progress table as you go.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · AG Grid Community (React) with a custom theme via the Theming API ·
PayPal JS SDK v6 (sandbox). No other UI kit. Env: `NEXT_PUBLIC_API_BASE` (default `http://localhost:8010`),
`NEXT_PUBLIC_PAYPAL_CLIENT_ID` (sandbox client ID, public).

Auth: `POST /api/login {password}` returns a token; keep it in `localStorage` (`cs_token`) and send
`Authorization: Bearer <token>` on seller routes. The buyer confirm page is public.

## Pages (demo priority order)

| # | Route | Who | API calls | Must show |
|---|---|---|---|---|
| 1 | `/confirm/[id]` | buyer (public) | `GET /api/mandates/{id}`, `POST /api/mandates/{id}/confirm {method:"hosted_page_click"}` → `{approve_url}`, then after PayPal `POST /api/orders/{token}/capture` | Which agent asks, the instruction, cap, required attributes, cart and total, a big Confirm button. After confirm: "Pay with PayPal" (redirect to `approve_url`; the PayPal return lands back on this page with `?token=<orderId>` and the page captures). Then "Paid" + link to `/verify/{id}` on the backend |
| 2 | `/cases` | seller | `GET /api/cases`, `GET /api/metrics` | AG Grid queue sorted by deadline. Custom cells: countdown (red < 24 h, amber < 48 h), reason pill, amount, fee with tooltip, Seller Protection shield, receipt-strength badge, evidence progress bar, recommendation chip ("FIGHT · saves $41"), state pill, Review button. KPI header (open, due < 48 h, won, $ defended) and dispute-rate gauge with marks at 1.0% and 1.5% (label "simulated history" when `simulated_history`) |
| 3 | `/cases/[id]` | seller | `GET /api/cases/{id}`, `PUT /api/cases/{id}/draft`, `POST .../approve {action, payload_hash}`, `.../override`, `.../reject`, `.../analyze`, `GET .../pdf` | Header (reason, amount, countdown, decision). Economics panel (EV fight/offer/accept, p_win, fee, rules fired). Evidence list (E1..), receipt verification card. Draft editor (note + sections with ref chips) with Save → shows new payload hash or 422 problems. Approve & Submit (uses current `payload_hash`), Override decision, Reject. PDF preview iframe (fetch with token → blob URL) |
| 4 | `/orders` | seller | `GET /api/orders`, `POST /api/orders/{id}/track` | Grid with receipt strength and tracking status; "Add tracking" and "Mark delivered" actions |
| 5 | `/issues` | seller | `GET /api/issues`, `POST /api/issues/{id}/approve {payload_hash}` | Agent-reported problems, proposal, Approve offer |
| 6 | `/sim` | seller (sandbox) | `POST /api/sim/disputes`, `POST /api/sim/disputes/{id}/{require-evidence|adjudicate|escalate}`, `POST /api/demo/run` | Sandbox controls with a clear SANDBOX badge |
| 7 | `/login` | seller | `POST /api/login` | Password form |

## Look and feel

Calm, trustworthy fintech console. Neutral greys, one accent (deep teal), semantic colours only for state (red overdue,
amber due soon, green won). Monospace for IDs and hashes. Light and dark via CSS variables. Dense but readable tables.
AG Grid prize criteria: polish beyond stock components: custom theme, 5+ custom cell renderers, quick filter, saved
column state.

## Backend change needed for the confirm flow

The PayPal order's `return_url` must point at the frontend confirm page (`{FRONTEND_ORIGIN}/confirm/{id}`), so
PayPal returns the buyer there with `?token=<orderId>` (done in the backend: `mandates._order_body`).

## Later (after the pages above work)

- PayPal JS SDK v6 button on the confirm page (popup instead of redirect): load `https://www.sandbox.paypal.com/web-sdk/v6/core`,
  then follow https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration.md. Verify whether `createInstance`
  needs a server-side client token; if so, add `GET /api/paypal/client-token` to the backend.
- AG Studio analytics dashboard (AG Grid bonus), deploy on Render, README with screenshots.

## Progress

| Step | State |
|---|---|
| Brief (this file) | done |
| Scaffold Next.js 16 + Tailwind 4 + AG Grid 36 | done |
| API client (`lib/api.ts`) + login + seller shell (`app/(seller)/layout.tsx`) | done |
| Confirm page (redirect flow, captures on PayPal return) | done (not yet clicked through against a live sandbox order) |
| Case queue (`app/(seller)/cases/page.tsx`): AG Grid, custom theme, 9 custom cells, quick filter, saved column state, KPIs, dispute-rate gauge, 15 s refresh | done (type-checked; not yet viewed with real cases) |
| Case detail (`app/(seller)/cases/[id]/page.tsx`): economics, receipt checks, evidence, draft editor with Save & re-check, Approve, Reject, Override, PDF preview, run agent | done (type-checked; not yet clicked through) |
| Orders (grid + Add tracking / Mark delivered), Agent issues (approve offers), Sandbox controls (demo run, create dispute, simulator actions) | done (type-checked + lint clean; not yet clicked through) |

## Notes for the next agent

- Run: backend on 8010 (see backend HANDOFF.md), then `npm run dev` here (port 3000; backend CORS allows
  `http://localhost:3000`). Log in with `ADMIN_PASSWORD` from the backend `.env`.
- To see real rows in the grid you need a dispute: run the backend LLM eval scenario or the sandbox flow.
- The repo's git remote was lost when the Next.js scaffold's `.git` was copied over; re-add it with
  `git remote add origin https://github.com/Bhuvansai-16/Countersign.git` (agents cannot write `.git/config` here).
- Public buyer calls use `api(..., { auth: false })` and validate IDs from the URL; keep it that way (security review).
- Next: click through every page against the running backend (fix what breaks), then the JS SDK v6 button,
  then deploy (Render static/Node service), README with screenshots.
- PDF previews go through `apiPdfUrl` (only `/api/` paths, blob forced to application/pdf): security review.
