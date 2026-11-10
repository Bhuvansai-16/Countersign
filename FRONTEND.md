# Countersign frontend: brief and progress

Read with `../Countersign-backend/docs/HANDOFF.md` (backend status, how to run) and
`../Countersign-backend/docs/design.md` §12 (API contract). Live API docs: `http://localhost:8000/docs` when the
backend runs. This file is the frontend's plan and handoff; update the Progress table as you go.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · AG Grid Community (React) with a custom theme via the Theming API ·
PayPal JS SDK v6 (sandbox). No other UI kit. Env: `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`),
`NEXT_PUBLIC_PAYPAL_CLIENT_ID` (sandbox client ID, public).

Auth: `POST /api/login {password}` returns a token; keep it in `localStorage` (`cs_token`) and send
`Authorization: Bearer <token>` on seller routes. Landing, shopping and buyer confirmation are public. Shopping uses a separate signed, HttpOnly visitor cookie with isolated candidate ownership; its API calls include credentials and never send the seller token.

## Pages (demo priority order)

| # | Route | Who | API calls | Must show |
|---|---|---|---|---|
| 0 | `/` → `/shop` | shopper (public, no login) | `/api/demo/shopping/*` with visitor cookie | Illustrated landing with Open app; chat and real product cards, budget/preferences, contextual purchase review and optional source browser |
| 1 | `/confirm/[id]` | buyer (public) | `GET /api/mandates/{id}`, `POST /api/mandates/{id}/confirm {method:"hosted_page_click"}` → `{approve_url}`, then after PayPal `POST /api/orders/{token}/capture` | Which agent asks, the instruction, cap, required attributes, cart and total, a big Confirm button. After confirm: "Pay with PayPal" (redirect to `approve_url`; the PayPal return lands back on this page with `?token=<orderId>` and the page captures). Then "Paid" + link to `/verify/{id}` on the backend |
| 2 | `/cases` | seller | `GET /api/cases`, `GET /api/metrics` | AG Grid queue sorted by deadline. Custom cells: countdown (red < 24 h, amber < 48 h), reason pill, amount, fee with tooltip, Seller Protection shield, receipt-strength badge, evidence progress bar, recommendation chip ("FIGHT · saves $41"), state pill, Review button. KPI header (open, due < 48 h, won, $ defended) and dispute-rate gauge with marks at 1.0% and 1.5% (label "simulated history" when `simulated_history`) |
| 3 | `/cases/[id]` | seller | `GET /api/cases/{id}`, `PUT /api/cases/{id}/draft`, `POST .../approve {action, payload_hash}`, `.../override`, `.../reject`, `.../analyze`, `GET .../pdf` | Header (reason, amount, countdown, decision). Economics panel (EV fight/offer/accept, p_win, fee, rules fired). Evidence list (E1..), receipt verification card. Draft editor (note + sections with ref chips) with Save → shows new payload hash or 422 problems. Approve & Submit (uses current `payload_hash`), Override decision, Reject. PDF preview iframe (fetch with token → blob URL) |
| 4 | `/orders` | seller | `GET /api/orders`, `POST /api/orders/{id}/track` | Grid with receipt strength and tracking status; "Add tracking" and "Mark delivered" actions |
| 5 | `/issues` | seller | `GET /api/issues`, `POST /api/issues/{id}/approve {payload_hash}` | Agent-reported problems, proposal, Approve offer |
| 6 | `/sim` | seller (sandbox) | `POST /api/sim/disputes`, `POST /api/sim/disputes/{id}/{require-evidence|adjudicate|escalate}`, `POST /api/demo/run` | Sandbox controls with a clear SANDBOX badge |
| 7 | `/login` | seller | `POST /api/login` | Password form |

## Look and feel

Warm paper, forest green, editorial headings and illustrated landing. The app uses compact controls, visual product cards and contextual purchase details. Light appearance is intentional. Merchant tables retain semantic states and monospace IDs/hashes. See `DESIGN.md`.
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

Desktop usability pass: a centered working composer and editable shopping suggestions replace the initial empty results panel. Sending a request opens readable chat beside larger product cards; selection opens a compact review panel. Enter sends, Shift+Enter adds a line, and New chat returns to the starting layout. Laptop and larger desktop sizes, real search, blocked/valid budgets and an existing paid receipt were checked. Production build, TypeScript, ESLint and seven frontend tests pass. Mobile polish is deferred per the user's desktop-first direction. See `FRONTEND_PLAN.md`.

November 6: public landing → Open app → shopping, with no shopper login. Chat and products lead; purchase details appear after selection, and long replies collapse behind More details. Real anonymous search returned six products and prepared an $80.97 quote without confirming or paying. Desktop/mobile layouts have no horizontal overflow. The existing $85.95 captured receipt returned to a backend-verified paid view. Cross-tab acknowledgement and script-opened checkout close passed; browser-blocked close redirected instead. Production build, seven frontend tests, TypeScript and ESLint pass. Backend: 171 passed, 11 live LLM evaluations deselected; final shopping-only rerun: 16 passed. Provider keys stay backend-only, and shopping still requires enabled sandbox mode. Merchant routes remain protected. See `FRONTEND_PLAN.md` and backend `docs/SHOPPING_DEMO.md`.

| Step | State |
|---|---|
| Brief (this file) | done |
| Scaffold Next.js 16 + Tailwind 4 + AG Grid 36 | done |
| API client (`lib/api.ts`) + login + seller shell (`app/(seller)/layout.tsx`) | done |
| Confirm page (redirect flow, captures on PayPal return) | verified live Nov 5: owner approved US order 2NG228202S383952F; return captured 3L906348KK120212Y for $84, page shows Paid, receipt verifies STRONG against PayPal. Backend capture header fixed with a regression test; crashed Next.js dev worker recovered by restart, no frontend source change |
| Case queue (`app/(seller)/cases/page.tsx`): AG Grid, custom theme, 9 custom cells, quick filter, saved column state, KPIs, dispute-rate gauge, 15 s refresh | done (type-checked; not yet viewed with real cases) |
| Case detail (`app/(seller)/cases/[id]/page.tsx`): economics, receipt checks, evidence, draft editor with Save & re-check, Approve, Reject, Override, PDF preview, run agent | done (type-checked; not yet clicked through) |
| Orders (grid + Add tracking / Mark delivered), Agent issues (approve offers), Sandbox controls (demo run, create dispute, simulator actions) | done (type-checked + lint clean; not yet clicked through) |

## Notes for the next agent

- Run: backend on 8000 (see backend `docs/RUN_LOCAL.md`), then `node node_modules/next/dist/bin/next dev --port 3000` here. Open `http://localhost:3000`; shopping needs no login. Merchant-only `/login` uses `ADMIN_PASSWORD` entered locally.
- To see real rows in the grid you need a dispute: run the backend LLM eval scenario or the sandbox flow.
- The repo's git remote was lost when the Next.js scaffold's `.git` was copied over; re-add it with
  `git remote add origin https://github.com/Bhuvansai-16/Countersign.git` (agents cannot write `.git/config` here).
- Public buyer calls use `api(..., { auth: false })` and validate IDs from the URL; keep it that way (security review).
- Next: click through every page against the running backend (fix what breaks), then the JS SDK v6 button,
  then deploy (Render static/Node service), README with screenshots.
- PDF previews go through `apiPdfUrl` (only `/api/` paths, blob forced to application/pdf): security review.
- Copy polish: the confirm page says "Your shopping agent custom" when the agent's claimed platform is `custom`; show the agent id too.
