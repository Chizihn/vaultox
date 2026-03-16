# VaultOX Backend — NestJS API

Institutional-grade REST API for the VaultOX platform. Built with NestJS 10, Prisma ORM, PostgreSQL, and Solana web3.js.

---

## Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | NestJS 10 (TypeScript)                                  |
| ORM           | Prisma 6 + PostgreSQL                                   |
| Auth          | JWT (wallet signature challenge-response)               |
| Blockchain    | `@coral-xyz/anchor` + `@solana/web3.js` — Solana Devnet |
| File Storage  | Cloudinary (compliance report uploads)                  |
| API Docs      | Swagger (`@nestjs/swagger`) at `/api/v1/docs`           |
| Rate Limiting | `@nestjs/throttler` — 5 req/s burst, 100 req/min        |

---

## Module Map

```
src/
├── auth/               Wallet challenge + JWT issuance
├── compliance/         KYC requests, AML screening, audit trail
├── settlements/        Initiate, confirm, cancel, Travel Rule, SSE stream
├── vaults/             Strategies, positions, portfolio summary, yield history
├── reports/            Generate & list compliance reports (Cloudinary upload)
├── market-data/        FX + precious metals quotes (SIX integration stub)
├── solana/             Anchor program client (compliance_registry, vault_program, settlement_engine)
├── prisma/             PrismaService + PrismaModule
└── common/
    ├── guards/         JwtAuthGuard, ActiveCredentialGuard
    └── decorators/     @WalletAddress() param decorator
```

---

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev     # creates all tables
npm run start:dev          # starts on port 3001
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vaultox
JWT_SECRET=<256-bit random string>
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<from contracts/Anchor.toml>

# Cloudinary — required for report file download URLs
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SIX Financial (API key from StableHacks Discord portal)
SIX_API_KEY=
SIX_API_BASE_URL=https://web.apiportal.six-group.com/v1
```

> **Without Cloudinary env vars:** reports still generate and are available as `data:` URIs for direct browser download. Cloudinary just gives a persistent public URL.

---

## Database Schema

| Table            | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `audit_events`   | Immutable log of every compliance-relevant action          |
| `kyc_requests`   | KYC onboarding submissions with status tracking            |
| `aml_screenings` | Per-wallet AML risk scores (provider-agnostic)             |
| `settlements`    | Cross-border settlement lifecycle + Travel Rule payloads   |
| `reports`        | Generated compliance reports with Cloudinary download URLs |

---

## Auth Flow

```
1. GET  /auth/nonce/:wallet         → { nonce, message }
2. [Frontend signs message with wallet]
3. POST /auth/verify                → { accessToken, credentialStatus, institution }
4. [All subsequent requests: Authorization: Bearer <token>]
```

JWT payload includes `walletAddress`, `credentialStatus` (`verified | pending_kyc | unregistered`), and `tier`.

---

## Key Endpoints

### Auth

```
GET  /auth/nonce/:wallet
POST /auth/verify
POST /auth/request-access
DELETE /auth/session
```

### Compliance

```
GET  /compliance/credential
POST /compliance/credential/request
GET  /compliance/audit-log
GET  /compliance/aml/screening
POST /compliance/aml/screening
GET  /compliance/counterparties
```

### Settlements

```
GET  /settlements                       # list (filterable by status)
GET  /settlements/:id
POST /settlements/initiate              # creates DB record + returns unsigned tx
POST /settlements/:id/confirm
POST /settlements/:id/cancel
GET  /settlements/metrics
GET  /settlements/travel-rule/:id
POST /settlements/travel-rule/validate
GET  /settlements/live-arcs             # last 10 settlements as arc coordinates
GET  /settlements/live                  # SSE stream
```

### Vaults

```
GET  /vaults/strategies
GET  /vaults/strategies/:id
GET  /vaults/positions
GET  /vaults/positions/:id
GET  /vaults/portfolio/summary
GET  /vaults/portfolio/allocation
GET  /vaults/yield/history
POST /vaults/deposit
POST /vaults/withdraw
```

### Reports

```
GET  /reports                           # list reports for authenticated wallet
POST /reports/generate                  # compile data + upload to Cloudinary
GET  /reports/compliance/summary        # month-to-date compliance metrics
```

### Market Data

```
GET  /market-data/quotes?symbols=EURUSD,XAUUSD
```

---

## Travel Rule Implementation

Every settlement above threshold requires a `travelRule` object in the initiation request:

```json
{
  "receiver": {
    "walletAddress": "...",
    "institutionName": "...",
    "jurisdiction": "CH"
  },
  "amount": "50000",
  "currency": "USDC",
  "travelRule": {
    "originatorName": "AMINA Bank AG",
    "originatorAddress": "Zug, CH",
    "originatorAccountId": "<wallet>",
    "beneficiaryName": "Counterparty Bank",
    "beneficiaryAddress": "Singapore, SG",
    "beneficiaryAccountId": "<wallet>",
    "purposeCode": "INTC"
  }
}
```

The payload is validated, stored in `settlements.travel_rule_payload`, and included in generated compliance reports.

---

## Report Generation

`POST /reports/generate` compiles a structured JSON document from live DB data:

- Institution profile (KYC status, jurisdiction, tier)
- Settlement summary (volume, success rate, corridors)
- Full settlement records for the period
- Audit trail events
- AML screening results

The document is uploaded to Cloudinary (`/vaultox/reports/`) and a persistent download URL is stored in the `reports` table. Without Cloudinary configuration, a `data:` URI is returned for direct browser download.

---

## Running Tests

```bash
npm run test          # unit tests
npm run test:e2e      # end-to-end tests
```
