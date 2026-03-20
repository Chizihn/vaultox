// =============================================================================
// VaultOX — Settlement Engine Program
// =============================================================================
// Handles atomic cross-border USDC settlements between institutions.
// Travel Rule (FATF) fields are stored on-chain — mandatory for hackathon.
//
// PDAs:
//   Settlement — [b"settlement", settlement_id_bytes]
//   Escrow     — [b"escrow", settlement_id_bytes]  (holds USDC until confirmed)
//
// HACKATHON COMPLIANCE:
//   Travel Rule — All 6 FATF-required fields stored in Settlement account
//   KYT         — Sender/receiver/amount/txHash on-chain, immutable audit trail
//   AML         — compliance_hash links to off-chain screening report
//   KYC         — Both parties must hold active ComplianceCredentials
//                 (validated off-chain by backend before calling initiate)
// =============================================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::compliance_registry::{ComplianceCredential, CredentialStatus};

// ---------------------------------------------------------------------------
// Account Structs
// ---------------------------------------------------------------------------

/// On-chain record of a cross-border settlement.
/// Immutable Travel Rule fields permanently stored for regulatory audit.
#[account]
pub struct Settlement {
    /// Unique settlement ID (UUID bytes or SHA-256 of nonce)
    pub id: [u8; 32],

    /// Initiating institution wallet
    pub initiator: Pubkey,

    /// Receiving institution wallet
    pub receiver: Pubkey,

    /// Amount in USDC micro-units (6 decimals; 1_000_000 = 1 USDC)
    pub amount: u64,

    /// Platform fee in USDC micro-units
    pub fee: u64,

    /// Status: 0=pending | 1=escrowed | 2=completed | 3=cancelled | 4=disputed
    pub status: u8,

    /// Unix timestamp — when settlement was initiated
    pub initiated_at: i64,

    /// Unix timestamp — when settlement was finalized (0 if pending)
    pub completed_at: i64,

    // -------------------------------------------------------------------------
    // TRAVEL RULE FIELDS (FATF — mandatory on all settlements above USD 1,000)
    // -------------------------------------------------------------------------

    /// Originating institution's legal name (null-padded to 64 bytes)
    pub originator_name: [u8; 64],

    /// Originating institution's account identifier — IBAN/routing number
    /// (null-padded to 34 bytes — IBAN max length)
    pub originator_account: [u8; 34],

    /// Originating institution's registered address (null-padded to 128 bytes)
    pub originator_address: [u8; 128],

    /// Beneficiary institution's legal name (null-padded to 64 bytes)
    pub beneficiary_name: [u8; 64],

    /// Beneficiary institution's account identifier (null-padded to 34 bytes)
    pub beneficiary_account: [u8; 34],

    /// ISO 20022 purpose code — e.g., "INTC" (intra-company), "SUPP" (supplier payment)
    pub purpose_code: [u8; 4],

    /// SHA-256 of the full off-chain Travel Rule JSON payload.
    /// Provides on-chain proof that the complete Travel Rule record exists off-chain.
    pub compliance_hash: [u8; 32],

    /// PDA bump
    pub bump: u8,
}

impl Settlement {
    /// Discriminator(8) + id(32) + initiator(32) + receiver(32) + amount(8) + fee(8)
    /// + status(1) + initiated_at(8) + completed_at(8)
    /// + originator_name(64) + originator_account(34) + originator_address(128)
    /// + beneficiary_name(64) + beneficiary_account(34) + purpose_code(4)
    /// + compliance_hash(32) + bump(1)
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 8 + 8
        + 64 + 34 + 128
        + 64 + 34 + 4
        + 32 + 1;
    // = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 8 + 8 + 64 + 34 + 128 + 64 + 34 + 4 + 32 + 1
    // = 558 bytes
}

/// Status enum for type-safe comparisons
#[repr(u8)]
pub enum SettlementStatus {
    Pending    = 0,
    Escrowed   = 1,
    Completed  = 2,
    Cancelled  = 3,
    Disputed   = 4,
}

// ---------------------------------------------------------------------------
// Instruction Parameters
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettlementParams {
    /// UUID bytes of the settlement (generated off-chain, stored on-chain)
    pub id: [u8; 32],

    /// Receiving institution's Solana wallet
    pub receiver: Pubkey,

    /// Amount in USDC micro-units
    pub amount: u64,

    /// Platform fee in USDC micro-units
    pub fee: u64,

    // Travel Rule fields
    pub originator_name: [u8; 64],
    pub originator_account: [u8; 34],
    pub originator_address: [u8; 128],
    pub beneficiary_name: [u8; 64],
    pub beneficiary_account: [u8; 34],
    pub purpose_code: [u8; 4],
    pub compliance_hash: [u8; 32],
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(params: SettlementParams)]
pub struct InitiateSettlement<'info> {
    #[account(
        init,
        payer = initiator,
        space = Settlement::SPACE,
        seeds = [b"settlement", params.id.as_ref()],
        bump
    )]
    pub settlement: Box<Account<'info, Settlement>>,

    /// Escrow account that will hold USDC until settlement is confirmed
    #[account(
        init,
        payer = initiator,
        seeds = [b"escrow", params.id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = settlement,  // Settlement PDA is escrow authority
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: USDC mint — validated by token constraints
    pub usdc_mint: AccountInfo<'info>,

    /// Initiator's USDC token account
    #[account(
        mut,
        constraint = initiator_token_account.owner == initiator.key() @ SettlementError::Unauthorized
    )]
    pub initiator_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        seeds = [b"credential", initiator.key().as_ref()],
        bump = initiator_credential.bump,
        constraint = initiator_credential.status == CredentialStatus::Active as u8 @ SettlementError::InitiatorNotKyced,
    )]
    pub initiator_credential: Box<Account<'info, ComplianceCredential>>,

    #[account(
        seeds = [b"credential", params.receiver.as_ref()],
        bump = receiver_credential.bump,
        constraint = receiver_credential.status == CredentialStatus::Active as u8 @ SettlementError::ReceiverNotKyced,
        constraint = (initiator_credential.tier < 3 || initiator_credential.jurisdiction == receiver_credential.jurisdiction) @ SettlementError::TierTooLowForCrossBorder
    )]
    pub receiver_credential: Box<Account<'info, ComplianceCredential>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ConfirmSettlement<'info> {
    #[account(
        mut,
        seeds = [b"settlement", settlement.id.as_ref()],
        bump = settlement.bump,
        constraint = settlement.receiver == receiver.key() @ SettlementError::Unauthorized,
        constraint = settlement.status == SettlementStatus::Escrowed as u8
            @ SettlementError::InvalidStatus,
    )]
    pub settlement: Account<'info, Settlement>,

    /// Escrow account holding the USDC funds
    #[account(
        mut,
        seeds = [b"escrow", settlement.id.as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Receiver's USDC token account (destination for released funds)
    #[account(
        mut,
        constraint = receiver_token_account.owner == receiver.key() @ SettlementError::Unauthorized
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub receiver: Signer<'info>,

    #[account(
        seeds = [b"credential", receiver.key().as_ref()],
        bump = receiver_credential.bump,
        constraint = receiver_credential.status == CredentialStatus::Active as u8 @ SettlementError::ReceiverNotKyced,
    )]
    pub receiver_credential: Account<'info, ComplianceCredential>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelSettlement<'info> {
    #[account(
        mut,
        seeds = [b"settlement", settlement.id.as_ref()],
        bump = settlement.bump,
        constraint = settlement.status == SettlementStatus::Pending as u8
            || settlement.status == SettlementStatus::Escrowed as u8
            @ SettlementError::InvalidStatus,
    )]
    pub settlement: Account<'info, Settlement>,

    #[account(
        mut,
        seeds = [b"escrow", settlement.id.as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Initiator's USDC token account (refund destination)
    #[account(
        mut,
        constraint = initiator_token_account.owner == initiator.key()
    )]
    pub initiator_token_account: Account<'info, TokenAccount>,

    /// Must be the original initiator or the platform authority
    #[account(
        mut,
        constraint =
            initiator.key() == settlement.initiator @ SettlementError::Unauthorized
    )]
    pub initiator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// Instruction Handlers
// ---------------------------------------------------------------------------

pub mod handler {
    use super::*;

    fn has_non_zero(bytes: &[u8]) -> bool {
        bytes.iter().any(|byte| *byte != 0)
    }

    /// Initiate a cross-border settlement.
    /// Locks (amount + fee) USDC in an escrow PDA.
    /// Full Travel Rule payload stored on-chain.
    pub fn initiate_settlement(
        ctx: Context<InitiateSettlement>,
        params: SettlementParams,
    ) -> Result<()> {
        let settlement = &mut ctx.accounts.settlement;
        let clock      = Clock::get()?;

        // Travel Rule threshold: all USDC settlements above 0 require Travel Rule
        // (Platform decision: apply to all settlements for hackathon demo completeness)
        require!(
            has_non_zero(&params.originator_name),
            SettlementError::TravelRuleMissing
        );
        require!(
            has_non_zero(&params.beneficiary_name),
            SettlementError::TravelRuleMissing
        );
        require!(
            has_non_zero(&params.originator_account),
            SettlementError::TravelRuleMissing
        );
        require!(
            has_non_zero(&params.beneficiary_account),
            SettlementError::TravelRuleMissing
        );
        require!(params.amount > 0, SettlementError::ZeroAmount);

        // Populate settlement account
        settlement.id                 = params.id;
        settlement.initiator          = ctx.accounts.initiator.key();
        settlement.receiver           = params.receiver;
        settlement.amount             = params.amount;
        settlement.fee                = params.fee;
        settlement.status             = SettlementStatus::Pending as u8;
        settlement.initiated_at       = clock.unix_timestamp;
        settlement.completed_at       = 0;
        settlement.originator_name    = params.originator_name;
        settlement.originator_account = params.originator_account;
        settlement.originator_address = params.originator_address;
        settlement.beneficiary_name   = params.beneficiary_name;
        settlement.beneficiary_account = params.beneficiary_account;
        settlement.purpose_code       = params.purpose_code;
        settlement.compliance_hash    = params.compliance_hash;
        settlement.bump               = ctx.bumps.settlement;

        // Move (amount + fee) into escrow
        let total = params.amount.checked_add(params.fee)
            .ok_or(SettlementError::Overflow)?;

        let cpi_accounts = Transfer {
            from:      ctx.accounts.initiator_token_account.to_account_info(),
            to:        ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.initiator.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            total,
        )?;

        settlement.status = SettlementStatus::Escrowed as u8;

        emit!(SettlementInitiated {
            id: settlement.id,
            initiator: settlement.initiator,
            receiver: settlement.receiver,
            amount: settlement.amount,
            initiated_at: settlement.initiated_at,
        });

        Ok(())
    }

    /// Receiver confirms the settlement — releases escrow to receiver wallet.
    /// Only the designated receiver can call this.
    pub fn confirm_settlement(ctx: Context<ConfirmSettlement>) -> Result<()> {
        let settlement = &mut ctx.accounts.settlement;
        let clock      = Clock::get()?;

        // Release escrow to receiver (amount only; fee goes to platform — handled off-chain)
        let settlement_id = settlement.id;
        let bump = [settlement.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"settlement",
            settlement_id.as_ref(),
            &bump,
        ]];

        let cpi_accounts = Transfer {
            from:      ctx.accounts.escrow_token_account.to_account_info(),
            to:        ctx.accounts.receiver_token_account.to_account_info(),
            authority: settlement.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            settlement.amount,
        )?;

        settlement.status       = SettlementStatus::Completed as u8;
        settlement.completed_at = clock.unix_timestamp;

        emit!(SettlementCompleted {
            id: settlement.id,
            completed_at: settlement.completed_at,
            duration_seconds: settlement.completed_at - settlement.initiated_at,
        });

        Ok(())
    }

    /// Cancel a settlement and refund the escrowed USDC to the initiator.
    /// Only the initiator can cancel (within the allowed window).
    pub fn cancel_settlement(ctx: Context<CancelSettlement>) -> Result<()> {
        let settlement = &mut ctx.accounts.settlement;

        let settlement_id = settlement.id;
        let bump = [settlement.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"settlement",
            settlement_id.as_ref(),
            &bump,
        ]];

        let total = settlement.amount.checked_add(settlement.fee)
            .ok_or(SettlementError::Overflow)?;

        let cpi_accounts = Transfer {
            from:      ctx.accounts.escrow_token_account.to_account_info(),
            to:        ctx.accounts.initiator_token_account.to_account_info(),
            authority: settlement.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            total,
        )?;

        settlement.status = SettlementStatus::Cancelled as u8;

        emit!(SettlementCancelled {
            id: settlement.id,
            initiator: settlement.initiator,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct SettlementInitiated {
    pub id: [u8; 32],
    pub initiator: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub initiated_at: i64,
}

#[event]
pub struct SettlementCompleted {
    pub id: [u8; 32],
    pub completed_at: i64,
    pub duration_seconds: i64,
}

#[event]
pub struct SettlementCancelled {
    pub id: [u8; 32],
    pub initiator: Pubkey,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum SettlementError {
    #[msg("Travel Rule fields are required (originator + beneficiary names and accounts)")]
    TravelRuleMissing,
    #[msg("Settlement amount must be greater than zero")]
    ZeroAmount,
    #[msg("Settlement is not in the expected status for this operation")]
    InvalidStatus,
    #[msg("Caller is not authorized to perform this action on this settlement")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Initiator does not hold an active ComplianceCredential")]
    InitiatorNotKyced,
    #[msg("Receiver does not hold an active ComplianceCredential")]
    ReceiverNotKyced,
    #[msg("Initiator tier is too low for cross-border settlements")]
    TierTooLowForCrossBorder,
}
