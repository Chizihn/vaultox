# VaultOX Backend

NestJS API for institutional treasury execution, compliance policy enforcement, and Solana transaction orchestration.

## Stack

- NestJS 10
- Prisma 6 + PostgreSQL
- Solana web3.js + Anchor client
- JWT auth (wallet signature and Entra adapter validation)
- Swagger docs at /api/v1/docs

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:migrate:dev
npm run start:dev
```

API base: http://localhost:3001/api/v1

## Environment notes

Minimum required for local dev:

- DATABASE_URL
- JWT_SECRET
- BACKEND_WALLET_PRIVATE_KEY
- SOLANA_RPC_URL

Feature-specific:

- SIX\_\* for SIX integration
- ENTRA\_\* for adapter verification
- AML*\* and KYT*\* for policy provider behavior
- ADMIN_API_KEY and ADMIN_OVERRIDE_API_KEY for admin-protected operations

## Module map

```text
src/
├── auth/            wallet auth, Entra verify, binding admin ops
├── compliance/      KYC/AML controls and audit-facing APIs
├── kyt/             provider contract + policy provider
├── settlements/     initiate/signature submit/status sync/lifecycle
├── vaults/          strategies, positions, tx assembly for deposit/withdraw
├── reports/         compliance reporting endpoints
├── market-data/     SIX + fallback quotes and calendar status
├── identity/        Entra JWKS verify + subject-wallet binding policy
├── six/             SIX mTLS transport and quote client
├── solana/          program/tx utilities and on-chain account reads
└── prisma/          Prisma service/module
```

## Important endpoints

### Auth

- POST /auth/challenge
- POST /auth/verify
- POST /auth/verify-entra-adapter
- GET /auth/entra-binding/status/:subjectId/:walletAddress (admin)
- POST /auth/entra-binding/revoke (admin)

### Settlements

- GET /settlements
- POST /settlements/initiate
- POST /settlements/:id/submit-signature
- GET /settlements/:id/tx-status
- POST /settlements/:id/confirm
- POST /settlements/:id/cancel

### Vaults

- GET /vaults/strategies
- GET /vaults/positions
- POST /vaults/deposit
- POST /vaults/withdraw

### Compliance and reports

- GET /compliance/credential
- GET /compliance/audit-log
- GET /compliance/aml/screening
- POST /reports/generate
- GET /reports

## Operational scripts

- npm run sol:airdrop -- --address-only
- npm run sol:airdrop -- --sol 1

These derive the backend signer wallet from BACKEND_WALLET_PRIVATE_KEY.

## Truth boundary

- Solstice API is not integrated in backend runtime flows.
- Solstice remains optional roadmap and should be presented that way.
