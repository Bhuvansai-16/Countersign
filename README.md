# Countersign (frontend)

**Signed receipts for AI agent purchases, and a dispute agent that uses them.** Built for the PayPal AI Hackathon.

- Demo video: https://youtu.be/wKxl8Abr4Gw
- Live app (PayPal sandbox): https://countersign-black.vercel.app
- Backend source: [`backend/`](backend/) (architecture, PayPal APIs and the **Tools** section are in [backend/README.md](backend/README.md))

## What's here

Next.js 16 (App Router, TypeScript), Tailwind 4 and AG Grid 36.

| Route | Who | What |
|---|---|---|
| `/` → `/shop` | Shopper, no login | Chat with the shopping assistant, real product cards (Channel3), budget, purchase review |
| `/confirm/[id]` | Buyer | Review the request, spending cap and cart, confirm, pay with PayPal, see the signed receipt |
| `/login` | Merchant | Seller sign-in (sandbox admin password) |
| `/cases`, `/cases/[id]` | Merchant | AG Grid dispute queue; case review with economics, receipt checks, evidence, the agent's draft, Approve / Reject / Override |
| `/orders`, `/issues`, `/sim` | Merchant | Orders and tracking, agent-reported issues, sandbox test tools |

## Run locally

```bash
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Start the backend first (see the backend README). Open http://localhost:3000.

## Licence

MIT
