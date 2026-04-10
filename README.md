# VaultOX — Institutional Cross-Border Stablecoin Settlement on Solana

> **Compliant by design. Verified by SIX. Built on Solana.**

VaultOX is a high-fidelity, compliance-native settlement rail for regulated financial entities on Solana. It solves the critical "Settlement Gap" that emerged after the collapse of Signature Bank in 2023, providing an institutional-grade alternative for atomic cross-border settlement with protocol-level enforcement.

---

(image: hero_dashboard_overview)
*Description: The VaultOX Executive Dashboard. Shows a real-time snapshot of the institution's Total AUM, accrued yield, and active settlement "arcs" across a global map. Features a live SIX Financial FX ticker.*

---

## 🏆 StableHacks 2026 Submission
- **Core Track:** Cross-Border Stablecoin Treasury
- **Hero Track:** AMINA Bank — Institutional Compliance-First Architecture
- **Additional Tracks:** Institutional Permissioned DeFi Vaults · RWA-Backed Commodity Vaults

---

## ✅ The VaultOX Solution

VaultOX bridges the gap between traditional finance and DeFi by moving compliance from the UI to the **Protocol Layer**, enabling ~2-second settlement finality at **<1 bps** cost.

### Core Pillars

#### 🛂 Vault Passport (1:1 Sticky Identity)
(image: compliance_passport_radar)
*Description: The 'Vault Passport' View. Features a 5-dimensional Radar Chart visualizing the institution's risk profile (KYC, AML, KYT, Reporting, Limits) and the Soulbound PDA address linking to Solana Explorer.*

#### ⚡ Atomic Settlement & SIX FX Locking
(image: settlement_initiation_modal)
*Description: The Settlement Initiation Form. Shows counterparty selection, live FX pricing with the 'SIX Verified' mTLS badge, and jurisdictional market-close warnings.*

#### 📋 FATF Travel Rule — Built-In
(image: settlement_6step_progress)
*Description: The 6-Step Settlement Workflow. A reactive progress modal tracking: Preparing → FX Lock → Compliance Verify → Escrow → Transmit → Clear.*

#### 🏦 Compliance-Gated Treasury Vaults
(image: vault_strategy_matrix)
*Description: The Institutional Vault Matrix. Displays tier-gated strategies (T-Bills, Private Credit) with 7-day APY trend sparklines and Solstice-powered recovery controls.*

---

## 🛠 What's Built

### Smart Contracts (Solana Devnet)
**Program ID:** `5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG`
- **`compliance_registry`**: Soulbound KYC credentials & Token-2022 Transfer Hooks.
- **`settlement_engine`**: Atomic escrow, FX locking, and on-chain FATF storage.
- **`vault_program`**: Tier-gated yield strategies and risk management.

### Institutional Dashboard
- **Settlement Operator**: Live 6st-step progress tracker and SIX-verified FX streaming.
- **Treasury Manager**: Vault management UI with sparse trend lines and Yield Ladder.
- **Compliance Officer**: 5-dimensional **Compliance Radar** and filterable audit trails.

---

## 🛡 Partner Integrations
- **AMINA Bank** — Swiss-regulated institutional workflows.
- **SIX Swiss Exchange** — Verified market data via mTLS-authenticated API.
- **Solstice** — Yield infrastructure with 3-phase recovery flows.
- **Fireblocks** — MPC custody reference architecture.

---

## Quick Start
Detailed technical breakdowns and submission details are in [DORAHACKS.md](docs/DORAHACKS.md).

---
*StableHacks 2026 — Team VaultOX*
*Built on Solana · Powered by SIX · Yield by Solstice*