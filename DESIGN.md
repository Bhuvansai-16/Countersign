# Countersign product frontend

User direction: Reverie's warm editorial typography and calm composition, with Clay's clear navigation, generous spacing and illustrated landscape. Use the public references as inspiration; do not copy gated assets or source.

Palette: warm paper #f5f3eb, white-linen surfaces, ink #252d25, forest #31553d and muted sage. Light appearance is intentional, including when the operating system prefers dark mode. Georgia display headings pair with the installed Geist body font. Buttons are pills; product media and major surfaces use 20–28px radii; form fields use 10px radii.

Journey: public landing at `/`, then Open app goes straight to `/shop` without shopper login. The landing uses the original landscape. The desktop app starts with a centered working composer and three editable shopping suggestions; no empty results panel. Sending the first request opens a split workspace with readable chat and substantial real product cards. Purchase/browser context appears after selection. No marketing hero or process sections on `/shop`. Listing inspection is on demand; purchase review leads to human PayPal approval and a verified paid state back in the original chat, with checkout auto-close and redirect fallback. Merchant pages remain protected and keep their existing grids and review actions. See `FRONTEND_PLAN.md`.

The landing owns the website header and branding. `/shop` has no website navigation or logo bar: it starts with a compact task toolbar (Shop, one quiet sandbox-payment indicator, budget/preferences and New chat). The desktop workspace fills the viewport; narrow screens use normal document scrolling. Provider setup, raw tool names and debugging controls do not lead the buyer experience. Explain the separate sandbox merchant and source-retailer boundary at purchase review. Keep actual constraints, human approval, receipt links, errors, keyboard focus, loading states and narrow-screen layouts.

Verification: frontend payment-return regression tests, TypeScript, ESLint, and browser walkthrough of entry, results, merchant pages and already-paid return. Use existing captured receipts for return tests; do not make another payment.

Buyer checkout (`/confirm/[id]`) also has no site header or branding bar. Use a compact page title, a wide request/constraints card and an order/approval column across the desktop workspace. Keep the instruction, exact totals, cap, expiry, sandbox merchant disclosure, human confirmation and paid-return behavior. Avoid oversized introductory copy; the transaction is the focus.
