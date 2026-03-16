use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// VaultOX — Solana Anchor Programs (single-file entry for Solana Playground)
// ---------------------------------------------------------------------------
// This file wires together three logical programs into one crate for
// Solana Playground compatibility. When deploying with a full Anchor toolchain,
// split each module into its own `programs/<name>` directory.
//
// PROGRAMS:
//   1. ComplianceRegistry  — soulbound KYC/AML credentials
//   2. VaultProgram        — yield strategy deposits/withdrawals
//   3. SettlementEngine    — atomic cross-border USDC settlements (Travel Rule)
// ---------------------------------------------------------------------------

pub mod compliance_registry;
pub mod vault_program;
pub mod settlement_engine;

// Import all to avoid standard module scope issues within #[program] Context resolving.
use compliance_registry::*;
use vault_program::*;
use settlement_engine::*;

declare_id!("VauLtOS1111111111111111111111111111111111111");

#[program]
pub mod vaultox {
    use super::*;

    // ---- Compliance Registry -----------------------------------------------

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        params: CredentialParams,
    ) -> Result<()> {
        compliance_registry::handler::issue_credential(ctx, params)
    }

    pub fn renew_credential(
        ctx: Context<RenewCredential>,
        new_expires_at: i64,
        new_attestation_hash: [u8; 32],
    ) -> Result<()> {
        compliance_registry::handler::renew_credential(ctx, new_expires_at, new_attestation_hash)
    }

    pub fn revoke_credential(ctx: Context<ModifyCredential>) -> Result<()> {
        compliance_registry::handler::revoke_credential(ctx)
    }

    pub fn restrict_credential(ctx: Context<ModifyCredential>) -> Result<()> {
        compliance_registry::handler::restrict_credential(ctx)
    }

    // ---- Vault Program -----------------------------------------------------

    pub fn initialize_strategy(
        ctx: Context<InitializeStrategy>,
        params: StrategyParams,
    ) -> Result<()> {
        vault_program::handler::initialize_strategy(ctx, params)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        vault_program::handler::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        vault_program::handler::withdraw(ctx, amount)
    }

    pub fn process_yield(ctx: Context<ProcessYield>) -> Result<()> {
        vault_program::handler::process_yield(ctx)
    }

    // ---- Settlement Engine -------------------------------------------------

    pub fn initiate_settlement(
        ctx: Context<InitiateSettlement>,
        params: SettlementParams,
    ) -> Result<()> {
        settlement_engine::handler::initiate_settlement(ctx, params)
    }

    pub fn confirm_settlement(ctx: Context<ConfirmSettlement>) -> Result<()> {
        settlement_engine::handler::confirm_settlement(ctx)
    }

    pub fn cancel_settlement(ctx: Context<CancelSettlement>) -> Result<()> {
        settlement_engine::handler::cancel_settlement(ctx)
    }
}
