# VaultOX Contracts — Solana Anchor Programs

Three Anchor programs that enforce institutional compliance at the protocol level on Solana Devnet.

---

## Deployed Program IDs (Devnet)

Update `Anchor.toml` with real program IDs after deployment. Verify at [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet).

| Program               | ID                                      |
| --------------------- | --------------------------------------- |
| `compliance_registry` | See `Anchor.toml` → `[programs.devnet]` |
| `vault_program`       | See `Anchor.toml` → `[programs.devnet]` |
| `settlement_engine`   | See `Anchor.toml` → `[programs.devnet]` |

---

## Program Overview

### 1. `compliance_registry` — Soulbound KYC Credentials

Issues one non-transferable `ComplianceCredential` PDA per institution wallet (seed: `["credential", wallet]`). This is the on-chain source of truth for all compliance enforcement.

**Fields stored on-chain:**

- `wallet` — institution public key (immutable)
- `institution_name` — 64-byte null-padded string
- `jurisdiction` — ISO 3166-1 alpha-2 code (e.g. `"CH"`, `"SG"`)
- `kyc_level` — 1 (retail) · 2 (professional) · 3 (institutional)
- `tier` — maps to VaultOX tier system
- `aml_coverage` — 0–100 AML compliance score
- `attestation_hash` — 32-byte hash linking to off-chain KYC documents
- `status` — `Active | Suspended | Revoked | Restricted`
- `expires_at` — Unix timestamp; credential renewal required on expiry
- `issued_at` · `updated_at`

**Instructions:**

```
issue_credential(params)      # Admin issues credential to wallet
renew_credential(expires, hash) # Extend validity + update attestation
revoke_credential()           # Permanently revoke — wallet blocked
restrict_credential()         # Restrict (AML hold) — blocks settlements
```

**PDA Derivation:**

```rust
seeds = [b"credential", wallet.key().as_ref()]
```

---

### 2. `vault_program` — KYC-Gated Yield Vaults

Permissioned yield strategy vault. Checks the `compliance_registry` before allowing deposits or withdrawals — a wallet without an `Active` credential cannot interact with vault funds.

**Account structures:**

- `VaultStrategy` — strategy configuration (APY, min tier, jurisdiction allowlist, TVL cap)
- `VaultPosition` — per-wallet deposit record (deposited amount, shares, accrued yield)

**Instructions:**

```
initialize_strategy(params)   # Admin creates a new yield strategy
deposit(amount)               # Institution deposits USDC into strategy
                              # → checks ComplianceCredential is Active
                              # → checks wallet tier >= strategy.min_tier
withdraw(amount)              # Withdraw deposits + yield
                              # → checks credential still Active
```

**Compliance enforcement:**
Every `deposit` and `withdraw` instruction cross-program-invokes (CPI) into `compliance_registry` to verify `status == Active` and `tier >= min_tier`. If the check fails, the transaction is rejected at the program level with `ComplianceError::CredentialNotActive`.

---

### 3. `settlement_engine` — Cross-Border Settlement with Travel Rule

Handles atomic cross-border USDC settlements between two institutions. Enforces Travel Rule compliance by requiring a signed `travel_rule_hash` — a 32-byte hash of the FATF Travel Rule payload that must be submitted alongside every settlement above threshold.

**Account structures:**

- `SettlementRecord` — immutable on-chain record of a settlement

**Fields:**

- `initiator` · `receiver` — institution wallet public keys
- `amount` — USDC lamports
- `status` — `Pending | Completed | Cancelled | Failed`
- `travel_rule_hash` — 32-byte hash of the Travel Rule JSON payload (stored in backend DB)
- `compliance_hash` — combined hash of both institutions' credential states at settlement time
- `created_at` · `completed_at`

**Instructions:**

```
initiate_settlement(params)   # Creates SettlementRecord
                              # → verifies initiator credential Active
                              # → verifies receiver credential Active
                              # → requires travel_rule_hash if amount >= threshold
confirm_settlement()          # Finalises — marks Completed, records timestamp
cancel_settlement()           # Cancels — marks Cancelled
```

**Travel Rule enforcement:**

```rust
if params.amount >= TRAVEL_RULE_THRESHOLD_LAMPORTS {
    require!(
        params.travel_rule_hash != [0u8; 32],
        SettlementError::TravelRulePayloadMissing
    );
}
```

---

## Architecture

```
Institution Wallet A
        │
        ▼
settlement_engine::initiate_settlement
        │
        ├── CPI → compliance_registry (check wallet A: Active?)
        ├── CPI → compliance_registry (check wallet B: Active?)
        ├── Require travel_rule_hash ≠ [0u8; 32] if amount ≥ threshold
        │
        ▼
SettlementRecord PDA created on-chain
        │
        ▼
Backend confirms → settlement_engine::confirm_settlement
        │
        ▼
Settlement status: Completed — verifiable on Solana Explorer
```

---

## Deployment

The programs are structured for **Solana Playground** deployment (single-crate, `lib.rs` imports all three modules):

1. Go to [beta.solpg.io](https://beta.solpg.io)
2. Import the `programs/vaultox/src/` files
3. Connect devnet wallet with ≥ 2 SOL
4. Deploy — copy the Program ID shown
5. Update `Anchor.toml` `[programs.devnet]` with the real IDs
6. Update `backend/.env` `PROGRAM_ID` and regenerate the IDL in `backend/src/solana/idl/`

### Get devnet SOL

```bash
solana config set --url devnet
solana airdrop 2
```

---

## IDL

After deployment, the IDL (`vaultox.json`) is available at:

- `backend/src/solana/idl/vaultox.json` — used by the NestJS backend
- `frontend/lib/idl.json` — used by the Next.js frontend for client-side tx building

Both files must be updated after any program redeployment.

---

## Error Codes

| Code                       | Program             | Meaning                                                 |
| -------------------------- | ------------------- | ------------------------------------------------------- |
| `CredentialNotActive`      | compliance_registry | Wallet credential is Suspended, Revoked, or Restricted  |
| `CredentialExpired`        | compliance_registry | Credential past `expires_at`                            |
| `TierInsufficient`         | vault_program       | Wallet tier below strategy `min_tier`                   |
| `TravelRulePayloadMissing` | settlement_engine   | Amount above threshold but no Travel Rule hash provided |
| `UnauthorizedParty`        | settlement_engine   | Caller is not initiator or designated authority         |
