# VaultOX — Institutional Stablecoin Treasury on Solana

> **StableHacks 2026 Submission**
> - **Core Track**: Cross-Border Stablecoin Treasury
> - **Hero Track**: AMINA Bank — Institutional Compliance-First Architecture
> - **Additional Implementations**: Institutional Permissioned DeFi Vaults & RWA-Backed Commodity Vaults
VaultOX is a compliance-native institutional treasury platform built on Solana. It enables regulated financial institutions to move stablecoins cross-border with full on-chain KYC enforcement, Travel Rule payloads on every settlement, and a real-time audit trail that satisfies FINMA, MiCA, and MAS regulatory requirements.

---

## Live Demo

|                   |                                        |
| ----------------- | -------------------------------------- |
| **Frontend**      | http://localhost:3000                  |
| **Backend API**   | http://localhost:3001/api/v1           |
| **Swagger Docs**  | http://localhost:3001/api/v1/docs      |
| **Solana Devnet** | Program IDs in `contracts/Anchor.toml` |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│               Next.js 15 Frontend (App Router)           │
│  Dashboard · Vaults · Settlements · Compliance · Reports │
└───────────────────────┬──────────────────────────────────┘
                        │ REST + SSE
┌───────────────────────▼──────────────────────────────────┐
│               NestJS 10 Backend API                       │
│  Auth · Compliance · Vaults · Settlements · Reports       │
│  Prisma ORM · PostgreSQL · JWT · Travel Rule Engine       │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │          │
┌──▼─────┐  ┌▼────────┐ ┌▼────────┐┌▼────────┐┌▼──────────┐
│ Solana │  │PostgreSQL│ │Cloudinary││Solstice ││ Fireblocks│
│ Devnet │  │(Prisma)  │ │(Reports) ││Yield API││ MPC Signer│
│        │  │          │ │          ││USX/eUSX ││(Prod Arch)│
│ compli │  │settlements│ └─────────┘└─────────┘└───────────┘
│ _ance  │  │kyc_reqs  │
│ vault  │  │aml_screen│
│ settle │  │audit_evts│
└────────┘  └──────────┘
```

---

## Compliance Architecture

Every transaction in VaultOX runs through three compliance layers:

1. **On-chain enforcement** — Solana Token-2022 Transfer Hook checks the `compliance_registry` program. Non-whitelisted wallets are blocked at the protocol level before a transaction can execute.

2. **Backend enforcement** — AML screening on every settlement initiation. Travel Rule payload (FATF) is required and attached to every settlement above the threshold. All events are persisted to the audit trail.

3. **Regulatory reporting** — FINMA / MiCA / MAS compliance reports are generated on-demand from live DB data and uploaded to Cloudinary for audit-ready download.

---

## Repository Structure

```
vaultos/
├── contracts/          # Anchor programs (Solana)
│   └── programs/vaultos/src/
│       ├── compliance_registry.rs
│       ├── vault_program.rs
│       └── settlement_engine.rs
├── backend/            # NestJS REST API
│   ├── src/
│   │   ├── auth/
│   │   ├── compliance/
│   │   ├── vaults/
│   │   ├── settlements/
│   │   ├── reports/
│   │   └── market-data/
│   └── prisma/schema.prisma
├── frontend/           # Next.js 15 dashboard
│   ├── app/(dashboard)/
│   ├── components/
│   ├── hooks/api/
│   └── services/
└── docs/               # Architecture, API, data models
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Solana CLI + Anchor CLI (for contract interaction)

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, CLOUDINARY_*
npm install
npx prisma migrate dev
npm run start:dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
npm install
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vaultox
JWT_SECRET=your-256-bit-secret
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<deployed-program-id-from-Anchor.toml>

# Cloudinary — report file storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SIX Financial Data (pending API key from StableHacks portal)
SIX_API_KEY=
SIX_API_BASE_URL=https://web.apiportal.six-group.com/v1
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## API Overview

Full Swagger documentation available at `/api/v1/docs` when the backend is running.

| Module          | Key Endpoints                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Auth**        | `POST /auth/challenge` · `POST /auth/verify` · `POST /auth/request-access`                                     |
| **Compliance**  | `GET /compliance/credential` · `GET /compliance/audit-log` · `GET /compliance/aml/screening`                   |
| **Settlements** | `GET /settlements` · `POST /settlements/initiate` · `GET /settlements/live` (SSE) · `GET /settlements/metrics` |
| **Vaults**      | `GET /vaults/strategies` · `GET /vaults/positions` · `GET /vaults/portfolio/summary` · `POST /vaults/deposit`  |
| **Reports**     | `GET /reports` · `POST /reports/generate` · `GET /reports/compliance/summary`                                  |
| **Market Data** | `GET /market-data/quotes`                                                                                      |

---

## Solana Programs (Devnet)

| Program               | Address                     | Description                               |
| --------------------- | --------------------------- | ----------------------------------------- |
| `compliance_registry` | See `contracts/Anchor.toml` | KYC whitelist — Transfer Hook enforcement |
| `vault_program`       | See `contracts/Anchor.toml` | Permissioned yield vault with KYC gating  |
| `settlement_engine`   | See `contracts/Anchor.toml` | Cross-border settlement with Travel Rule  |

Verify deployments on [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet).

---

## Regulatory Compliance Coverage

| Requirement        | Implementation                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| KYC                | On-chain whitelist (`compliance_registry`) + backend credential status                            |
| AML / KYT          | Rules-based risk scoring persisted per wallet to `aml_screenings` table                           |
| Travel Rule (FATF) | Required payload on every settlement above threshold; stored in `settlements.travel_rule_payload` |
| Audit Trail        | All auth, settlement, compliance events written to `audit_events` table                           |
| Regulatory Reports | FINMA · MiCA · MAS report generation from live data, uploaded to Cloudinary                       |

---

## Partners

- **AMINA Bank** — Target institutional client and hackathon hero track judge
- **SIX Financial Information** — FX and precious metals price feeds via mTLS GraphQL API
- **Solstice** — Yield infrastructure (USX stablecoin, eUSX YieldVault) — live on devnet
- **Fireblocks** — MPC custody reference architecture for production transaction signing
- **Keyrock** — Planned institutional liquidity provision and market-making integration
- **Steakhouse Financial** — Treasury analytics and reporting advisory

---

## Team

StableHacks 2026 — [Team VaultOX]
# vaultox
