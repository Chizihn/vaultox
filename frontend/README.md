# VaultOX Frontend — Next.js 15 Dashboard

Institutional treasury dashboard for the VaultOX platform. Built with Next.js 15 App Router, Tailwind CSS, Zustand, and TanStack Query.

---

## Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router, TypeScript)                             |
| Styling       | Tailwind CSS 4 + custom design tokens                           |
| UI Components | Radix UI primitives (via shadcn/ui)                             |
| State         | Zustand (`store/authStore`, `store/notificationStore`)          |
| Data Fetching | TanStack Query v5                                               |
| Wallet        | `@solana/wallet-adapter-react` (wallet-standard auto-discovery) |
| Animations    | Framer Motion                                                   |
| Charts        | Recharts                                                        |
| Maps          | Custom SVG world map with live settlement arcs                  |

---

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev           # http://localhost:3000
```

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## Application Structure

```
app/
├── page.tsx                    # Landing page
├── login/                      # Wallet connect + auth
├── access-pending/             # KYC onboarding pending state
└── (dashboard)/                # Authenticated layout
    ├── layout.tsx              # Sidebar + TopNav wrapper
    ├── dashboard/              # Overview metrics + live settlement globe
    ├── vaults/                 # Vault strategies, positions, portfolio
    ├── settlements/            # Initiate, track, Travel Rule modal
    ├── compliance/             # KYC status, AML screening, audit log
    └── reports/                # Generate & download FINMA/MiCA/MAS reports

components/
├── dashboard/                  # All dashboard-page components
├── landing/                    # Public landing page
├── shared/                     # TopNav, Sidebar, SessionGuard, modals
└── ui/                         # shadcn base components

hooks/api/
├── useAuth.ts                  # Wallet challenge + JWT flow
├── useDashboard.ts             # Portfolio summary + settlement counts (live)
├── useVaults.ts                # Strategies, positions, deposits
├── useSettlements.ts           # Settlement list + initiation
├── useCompliance.ts            # KYC, AML, audit trail
└── useReports.ts               # Report generation + list

services/
├── api.ts                      # Axios instance (JWT interceptor + 401 handler)
├── auth.ts                     # Auth service functions
├── settlements.ts              # Settlement service functions + SSE client
├── reports.ts                  # Report service functions
└── vaults.ts                   # Vault service functions

store/
├── authStore.ts                # Auth state (isConnected, institution, jwt, tier)
├── notificationStore.ts        # In-app notifications
└── index.ts                    # Re-exports

hooks/
└── useSettlementProgress.ts    # Settlement step UI animation (5-step progress)
```

---

## Auth Flow

1. User connects Solana wallet (Phantom, Backpack, etc.)
2. `useAuth` requests a nonce from `GET /auth/nonce/:wallet`
3. User signs the nonce message with their wallet
4. Signature posted to `POST /auth/verify` → returns JWT + institution
5. JWT stored in Zustand (`authStore.jwt`) and `localStorage`
6. All API requests via axios interceptor: `Authorization: Bearer <token>`
7. On 401, `disconnect()` is called and user is redirected to `/login`

**Credential gates:**

- `verified` → Dashboard
- `pending_kyc` → `/access-pending`
- `unregistered` → `/access-pending` (submits KYC request)

---

## Dashboard Pages

### Dashboard

Real-time metrics from the backend:

- **Total AUM** — from `GET /vaults/portfolio/summary`
- **Today's Yield** — accrued yield from vault positions
- **Active/Pending Settlements** — live count from `GET /settlements`
- **Compliance Score** — derived from institution tier
- **Live Settlement Globe** — SVG world map polling `/settlements/live-arcs` every 5s

### Settlements

- Full settlement list with status filters
- Initiate cross-border settlement with Travel Rule modal
- 5-step progress animation (`useSettlementProgress`) runs in parallel with the actual API call
- Live arc visualization updates on new settlements

### Compliance

- KYC credential status and tier
- AML screening results with risk score
- Filterable audit trail (real DB events)
- Counterparty registry

### Reports

- Generate FINMA / MiCA / MAS / Custom compliance reports
- Reports compiled from live settlement + audit + AML data
- File uploaded to Cloudinary → real download URL
- Report preview showing applicable regulatory sections per framework

### Vaults

- Yield strategies with APY, risk rating, allocation
- Active positions with accrued yield
- Portfolio summary + allocation chart
- Deposit / withdraw flows

---

## Key Design Tokens

```css
--teal: #00c9a7 /* primary action */ --gold: #f5a623
  /* accent / compliance indicators */ --ok: #22c55e /* success / clear */
  --warn: #f59e0b /* warning */ --danger: #ef4444 /* error / flagged */
  --vault-bg: #0a0d12 /* page background */ --vault-elevated: #12161e
  /* card background */ --vault-border: #1e2433 /* borders */;
```

---

## Core Types (`types/index.ts`)

```typescript
Institution; // Authenticated institution profile
ComplianceTier; // 1 | 2 | 3
CredentialStatus; // "verified" | "pending_kyc" | "unregistered"
Settlement; // Full settlement object with Travel Rule payload
VaultStrategy; // Yield strategy with APY, allocation, risk rating
VaultPosition; // Active position with accrued yield
Report; // Compliance report with Cloudinary download URL
SettlementStep; // Progress step: pending | processing | completed
```
