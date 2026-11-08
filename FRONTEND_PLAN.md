# Public landing and shopping app — November 6, 2026

## Accepted flow

`/` landing → Open app → `/shop`, without shopper login. Merchant pages keep their existing login and authorization. Use Reverie/Clay as visual references: warm paper, forest green, editorial typography and original illustrated artwork.

## Desktop usability follow-up

Reviewer desktop experience takes priority. The app now begins with a centered working composer and three editable suggestions. There is no empty results pane before a search. The first request opens chat beside three columns of real products; selecting a product opens a compact purchase panel and two product columns. Chat text is 14px, product names 15px, composer text 15–17px, and primary actions are at least 44px tall. Short desktop windows get a compact starting layout so suggestions stay visible. Enter sends; Shift+Enter inserts a newline, and composing input is not submitted.

Verification: desktop layouts at approximately 1366×768 and 1440×900, plus a shorter 1498×627 window. A real search returned six products. A $60 cart was rejected under a $40 cap and prepared after restoring $90; no confirmation or payment. New chat restored the initial layout and cleared the composer. Existing captured $85.95 receipt displayed the verified paid state with appropriate receipt copy. Production build (including TypeScript), ESLint and seven frontend tests passed. Mobile polish is deferred per the user's desktop-first instruction.

## Implementation

- [x] Separate public landing with a clear Open app action and brief Ask / Choose / Approve steps.
- [x] Public shopping layout, outside the authenticated merchant route group.
- [x] Remove the logo/Home/Shop website header from `/shop`. Keep landing navigation separate, use one compact task toolbar, and let the desktop workspace fill the viewport. Research: Nielsen Norman Group's Browser and GUI Chrome and Atlassian's navigation-system layout guidance.
- [x] Signed, expiring HttpOnly visitor cookie. Products belong to the visitor; guest tokens cannot authorize merchant APIs. Reject unrelated Origin headers. Provider credentials stay on the backend.
- [x] Chat and visual products first; purchase details appear only after selection. Budget/preferences are compact. Long assistant replies collapse behind More details, preserving the full response.
- [x] Keep real search, exact attributes, validation errors, source inspection, sandbox disclosure and human payment approval.
- [x] Verify paid status with the backend before acknowledging a checkout. Close an acknowledged script-opened tab; redirect to a paid shopping view if closing is unavailable or the original tab is absent.

## Verification

Navigation separation follow-up: production build (including TypeScript), ESLint and seven frontend tests passed. In Brave, `/shop` has no website header or navigation and fills the desktop viewport; its toolbar/preferences fit at 390px CSS width without horizontal overflow. `/` retains its separate landing header and Open app links. Temporary viewport overrides were reset. Backend health and database checks passed on port 8010. The local frontend was running `next start`, so it was restarted to serve the new production build.

- [x] Fresh browser with no seller token: landing → Open app → shopping, no login form or redirect.
- [x] Real chat search: six products with loaded images; selection opens purchase details. Check purchase prepared an $80.97 quote without confirming or paying.
- [x] Landing and populated app at desktop and 390px mobile widths: no horizontal overflow; mobile purchase review precedes products after selection.
- [x] Existing captured receipt `rcpt_6ee09dc4ef0996cbef375500`: verified $85.95 paid state, original-tab acknowledgement, script-opened tab closes, browser-blocked close redirects.
- [x] Frontend: production build, seven Node tests, TypeScript and ESLint. Merchant layout uses the Suspense boundary required by Next.js Cache Components; anonymous merchant entry still redirects to login. Backend: 171 passed, 11 existing LLM evaluations deselected; final shopping-only rerun: 16 passed.

## Limits

No deployment or new payment. Real dispute lifecycle and tracking remain outside this UI change. The source retailer receives no order: checkout is a disclosed sandbox copy at the configured PayPal sandbox seller. Kernel source inspection was previously verified; it was not repeated during this layout check.

## November 7 remaining frontend plan

- Buyer flow: use `/shop`, choose a product, prepare and review the purchase, and approve it in PayPal Sandbox. After return, **View receipt** opens the backend verifier. An existing captured receipt can be opened directly for a read-only walkthrough.
- Seller flow: sign in through `/login`, open **Orders**, and follow the receipt link. In **Disputes**, open a real case, inspect the evidence and PDF, then review the draft before any approval. The PDF QR opens the same verifier.
- Remaining live QA: exercise the seller queue with real sandbox disputes, tracking, draft edits, PDF preview, approval and the resulting case state. Repeat the buyer and seller flows on the hosted release.
- Original scope to reconcile: dedicated `/deadlines` and `/mandates` pages, richer case timelines and trace links, editable economics priors, bulk analysis, and the PayPal JS SDK v6 popup. The current checkout uses the verified redirect flow. AG Studio remains stretch scope and mobile polish is deferred.
- Release: connect the frontend repository, configure its hosted API origin, and add the reviewer walkthrough and screenshots to the submission materials.
