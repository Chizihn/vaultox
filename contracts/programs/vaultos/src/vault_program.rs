// =============================================================================
// VaultOX — Vault Program
// =============================================================================
// Manages institutional yield strategies and position tracking.
// Institutions deposit USDC into strategies; yield accrues on-chain.
//
// PDAs:
//   VaultStrategy  — [b"strategy", strategy_id_bytes]
//   VaultPosition  — [b"position", wallet_bytes, strategy_pubkey_bytes]
//
// HACKATHON COMPLIANCE:
//   Only wallets with an active ComplianceCredential (from compliance_registry)
//   may deposit. Credential validated via cross-program invocation constraint.
// =============================================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::compliance_registry::{ComplianceCredential, CredentialStatus};

// ---------------------------------------------------------------------------
// Account Structs
// ---------------------------------------------------------------------------

/// A yield strategy offered on the platform (e.g., "USDC T-Bill 30D").
#[account]
pub struct VaultStrategy {
    /// Unique strategy identifier (e.g., SHA-256 of "usdc-t-bill-30d")
    pub id: [u8; 32],

    /// Human-readable name, null-padded to 64 bytes
    pub name: [u8; 64],

    /// Annual percentage yield in basis points. 485 = 4.85%
    pub apy_bps: u16,

    /// Minimum deposit in USDC micro-units (USDC = 6 decimals; 1 USDC = 1_000_000)
    pub min_deposit: u64,

    /// Maximum strategy capacity in USDC micro-units
    pub max_capacity: u64,

    /// Current total value locked in USDC micro-units
    pub current_tvl: u64,

    /// Risk tier:  1 = low  |  2 = medium  |  3 = high
    pub risk_tier: u8,

    /// Minimum lockup period in days (0 = no lockup)
    pub lockup_days: u16,

    /// Whether the strategy is accepting new deposits
    pub is_active: bool,

    /// The authority that can modify strategy parameters
    pub authority: Pubkey,

    /// USDC token account owned by this strategy (holds deposited funds)
    pub vault_token_account: Pubkey,

    /// PDA bump
    pub bump: u8,
}

impl VaultStrategy {
    pub const SPACE: usize = 8 + 32 + 64 + 2 + 8 + 8 + 8 + 1 + 2 + 1 + 32 + 32 + 1;
}

/// An institution's position in a specific strategy.
#[account]
pub struct VaultPosition {
    /// Owning institution wallet
    pub wallet: Pubkey,

    /// The strategy this position belongs to
    pub strategy: Pubkey,

    /// Total deposited amount in USDC micro-units
    pub deposited_amount: u64,

    /// Current value including accrued yield
    pub current_value: u64,

    /// Yield accrued but not yet realized
    pub accrued_yield: u64,

    /// Unix timestamp — when the position was opened
    pub opened_at: i64,

    /// Unix timestamp — last yield accrual update
    pub last_updated: i64,

    /// 0 = active  |  1 = withdrawing  |  2 = closed
    pub status: u8,

    /// PDA bump
    pub bump: u8,
}

impl VaultPosition {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

// ---------------------------------------------------------------------------
// Instruction Parameters
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StrategyParams {
    pub id: [u8; 32],
    pub name: [u8; 64],
    pub apy_bps: u16,
    pub min_deposit: u64,
    pub max_capacity: u64,
    pub risk_tier: u8,
    pub lockup_days: u16,
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(params: StrategyParams)]
pub struct InitializeStrategy<'info> {
    #[account(
        init,
        payer = authority,
        space = VaultStrategy::SPACE,
        seeds = [b"strategy", params.id.as_ref()],
        bump
    )]
    pub strategy: Account<'info, VaultStrategy>,

    /// The strategy's USDC token account (initialized separately before this call)
    /// CHECK: validated by token program constraints
    pub vault_token_account: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(
        mut,
        constraint = strategy.is_active @ VaultError::StrategyInactive,
        constraint = strategy.current_tvl + amount <= strategy.max_capacity @ VaultError::CapacityExceeded,
    )]
    pub strategy: Account<'info, VaultStrategy>,

    #[account(
        init_if_needed,
        payer = institution_wallet,
        space = VaultPosition::SPACE,
        seeds = [b"position", institution_wallet.key().as_ref(), strategy.key().as_ref()],
        bump
    )]
    pub position: Account<'info, VaultPosition>,

    /// Institution's USDC token account (source of funds)
    #[account(mut)]
    pub institution_token_account: Account<'info, TokenAccount>,

    /// Strategy vault token account (destination)
    #[account(
        mut,
        address = strategy.vault_token_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub institution_wallet: Signer<'info>,

    #[account(
        seeds = [b"credential", institution_wallet.key().as_ref()],
        bump = investor_credential.bump,
        constraint = investor_credential.status == CredentialStatus::Active as u8 @ VaultError::CredentialNotActive,
        constraint = (
            (investor_credential.tier == 1) ||
            (investor_credential.tier == 2 && strategy.risk_tier <= 2) ||
            (investor_credential.tier == 3 && strategy.risk_tier == 1)
        ) @ VaultError::TierTooLow,
    )]
    pub investor_credential: Account<'info, ComplianceCredential>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub strategy: Account<'info, VaultStrategy>,

    #[account(
        mut,
        seeds = [b"position", institution_wallet.key().as_ref(), strategy.key().as_ref()],
        bump = position.bump,
        constraint = position.wallet == institution_wallet.key() @ VaultError::Unauthorized,
        constraint = position.status == 0 @ VaultError::PositionNotActive,
    )]
    pub position: Account<'info, VaultPosition>,

    #[account(mut)]
    pub institution_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = strategy.vault_token_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub institution_wallet: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ProcessYield<'info> {
    #[account(mut)]
    pub strategy: Account<'info, VaultStrategy>,

    #[account(
        mut,
        seeds = [b"position", position.wallet.as_ref(), strategy.key().as_ref()],
        bump = position.bump,
        constraint = position.status == 0 @ VaultError::PositionNotActive,
    )]
    pub position: Account<'info, VaultPosition>,

    /// Only the strategy authority (server-side crank) can call this
    #[account(
        mut,
        constraint = authority.key() == strategy.authority @ VaultError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Instruction Handlers
// ---------------------------------------------------------------------------

pub mod handler {
    use super::*;

    /// Create a new yield strategy. Only callable by authority.
    pub fn initialize_strategy(
        ctx: Context<InitializeStrategy>,
        params: StrategyParams,
    ) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;

        strategy.id                  = params.id;
        strategy.name                = params.name;
        strategy.apy_bps             = params.apy_bps;
        strategy.min_deposit         = params.min_deposit;
        strategy.max_capacity        = params.max_capacity;
        strategy.current_tvl         = 0;
        strategy.risk_tier           = params.risk_tier;
        strategy.lockup_days         = params.lockup_days;
        strategy.is_active           = true;
        strategy.authority           = ctx.accounts.authority.key();
        strategy.vault_token_account = ctx.accounts.vault_token_account.key();
        strategy.bump                = ctx.bumps.strategy;

        emit!(StrategyInitialized {
            strategy: strategy.key(),
            name: strategy.name,
            apy_bps: strategy.apy_bps,
        });

        Ok(())
    }

    /// Deposit USDC into a strategy. Creates a position PDA if first deposit.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;
        let position = &mut ctx.accounts.position;
        let clock    = Clock::get()?;

        require!(amount >= strategy.min_deposit, VaultError::BelowMinimumDeposit);

        // Transfer USDC from institution → strategy vault
        let cpi_accounts = Transfer {
            from:      ctx.accounts.institution_token_account.to_account_info(),
            to:        ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.institution_wallet.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
        )?;

        // Update strategy TVL
        strategy.current_tvl = strategy.current_tvl.checked_add(amount)
            .ok_or(VaultError::Overflow)?;

        // Update or initialize position
        if position.deposited_amount == 0 {
            // First deposit — initialize position fields
            position.wallet           = ctx.accounts.institution_wallet.key();
            position.strategy         = strategy.key();
            position.opened_at        = clock.unix_timestamp;
            position.status           = 0;
            position.bump             = ctx.bumps.position;
        }
        position.deposited_amount = position.deposited_amount.checked_add(amount)
            .ok_or(VaultError::Overflow)?;
        position.current_value    = position.deposited_amount + position.accrued_yield;
        position.last_updated     = clock.unix_timestamp;

        emit!(DepositMade {
            wallet: position.wallet,
            strategy: strategy.key(),
            amount,
            new_tvl: strategy.current_tvl,
        });

        Ok(())
    }

    /// Withdraw USDC from a position.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;
        let position = &mut ctx.accounts.position;
        let clock    = Clock::get()?;

        require!(amount <= position.current_value, VaultError::InsufficientFunds);

        // Check lockup — if still in lockup period, reject
        if strategy.lockup_days > 0 {
            let lockup_end = position.opened_at
                + (strategy.lockup_days as i64 * 86_400);
            require!(
                clock.unix_timestamp >= lockup_end,
                VaultError::StillInLockup
            );
        }

        // Transfer from vault → institution
        // NOTE: Strategy PDA owns the vault_token_account
        let strategy_id = strategy.id;
        let bump = [strategy.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"strategy",
            strategy_id.as_ref(),
            &bump,
        ]];

        let cpi_accounts = Transfer {
            from:      ctx.accounts.vault_token_account.to_account_info(),
            to:        ctx.accounts.institution_token_account.to_account_info(),
            authority: strategy.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            amount,
        )?;

        strategy.current_tvl = strategy.current_tvl.saturating_sub(amount);
        position.current_value = position.current_value.saturating_sub(amount);
        if amount <= position.accrued_yield {
            position.accrued_yield = position.accrued_yield.saturating_sub(amount);
        } else {
            let remainder = amount - position.accrued_yield;
            position.accrued_yield = 0;
            position.deposited_amount = position.deposited_amount.saturating_sub(remainder);
        }
        position.last_updated = clock.unix_timestamp;

        if position.current_value == 0 {
            position.status = 2; // closed
        }

        emit!(WithdrawalMade {
            wallet: position.wallet,
            strategy: strategy.key(),
            amount,
        });

        Ok(())
    }

    /// Crank: accrue yield on a position. Called by server-side authority on schedule.
    pub fn process_yield(ctx: Context<ProcessYield>) -> Result<()> {
        let strategy = &ctx.accounts.strategy;
        let position = &mut ctx.accounts.position;
        let clock    = Clock::get()?;

        // Simple daily yield calculation (APY → daily rate)
        // daily_rate_bps = apy_bps / 365
        // yield_amount = deposited_amount * daily_rate_bps / 10_000
        let seconds_elapsed = clock.unix_timestamp - position.last_updated;
        if seconds_elapsed <= 0 {
            return Ok(()); // nothing to accrue
        }

        let daily_yield = (position.deposited_amount as u128)
            .checked_mul(strategy.apy_bps as u128)
            .ok_or(VaultError::Overflow)?
            .checked_div(365 * 10_000)
            .ok_or(VaultError::Overflow)? as u64;

        let days_elapsed = (seconds_elapsed / 86_400) as u64;
        let accrued      = daily_yield.saturating_mul(days_elapsed);

        position.accrued_yield   = position.accrued_yield.saturating_add(accrued);
        position.current_value   = position.deposited_amount + position.accrued_yield;
        position.last_updated    = clock.unix_timestamp;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct StrategyInitialized {
    pub strategy: Pubkey,
    pub name: [u8; 64],
    pub apy_bps: u16,
}

#[event]
pub struct DepositMade {
    pub wallet: Pubkey,
    pub strategy: Pubkey,
    pub amount: u64,
    pub new_tvl: u64,
}

#[event]
pub struct WithdrawalMade {
    pub wallet: Pubkey,
    pub strategy: Pubkey,
    pub amount: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum VaultError {
    #[msg("Strategy is not currently accepting deposits")]
    StrategyInactive,
    #[msg("Deposit would exceed strategy capacity")]
    CapacityExceeded,
    #[msg("Amount is below the strategy minimum deposit")]
    BelowMinimumDeposit,
    #[msg("Insufficient funds in position")]
    InsufficientFunds,
    #[msg("Position is still within the lockup period")]
    StillInLockup,
    #[msg("Position is not in active state")]
    PositionNotActive,
    #[msg("Unauthorized caller")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Institution credential is not active")]
    CredentialNotActive,
    #[msg("Institution tier is too low for this strategy")]
    TierTooLow,
}
