# VaultOX Frontend

Next.js dashboard for institutional treasury operations and compliance-aware workflows.

## Stack

- Next.js (App Router)
- React 19 + TypeScript
- Tailwind + shadcn UI components
- TanStack Query
- Zustand stores
- Solana wallet adapter

## Run locally

```bash
npm install
npm run dev
```

Default URL: http://localhost:3000

Set NEXT_PUBLIC_API_URL to your backend (default expected: http://localhost:3001/api/v1).

## App routes

- / login and wallet auth handoff
- /(dashboard)/dashboard KPI and live visibility
- /(dashboard)/settlements settlement lifecycle and chain status
- /(dashboard)/vaults strategies and position surfaces
- /(dashboard)/compliance credential/AML/audit views
- /(dashboard)/reports report generation and retrieval

## Key frontend behavior

- Wallet challenge/verify auth flow
- JWT persistence + guarded dashboard routes
- Settlement initiation returns unsigned tx from backend
- Frontend signs/sends tx and submits signature back to API
- Frontend polls tx-status endpoint for final state

## Data services

- services/api.ts central Axios config and auth behavior
- services/settlements.ts settlement lifecycle calls
- services/vaults.ts vault strategy and tx orchestration calls
- services/compliance.ts compliance endpoints
- services/reports.ts reporting endpoints

## Notes

- UI currently aligns to VaultOX dark design system tokens in app/globals.css.
- Market data surfaces can show SIX-backed or fallback source labels.
- Solstice is not required by frontend runtime and is not treated as a hard dependency.
