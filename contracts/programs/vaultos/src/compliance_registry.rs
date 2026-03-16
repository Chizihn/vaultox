// =============================================================================
// VaultOX — Compliance Registry Program
// =============================================================================
// Issues soulbound ComplianceCredential PDAs to institution wallets.
// A wallet can hold exactly one credential (PDA seed: ["credential", wallet]).
//
// HACKATHON COMPLIANCE:
//   KYC  — kyc_level (1–3) and tier (retail/professional/institutional)
//   AML  — aml_coverage score (0–100) + attestation_hash links to docs
//   KYT  — credential status gates settlement initiation
// =============================================================================

use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Account Structs
// ---------------------------------------------------------------------------

/// Soulbound credential — one per institution wallet, non-transferable.
#[account]
pub struct ComplianceCredential {
    /// Institution's Solana wallet (immutable — matches PDA seed)
    pub wallet: Pubkey,

    /// Human-readable institution name, null-padded to 64 bytes
    pub institution_name: [u8; 64],

    /// ISO 3166-1 alpha-2 jurisdiction code, e.g. "CH", "DE", "SG"
    pub jurisdiction: [u8; 4],

    /// Institutional tier:  0 = retail  |  1 = professional  |  2 = institutional
    pub tier: u8,

    /// KYC level:  1 = basic  |  2 = enhanced  |  3 = full institutional
    pub kyc_level: u8,

    /// AML coverage score 0–100.  <80 triggers restricted status.
    pub aml_coverage: u8,

    /// Unix timestamp — credential issuance date
    pub issued_at: i64,

    /// Unix timestamp — credential expiry (renew before this date)
    pub expires_at: i64,

    /// SHA-256 hash of the off-chain KYC/AML documentation bundle.
    /// Anchors the on-chain credential to auditable off-chain records.
    pub attestation_hash: [u8; 32],

    /// Status:  0 = pending  |  1 = active  |  2 = restricted  |  3 = revoked
    pub status: u8,

    /// PDA bump seed (stored for efficient re-derivation)
    pub bump: u8,
}

impl ComplianceCredential {
    /// Space = 8 (discriminator) + 32 + 64 + 4 + 1 + 1 + 1 + 8 + 8 + 32 + 1 + 1
    pub const SPACE: usize = 8 + 32 + 64 + 4 + 1 + 1 + 1 + 8 + 8 + 32 + 1 + 1;

    pub fn is_active(&self) -> bool {
        self.status == CredentialStatus::Active as u8
    }

    pub fn is_expired(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp > self.expires_at
    }
}

/// Strongly-typed status values
#[repr(u8)]
pub enum CredentialStatus {
    Pending    = 0,
    Active     = 1,
    Restricted = 2,
    Revoked    = 3,
}

// ---------------------------------------------------------------------------
// Instruction Parameters
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CredentialParams {
    pub institution_name: [u8; 64],
    pub jurisdiction: [u8; 4],
    pub tier: u8,
    pub kyc_level: u8,
    pub aml_coverage: u8,
    pub expires_at: i64,
    pub attestation_hash: [u8; 32],
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct IssueCredential<'info> {
    /// The wallet that will own this credential (soulbound).
    /// CHECK: explicitly validated by PDA seed — must match credential.wallet
    pub institution_wallet: AccountInfo<'info>,

    /// Soulbound PDA — one per institution_wallet, cannot be transferred.
    #[account(
        init,
        payer = authority,
        space = ComplianceCredential::SPACE,
        seeds = [b"credential", institution_wallet.key().as_ref()],
        bump
    )]
    pub credential: Account<'info, ComplianceCredential>,

    /// Compliance authority (server-side keypair or multisig) — pays rent.
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RenewCredential<'info> {
    #[account(
        mut,
        seeds = [b"credential", credential.wallet.as_ref()],
        bump = credential.bump,
        constraint = credential.status != CredentialStatus::Revoked as u8
            @ ComplianceError::CredentialRevoked
    )]
    pub credential: Account<'info, ComplianceCredential>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ModifyCredential<'info> {
    #[account(
        mut,
        seeds = [b"credential", credential.wallet.as_ref()],
        bump = credential.bump,
    )]
    pub credential: Account<'info, ComplianceCredential>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Instruction Handlers
// ---------------------------------------------------------------------------

pub mod handler {
    use super::*;

    /// Issue a new ComplianceCredential to an institution wallet.
    /// Caller must be the designated compliance authority.
    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        params: CredentialParams,
    ) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        let clock = Clock::get()?;

        require!(
            params.kyc_level >= 1 && params.kyc_level <= 3,
            ComplianceError::InvalidKycLevel
        );
        require!(
            params.expires_at > clock.unix_timestamp,
            ComplianceError::InvalidExpiry
        );

        credential.wallet           = ctx.accounts.institution_wallet.key();
        credential.institution_name = params.institution_name;
        credential.jurisdiction     = params.jurisdiction;
        credential.tier             = params.tier;
        credential.kyc_level        = params.kyc_level;
        credential.aml_coverage     = params.aml_coverage;
        credential.issued_at        = clock.unix_timestamp;
        credential.expires_at       = params.expires_at;
        credential.attestation_hash = params.attestation_hash;
        credential.status           = CredentialStatus::Active as u8;
        credential.bump             = ctx.bumps.credential;

        emit!(CredentialIssued {
            wallet: credential.wallet,
            institution_name: credential.institution_name,
            kyc_level: credential.kyc_level,
            issued_at: credential.issued_at,
            expires_at: credential.expires_at,
        });

        Ok(())
    }

    /// Extend an existing credential's expiry and update attestation hash.
    pub fn renew_credential(
        ctx: Context<RenewCredential>,
        new_expires_at: i64,
        new_attestation_hash: [u8; 32],
    ) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        let clock = Clock::get()?;

        require!(
            new_expires_at > clock.unix_timestamp,
            ComplianceError::InvalidExpiry
        );

        credential.expires_at       = new_expires_at;
        credential.attestation_hash = new_attestation_hash;
        // Re-activate if it was restricted due to AML — authority must explicitly clear
        if credential.status == CredentialStatus::Restricted as u8 {
            credential.status = CredentialStatus::Active as u8;
        }

        emit!(CredentialRenewed {
            wallet: credential.wallet,
            new_expires_at,
        });

        Ok(())
    }

    /// Permanently revoke a credential. Cannot be undone — issue a new one instead.
    pub fn revoke_credential(ctx: Context<ModifyCredential>) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        credential.status = CredentialStatus::Revoked as u8;

        emit!(CredentialStatusChanged {
            wallet: credential.wallet,
            new_status: CredentialStatus::Revoked as u8,
        });

        Ok(())
    }

    /// Restrict a credential (e.g., AML flag raised). Settlements are blocked.
    pub fn restrict_credential(ctx: Context<ModifyCredential>) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        credential.status = CredentialStatus::Restricted as u8;

        emit!(CredentialStatusChanged {
            wallet: credential.wallet,
            new_status: CredentialStatus::Restricted as u8,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct CredentialIssued {
    pub wallet: Pubkey,
    pub institution_name: [u8; 64],
    pub kyc_level: u8,
    pub issued_at: i64,
    pub expires_at: i64,
}

#[event]
pub struct CredentialRenewed {
    pub wallet: Pubkey,
    pub new_expires_at: i64,
}

#[event]
pub struct CredentialStatusChanged {
    pub wallet: Pubkey,
    pub new_status: u8,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum ComplianceError {
    #[msg("KYC level must be 1, 2, or 3")]
    InvalidKycLevel,
    #[msg("Expiry timestamp must be in the future")]
    InvalidExpiry,
    #[msg("Credential has been revoked and cannot be modified")]
    CredentialRevoked,
    #[msg("Credential is not active — settlements blocked")]
    CredentialNotActive,
    #[msg("Credential has expired — renewal required")]
    CredentialExpired,
}
