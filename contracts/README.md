# VaultOX Contracts

Anchor workspace for the on-chain primitives used by VaultOX.

> **StableHacks 2026 Submission**
> - **Core Track**: Cross-Border Stablecoin Treasury
> - **Additional Implementations**: Institutional Permissioned DeFi Vaults

## Scope

Current on-chain model centers around compliance-gated treasury primitives referenced by backend transaction builders and IDL-driven clients.

## Structure

```text
contracts/
├── Anchor.toml
├── programs/
│   └── vaultos/
└── package.json
```

## Local usage

```bash
npm install
npm run test
```

## Integration notes

- Backend reads IDL to build/serialize transactions for clients.
- Frontend signs user-owned transactions that backend assembles.
- Program IDs and deployed addresses must stay in sync with backend/frontend IDL configuration.

## Operational guardrails

- Treat deployment updates as coordinated changes across:
  - contracts/Anchor.toml
  - backend/src/solana/idl/vaultox.json
  - frontend/lib/idl.json
- Validate end-to-end tx flow after any program redeploy.

## Truth boundary

This repo currently does not include direct Solstice program integration as a required runtime dependency for core VaultOX flows.
