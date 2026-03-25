import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { SolsticeService } from "../solstice/solstice.service";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  SendTransactionError,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PrismaService } from "../prisma/prisma.service";
import * as nacl from "tweetnacl";

type ComplianceTier = 1 | 2 | 3;

export type VaultTransactionStatus = {
  signature: string;
  status: "submitted" | "confirmed" | "finalized" | "failed" | "unknown";
  confirmationStatus: string;
  slot: number | null;
  confirmations: number | null;
  error: unknown;
};

@Injectable()
export class VaultsService {
  private static readonly SOLSTICE_LIQUIDITY_ID = "solstice-liquidity";
  private static readonly SOLSTICE_YIELD_ID = "solstice-yield-vault";
  private static readonly SOLSTICE_COMPOUNDING_ID = "solstice-compounding";
  private static readonly SOLSTICE_POSITION_ID = "solstice-eusx-position";
  private static readonly SOLSTICE_LIQUIDITY_POSITION_ID = "solstice-usx-position";

  private readonly logger = new Logger(VaultsService.name);

  /** All Solstice strategy IDs */
  private static readonly SOLSTICE_IDS = new Set([
    VaultsService.SOLSTICE_LIQUIDITY_ID,
    VaultsService.SOLSTICE_YIELD_ID,
    VaultsService.SOLSTICE_COMPOUNDING_ID,
  ]);

  private isSolsticeStrategy(id: string): boolean {
    return VaultsService.SOLSTICE_IDS.has(id);
  }

  private getSolsticeStrategies() {
    const baseTvl = Number(process.env.SOLSTICE_DISPLAY_TVL ?? "2500000");
    return [
      {
        id: VaultsService.SOLSTICE_LIQUIDITY_ID,
        name: "Solstice Liquidity",
        description:
          "Conservative USX hold — USDC minted to USX without yield-vault lock. Instant withdrawal, maximum liquidity. Ideal for treasury float.",
        apy: Number(process.env.SOLSTICE_LIQUIDITY_APY ?? "2.10"),
        apyBps: Math.round(Number(process.env.SOLSTICE_LIQUIDITY_APY ?? "2.10") * 100),
        minDepositUsdc: 1,
        maxCapacityUsdc: Number.MAX_SAFE_INTEGER,
        currentTvl: baseTvl * 0.4,
        tvl: baseTvl * 0.4,
        riskTier: 1,
        riskRating: "Low" as const,
        minTier: 3 as ComplianceTier,
        lockupDays: 0,
        isActive: true,
        jurisdictions: [],
        maturity: "Instant withdrawal",
        category: "rwa",
        sparklineData: [],
      },
      {
        id: VaultsService.SOLSTICE_YIELD_ID,
        name: "Solstice Yield Vault",
        description:
          "Balanced strategy — USDC → USX → eUSX yield vault lock via Solstice. Yield accrues on eUSX with 24h unlock period.",
        apy: Number(process.env.SOLSTICE_DISPLAY_APY ?? "4.80"),
        apyBps: Math.round(Number(process.env.SOLSTICE_DISPLAY_APY ?? "4.80") * 100),
        minDepositUsdc: 1,
        maxCapacityUsdc: Number.MAX_SAFE_INTEGER,
        currentTvl: baseTvl * 0.45,
        tvl: baseTvl * 0.45,
        riskTier: 1,
        riskRating: "Low" as const,
        minTier: 3 as ComplianceTier,
        lockupDays: 1,
        isActive: true,
        jurisdictions: [],
        maturity: "24h unlock period",
        category: "rwa",
        sparklineData: [],
      },
      {
        id: VaultsService.SOLSTICE_COMPOUNDING_ID,
        name: "Solstice Compounding",
        description:
          "Aggressive auto-compound strategy — same eUSX vault with periodic yield re-lock for higher effective APY. 7-day lockup period.",
        apy: Number(process.env.SOLSTICE_COMPOUNDING_APY ?? "5.90"),
        apyBps: Math.round(Number(process.env.SOLSTICE_COMPOUNDING_APY ?? "5.90") * 100),
        minDepositUsdc: 100,
        maxCapacityUsdc: Number.MAX_SAFE_INTEGER,
        currentTvl: baseTvl * 0.15,
        tvl: baseTvl * 0.15,
        riskTier: 2,
        riskRating: "Medium" as const,
        minTier: 2 as ComplianceTier,
        lockupDays: 7,
        isActive: true,
        jurisdictions: [],
        maturity: "7-day lockup period",
        category: "rwa",
        sparklineData: [],
      },
    ];
  }

  constructor(
    private readonly solanaService: SolanaService,
    private readonly complianceService: ComplianceService,
    private readonly solsticeService: SolsticeService,
    private readonly prisma: PrismaService,
  ) {}

  private asObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  async createStrategy(data: any) {
    return this.solanaService.initializeVaultStrategy({
      name: data.name,
      apyBps: Number(data.apyBps),
      minDeposit: data.minDeposit,
      maxCapacity: data.maxCapacity,
      riskTier: Number(data.riskTier),
      lockupDays: Number(data.lockupDays),
    });
  }

  async getStrategies(walletAddress: string) {
    const _walletAddress = walletAddress;
    const strategies = await this.solanaService.getVaultStrategies();

    const onChainStrategies = strategies.map((s) => ({
      id: s.publicKey.toBase58(),
      name: Buffer.from(s.account.name).toString("utf8").replace(/\0/g, ""),
      description: `${Buffer.from(s.account.name).toString("utf8").replace(/\0/g, "")} institutional strategy backed by regulated assets.`,
      apy: Number(s.account.apyBps) / 100,
      apyBps: Number(s.account.apyBps),
      minDepositUsdc: s.account.minDeposit.toNumber() / 1_000_000,
      maxCapacityUsdc: s.account.maxCapacity.toNumber() / 1_000_000,
      currentTvl: s.account.currentTvl.toNumber() / 1_000_000,
      tvl: s.account.currentTvl.toNumber() / 1_000_000,
      riskTier: s.account.riskTier,
      riskRating:
        s.account.riskTier === 1
          ? "Low"
          : s.account.riskTier === 2
            ? "Medium"
            : "High",
      // Mapping risk tier to min compliance tier required:
      // Risk 1 (Low)    -> Accessible to Tier 3+ (Everyone)
      // Risk 2 (Medium) -> Accessible to Tier 2+
      // Risk 3 (High)   -> Accessible to Tier 1 Only
      minTier: (s.account.riskTier === 1
        ? 3
        : s.account.riskTier === 2
          ? 2
          : 1) as ComplianceTier,
      lockupDays: s.account.lockupDays,
      isActive: s.account.isActive,
      jurisdictions: [],
      maturity:
        s.account.lockupDays > 0
          ? `${s.account.lockupDays} day lockup`
          : "Flexible liquidity",
      category: "rwa",
      sparklineData: [],
    }));

    const solsticeStrategies = this.getSolsticeStrategies();
    if (onChainStrategies.length === 0) {
      return solsticeStrategies;
    }

    return [...solsticeStrategies, ...onChainStrategies];
  }

  async getPositions(walletAddress: string) {
    const strategies = await this.getStrategies(walletAddress);
    const allPositions = await this.solanaService.getVaultPositions();
    const userWalletPubkey = new PublicKey(walletAddress);

    const solsticePositions: Array<{
      id: string;
      strategyId: string;
      strategyName: string;
      depositedAmount: number;
      currentValue: number;
      accruedYield: number;
      apy: number;
      depositedAt: string;
      shares: number;
    }> = [];

    // Solstice accounting is strategy-specific:
    // - Liquidity holds USX (instant redeem)
    // - Yield/Compounding hold eUSX (unlock/cooldown before withdraw)
    let eusxBalance = 0;
    let usxBalance = 0;
    try {
      const eusxMint = new PublicKey(this.solsticeService.mints.eusx);
      const eusxAta = getAssociatedTokenAddressSync(eusxMint, userWalletPubkey);
      const balance =
        await this.solanaService.connection.getTokenAccountBalance(eusxAta);
      // Use uiAmountString to avoid any mismatch between token decimals and our numeric conversions.
      // This matches how Solana/web3.js already formats SPL token balances.
      eusxBalance = Number(balance.value.uiAmountString ?? "0");
    } catch {
      // No eUSX ATA or unreadable token account -> no Solstice position yet.
    }

    try {
      const usxMint = new PublicKey(this.solsticeService.mints.usx);
      const usxAta = getAssociatedTokenAddressSync(usxMint, userWalletPubkey);
      const balance =
        await this.solanaService.connection.getTokenAccountBalance(usxAta);
      usxBalance = Number(balance.value.uiAmountString ?? "0");
    } catch {
      // No USX ATA or unreadable token account -> no Solstice liquidity position yet.
    }

    // Surface BOTH Solstice liquidity and yield positions so the UI can show the
    // correct card after you deposit to either strategy.
    // Include even when balances are 0 to keep recovery UI available.
    const liquidityStrategy = strategies.find(
      (s) => s.id === VaultsService.SOLSTICE_LIQUIDITY_ID,
    );
    const yieldStrategy = strategies.find(
      (s) => s.id === VaultsService.SOLSTICE_YIELD_ID,
    );

    if (liquidityStrategy) {
      solsticePositions.push({
        id: VaultsService.SOLSTICE_LIQUIDITY_POSITION_ID,
        strategyId: liquidityStrategy.id,
        strategyName: liquidityStrategy.name,
        depositedAmount: usxBalance,
        currentValue: usxBalance,
        accruedYield: 0,
        apy: liquidityStrategy.apy,
        depositedAt: new Date().toISOString(),
        shares: usxBalance,
      });
    }

    if (yieldStrategy) {
      solsticePositions.push({
        id: VaultsService.SOLSTICE_POSITION_ID,
        strategyId: yieldStrategy.id,
        strategyName: yieldStrategy.name,
        depositedAmount: eusxBalance,
        currentValue: eusxBalance,
        accruedYield: 0,
        apy: yieldStrategy.apy,
        depositedAt: new Date().toISOString(),
        shares: eusxBalance,
      });
    }

    const onChainPositions = allPositions
      .filter((p) => p.account.wallet.equals(userWalletPubkey))
      .map((p) => ({
        id: p.publicKey.toBase58(),
        strategyId: p.account.strategy.toBase58(),
        strategyName:
          strategies.find(
            (strategy) => strategy.id === p.account.strategy.toBase58(),
          )?.name ?? "Vault Strategy",
        depositedAmount: p.account.depositedAmount.toNumber() / 1_000_000,
        currentValue: p.account.currentValue.toNumber() / 1_000_000,
        accruedYield: p.account.accruedYield.toNumber() / 1_000_000,
        apy:
          strategies.find(
            (strategy) => strategy.id === p.account.strategy.toBase58(),
          )?.apy ?? 0,
        depositedAt: new Date(
          p.account.openedAt.toNumber() * 1000,
        ).toISOString(),
        shares: p.account.depositedAmount.toNumber() / 1_000_000,
      }));

    return [...solsticePositions, ...onChainPositions];
  }

  async getStrategyById(walletAddress: string, id: string) {
    const strategies = await this.getStrategies(walletAddress);
    const strategy = strategies.find((entry) => entry.id === id);
    if (!strategy) {
      throw new NotFoundException("Strategy not found");
    }
    return strategy;
  }

  async getPositionById(walletAddress: string, id: string) {
    const positions = await this.getPositions(walletAddress);
    const position = positions.find((entry) => entry.id === id);
    if (!position) {
      throw new NotFoundException("Position not found");
    }
    return position;
  }

  async getPortfolioSummary(walletAddress: string) {
    const positions = await this.getPositions(walletAddress);
    const totalDeposited = positions.reduce(
      (sum, position) => sum + position.depositedAmount,
      0,
    );
    const totalCurrentValue = positions.reduce(
      (sum, position) => sum + position.currentValue,
      0,
    );
    const totalAccruedYield = positions.reduce(
      (sum, position) => sum + position.accruedYield,
      0,
    );
    const weightedApy =
      totalCurrentValue > 0
        ? positions.reduce(
            (sum, position) => sum + position.currentValue * position.apy,
            0,
          ) / totalCurrentValue
        : 0;

    return {
      totalDeposited,
      totalCurrentValue,
      totalAccruedYield,
      totalPositions: positions.length,
      weightedApy: Number(weightedApy.toFixed(2)),
      unrealizedGainPct:
        totalDeposited > 0
          ? Number(
              (
                ((totalCurrentValue - totalDeposited) / totalDeposited) *
                100
              ).toFixed(2),
            )
          : 0,
    };
  }

  async getPortfolioAllocation(walletAddress: string) {
    const positions = await this.getPositions(walletAddress);
    const total = positions.reduce(
      (sum, position) => sum + position.currentValue,
      0,
    );
    return positions.map((position, index) => ({
      strategyId: position.strategyId,
      strategyName: position.strategyName,
      currentValue: position.currentValue,
      allocationPct:
        total > 0
          ? Number(((position.currentValue / total) * 100).toFixed(2))
          : 0,
      color: ["#4FC3C3", "#C9A84C", "#3DDC84"][index % 3],
    }));
  }

  async getYieldHistory(walletAddress: string, strategyId?: string) {
    const auditEvents = await this.prisma.auditEvent.findMany({
      where: {
        walletAddress,
        eventType: { in: ["vault.deposit", "vault.withdraw"] },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    const historyFromEvents = auditEvents
      .map((event) => {
        const metadata = this.asObjectRecord(event.metadata);
        const eventStrategyId = String(
          metadata.strategyId ?? VaultsService.SOLSTICE_YIELD_ID,
        );
        const eventStrategyName = String(
          metadata.strategyName ?? "Vault Strategy",
        );
        const eventApy = Number(metadata.apy ?? 0);
        const cumulativeYield = Number(metadata.cumulativeYield ?? 0);

        return {
          date: event.createdAt.toISOString(),
          strategyId: eventStrategyId,
          strategyName: eventStrategyName,
          apy: Number.isFinite(eventApy) ? eventApy : 0,
          cumulativeYield: Number.isFinite(cumulativeYield)
            ? cumulativeYield
            : 0,
        };
      })
      .filter((entry) => !strategyId || entry.strategyId === strategyId);

    const positions = await this.getPositions(walletAddress);
    const latestFromPositions = positions
      .filter((position) => !strategyId || position.strategyId === strategyId)
      .map((position) => ({
        date: new Date().toISOString(),
        strategyId: position.strategyId,
        strategyName: position.strategyName,
        apy: position.apy,
        cumulativeYield: position.accruedYield,
      }));

    return [...historyFromEvents, ...latestFromPositions].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  async recordTransaction(walletAddress: string, data: any) {
    const signature = String(data?.signature ?? "").trim();
    if (!signature) {
      throw new BadRequestException("signature is required");
    }

    const type = String(data?.type ?? "").trim();
    if (type !== "deposit" && type !== "withdraw") {
      throw new BadRequestException("type must be deposit or withdraw");
    }

    const strategyId = String(
      data?.strategyId ??
        (data?.positionId === VaultsService.SOLSTICE_POSITION_ID
          ? VaultsService.SOLSTICE_YIELD_ID
          : ""),
    ).trim();

    const strategy = strategyId
      ? await this.getStrategyById(walletAddress, strategyId)
      : null;
    const amount = Number(data?.amount ?? 0);

    // Enrich audit events with credential jurisdiction so the audit trail
    // and exported reports display meaningful values (not just "N/A").
    let jurisdiction: string | null = null;
    try {
      const credential = await this.complianceService.getCredential(
        walletAddress,
      );
      jurisdiction = credential?.jurisdiction ?? null;
    } catch {
      jurisdiction = null;
    }

    await this.complianceService.recordAuditEvent(
      walletAddress,
      type === "deposit" ? "vault.deposit" : "vault.withdraw",
      type === "deposit"
        ? "Vault deposit transaction recorded"
        : "Vault withdrawal transaction recorded",
      {
        signature,
        status: data?.status ?? "submitted",
        strategyId: strategyId || null,
        strategyName: strategy?.name ?? null,
        positionId: data?.positionId ?? null,
        jurisdiction,
        amount: Number.isFinite(amount) ? amount : null,
        apy: strategy?.apy ?? null,
      },
      signature,
    );

    return {
      success: true,
      signature,
      type,
      strategyId: strategyId || null,
      recordedAt: new Date().toISOString(),
    };
  }

  async deposit(walletAddress: string, strategyId: string, amount: number) {
    // Verify credential active and sufficient tier
    const credential =
      await this.complianceService.getCredential(walletAddress);
    if (!credential || !credential.isActive) {
      throw new ForbiddenException("Invalid or inactive credential");
    }

    const strategies = await this.getStrategies(walletAddress);
    const selectedStrategy = strategies.find(
      (entry) => entry.id === strategyId,
    );
    if (!selectedStrategy) {
      throw new NotFoundException("Strategy not found");
    }

    const requiredTier = Number(selectedStrategy.minTier);
    const callerTier = Number(credential.tier ?? 3);
    if (callerTier > requiredTier) {
      throw new ForbiddenException(
        `Your compliance tier does not meet strategy requirement (required Tier ${requiredTier}, current Tier ${callerTier}).`,
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new ForbiddenException("Deposit amount must be greater than 0");
    }

    const minDeposit = Number(selectedStrategy.minDepositUsdc ?? 0);
    if (numericAmount < minDeposit) {
      throw new ForbiddenException(
        `Deposit amount is below strategy minimum (${minDeposit} USDC).`,
      );
    }

    const amountMicro = Math.floor(numericAmount * 1_000_000);

    let unsignedTransaction: string;

    if (this.isSolsticeStrategy(strategyId)) {
      const step1Instructions = await this.solsticeService.buildDepositStep1Instructions(
        walletAddress,
        amountMicro,
      );

      const wallet = new PublicKey(walletAddress);
      const { blockhash } = await this.solanaService.connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet,
        recentBlockhash: blockhash,
        instructions: step1Instructions.map(i => ({
          programId: i.programId,
          keys: i.keys,
          data: i.data,
        })),
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);
      unsignedTransaction = Buffer.from(tx.serialize()).toString("base64");
    } else {
      const tx = await this.solanaService.buildDepositTransaction(
        walletAddress,
        strategyId,
        amountMicro,
      );

      unsignedTransaction = tx
        .serialize({ requireAllSignatures: false })
        .toString("base64");
    }    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction,
      estimatedApy: Number(selectedStrategy.apy ?? 0),
      lockupDays: Number(selectedStrategy.lockupDays ?? 0),
      minDepositUsdc: minDeposit,
      strategyId,
      status: "pending_signature",
      step: this.isSolsticeStrategy(strategyId) ? 1 : undefined,
    };
  }

  async withdraw(walletAddress: string, positionId: string, amount: number) {
    const credential =
      await this.complianceService.getCredential(walletAddress);
    if (!credential || !credential.isActive) {
      throw new ForbiddenException("Invalid or inactive credential");
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new ForbiddenException("Withdrawal amount must be greater than 0");
    }

    /** App + Solstice paths use 6 decimal fixed-point (micro) for USX/eUSX amounts. */
    const requestedMicro = Math.floor(numericAmount * 1_000_000);
    if (requestedMicro <= 0) {
      throw new BadRequestException(
        "Withdrawal amount is too small after precision conversion",
      );
    }

    const isSolsticeWithdraw =
      positionId === VaultsService.SOLSTICE_POSITION_ID ||
      this.isSolsticeStrategy(positionId);

    let unsignedTransaction: string;
    let effectiveAmountDisplay = numericAmount;
    let cappedToBalance = false;

    if (isSolsticeWithdraw) {
      const wallet = new PublicKey(walletAddress);
      const eusxMint = new PublicKey(this.solsticeService.mints.eusx);
      const eusxAta = getAssociatedTokenAddressSync(eusxMint, wallet);

      // On-chain eUSX balance (raw). Withdraw unlocks eUSX → must not exceed this.
      // Depositing 1 USDC often yields < 1 USX/eUSX due to mint/lock fees — not 1:1 with USDC.
      let availableEusxMicro = 0;
      try {
        const balance =
          await this.solanaService.connection.getTokenAccountBalance(eusxAta);
        availableEusxMicro = Number(balance.value.amount ?? "0");
      } catch {
        availableEusxMicro = 0;
      }

      const effectiveMicro = Math.min(requestedMicro, availableEusxMicro);
      if (effectiveMicro <= 0) {
        throw new BadRequestException(
          "No eUSX balance available to withdraw. Your position may be smaller than your original USDC deposit due to protocol fees.",
        );
      }

      effectiveAmountDisplay = effectiveMicro / 1_000_000;
      cappedToBalance = requestedMicro > effectiveMicro;

      // Step 1: Unlock and Withdraw (eUSX -> USX)
      const solsticeInstructions =
        await this.solsticeService.buildUnlockAndWithdrawInstructions_Only(
          walletAddress,
          effectiveMicro,
          walletAddress, // Follow deposit flow: user is the payer
        );

      const { blockhash } = await this.solanaService.connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet, // Follow deposit flow: user is the payer
        recentBlockhash: blockhash,
        instructions: solsticeInstructions.map((i) => ({
          programId: i.programId,
          keys: i.keys,
          data: i.data,
        })),
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      unsignedTransaction = Buffer.from(tx.serialize()).toString("base64");
    } else {
      const tx = await this.solanaService.buildWithdrawTransaction(
        walletAddress,
        positionId,
        requestedMicro,
      );

      unsignedTransaction = tx
        .serialize({ requireAllSignatures: false })
        .toString("base64");
    }

    return {
      withdrawalId: `wd_${Date.now()}`,
      unsignedTransaction,
      amountRequested: effectiveAmountDisplay,
      ...(isSolsticeWithdraw && cappedToBalance
        ? {
            cappedToBalance: true as const,
            message:
              "Amount was reduced to your full on-chain eUSX balance (deposit USDC → USX/eUSX is not always 1:1 due to protocol fees).",
          }
        : {}),
      positionId,
      status: "pending_signature",
      step: isSolsticeWithdraw ? 1 : undefined,
    };
  }

  async withdrawStep2(walletAddress: string, amount: number): Promise<any> {
    const requestedMicro = Math.floor(amount * 1_000_000);
    const walletPk = new PublicKey(walletAddress);
    const usxMint = new PublicKey(this.solsticeService.mints.usx);
    const usxAta = getAssociatedTokenAddressSync(usxMint, walletPk);
    let availableUsxMicro = 0;
    try {
      const balance =
        await this.solanaService.connection.getTokenAccountBalance(usxAta);
      availableUsxMicro = Number(balance.value.amount ?? "0");
    } catch {
      availableUsxMicro = 0;
    }
    const effectiveMicro = Math.min(requestedMicro, availableUsxMicro);
    if (effectiveMicro <= 0) {
      throw new BadRequestException(
        "No USX available to redeem. Complete the unlock step first or wait for balances to update.",
      );
    }

    const effectiveAmountDisplay = effectiveMicro / 1_000_000;
    const cappedToBalance = requestedMicro > effectiveMicro;

    const instructions = await this.solsticeService.buildRequestRedeemInstruction_Only(
      walletAddress,
      effectiveMicro,
      walletAddress,
    );
    const wallet = new PublicKey(walletAddress);
    const { blockhash } = await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map(i => ({ programId: i.programId, keys: i.keys, data: i.data })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    return {
      withdrawalId: `wd_${Date.now()}`,
      unsignedTransaction: Buffer.from(tx.serialize()).toString('base64'),
      status: 'pending_signature',
      step: 2,
      amountRequested: effectiveAmountDisplay,
      ...(cappedToBalance
        ? {
            cappedToBalance: true as const,
            message:
              "Amount was reduced to your full on-chain USX balance (fees/rounding can reduce redeemable amount).",
          }
        : {}),
    };
  }

  async withdrawStep3(walletAddress: string): Promise<any> {
    const instructions = await this.solsticeService.buildConfirmRedeemInstruction_Only(
      walletAddress,
      walletAddress,
    );
    const wallet = new PublicKey(walletAddress);
    const { blockhash } = await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map(i => ({ programId: i.programId, keys: i.keys, data: i.data })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    return {
      withdrawalId: `wd_${Date.now()}`,
      unsignedTransaction: Buffer.from(tx.serialize()).toString('base64'),
      status: 'pending_signature',
      step: 3,
    };
  }

  async getTransactionStatus(
    signature: string,
  ): Promise<VaultTransactionStatus> {
    const trimmedSignature = signature.trim();
    if (!trimmedSignature) {
      return {
        signature: "",
        status: "unknown",
        confirmationStatus: "unknown",
        slot: null,
        confirmations: null,
        error: "Missing signature",
      };
    }

    const response = await this.solanaService.connection.getSignatureStatuses(
      [trimmedSignature],
      { searchTransactionHistory: true },
    );
    const value = response.value[0];

    if (!value) {
      return {
        signature: trimmedSignature,
        status: "unknown",
        confirmationStatus: "unknown",
        slot: null,
        confirmations: null,
        error: null,
      };
    }

    const confirmationStatus = value.confirmationStatus ?? "processed";
    const status = value.err
      ? "failed"
      : confirmationStatus === "finalized"
        ? "finalized"
        : confirmationStatus === "confirmed"
          ? "confirmed"
          : "submitted";

    return {
      signature: trimmedSignature,
      status,
      confirmationStatus,
      slot: value.slot ?? null,
      confirmations: value.confirmations ?? null,
      error: value.err ?? null,
    };
  }

  /**
   * Test Solstice integration: build deposit flow instructions and return details.
   * Useful for verifying API connectivity and wallet whitelisting.
   */
  async testSolsticeIntegration(
    walletAddress: string,
    amount: number,
    walletOverride?: string,
  ): Promise<any> {
    try {
      const targetWallet = walletOverride || walletAddress;

      const instructions =
        await this.solsticeService.buildDepositFlowInstructions(
          targetWallet,
          amount,
        );

      return {
        success: true,
        message: "Solstice deposit flow instructions built successfully",
        walletAddress: targetWallet,
        amount,
        instructionCount: instructions.length,
        instructions: instructions.map((inst, idx) => ({
          index: idx,
          programId: inst.programId.toBase58(),
          accountCount: inst.keys.length,
          dataSize: inst.data.length,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const details =
        error instanceof HttpException ? error.getResponse() : undefined;

      return {
        success: false,
        message: "Failed to build Solstice deposit flow",
        error: error instanceof Error ? error.message : String(error),
        walletAddress,
        amount,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Co-sign a partially signed transaction (from frontend) and submit to network.
   */
  async coSignAndSubmit(
    walletAddress: string,
    partiallySignedTxBase64: string,
  ): Promise<{ signature: string; status: string }> {
    this.logger.log(`[coSignAndSubmit] Received partially signed tx for ${walletAddress}`);
    const txBytes = Buffer.from(partiallySignedTxBase64, 'base64');
    const tx = VersionedTransaction.deserialize(txBytes);

    // Manual signature injection to bypass web3.js signer validation issues
    const messageBytes = tx.message.serialize();
    const backendKeypair = this.solanaService.backendWallet;
    const backendSignature = nacl.sign.detached(messageBytes, backendKeypair.secretKey);

    // Find the backend wallet's signer index in the message
    const backendPubkeyBytes = backendKeypair.publicKey.toBytes();
    const signerKeys = tx.message.staticAccountKeys.slice(
      0,
      tx.message.header.numRequiredSignatures,
    );

    const backendIndex = signerKeys.findIndex((key) =>
      key.toBytes().every((byte, i) => byte === backendPubkeyBytes[i]),
    );

    if (backendIndex === -1) {
      this.logger.warn('[coSignAndSubmit] Backend wallet is not a required signer in this tx — submitting as-is');
    } else {
      tx.signatures[backendIndex] = backendSignature;
      this.logger.log(`[coSignAndSubmit] Backend signature injected at index ${backendIndex}`);
    }

    try {
      const signature = await this.solanaService.connection.sendRawTransaction(
        tx.serialize(),
        { skipPreflight: false, preflightCommitment: "confirmed" },
      );

      await this.solanaService.connection.confirmTransaction(
        signature,
        "confirmed",
      );

      this.logger.log(`[coSignAndSubmit] Confirmed: ${signature}`);
      return { signature, status: "confirmed" };
    } catch (error) {
      // Convert Solana simulation failures (SendTransactionError) into a 4xx
      // so the frontend can show a real, actionable reason (e.g. CooldownNotEnded).
      if (error instanceof SendTransactionError) {
        try {
          const logs =
            typeof (error as any).getLogs === "function"
              ? (error as any).getLogs()
              : [];
          const logText = Array.isArray(logs) ? logs.join("\n") : String(logs);

          // Anchor errors typically look like:
          // "Error Code: CooldownNotEnded. Error Number: 6013. Error Message: The cooldown period is not ended yet.."
          // We parse code/message independently because log formatting can vary.
          const codeMatch = logText.match(/Error Code:\s*([A-Za-z0-9_]+)/);
          const msgMatch = logText.match(/Error Message:\s*([^\r\n]+)/);

          const code = codeMatch?.[1];
          const msg = msgMatch?.[1]?.trim();

          if (code && msg) {
            this.logger.warn(`[coSignAndSubmit] Simulation failed (${code}): ${msg}`);
            throw new BadRequestException(msg);
          }

          if (code && !msg) {
            this.logger.warn(
              `[coSignAndSubmit] Simulation failed (${code}) but message couldn't be parsed from logs`,
            );
            throw new BadRequestException(
              `Solstice transaction rejected: ${code}. Please try again when conditions are met.`,
            );
          }

          // Fallback for simulation failures without the expected regex shape.
          throw new BadRequestException(
            "Transaction simulation failed. Please check the withdrawal/deposit conditions and try again.",
          );
        } catch (parseErr) {
          // If parsing logs fails, still return a helpful generic message.
          throw new BadRequestException(
            "Transaction simulation failed. Please check the withdrawal/deposit conditions and try again.",
          );
        }
      }

      throw error;
    }
  }

  async depositStep2a(walletAddress: string): Promise<any> {
    const instructions = await this.solsticeService.buildConfirmMintInstruction_Only(walletAddress);
    const wallet = new PublicKey(walletAddress);
    const { blockhash } = await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map(i => ({ programId: i.programId, keys: i.keys, data: i.data })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction: Buffer.from(tx.serialize()).toString('base64'),
      status: 'pending_signature',
      step: '2a',
    };
  }

  async depositStep2b(walletAddress: string, amount: number): Promise<any> {
    const amountMicro = Math.floor(amount * 1_000_000);
    const instructions = await this.solsticeService.buildLockInstruction_Only(walletAddress, amountMicro);
    const wallet = new PublicKey(walletAddress);
    const { blockhash } = await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map(i => ({ programId: i.programId, keys: i.keys, data: i.data })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction: Buffer.from(tx.serialize()).toString('base64'),
      status: 'pending_signature',
      step: '2b',
    };
  }

  /**
   * Solstice recovery: CancelMint — revert a pending mint (treasury / stuck deposit path).
   */
  async cancelMint(
    walletAddress: string,
    collateral: "usdc" | "usdt" = "usdc",
  ): Promise<{
    unsignedTransaction: string;
    status: string;
    action: string;
  }> {
    const credential =
      await this.complianceService.getCredential(walletAddress);
    if (!credential || !credential.isActive) {
      throw new ForbiddenException("Invalid or inactive credential");
    }

    const instructions =
      await this.solsticeService.buildCancelMintInstructions(
        walletAddress,
        collateral,
      );
    const wallet = new PublicKey(walletAddress);
    const { blockhash } =
      await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map((i) => ({
        programId: i.programId,
        keys: i.keys,
        data: i.data,
      })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "vault.cancel_mint",
      "Mint request cancelled — collateral recovery initiated",
      { initiatedAt: new Date().toISOString(), collateral },
    );

    return {
      unsignedTransaction: Buffer.from(tx.serialize()).toString("base64"),
      status: "pending_signature",
      action: "cancel_mint",
    };
  }

  /**
   * Solstice recovery: CancelRedeem — cancel a pending redeem (USX restored vs stuck redeem).
   */
  async cancelRedeem(
    walletAddress: string,
    collateral: "usdc" | "usdt" = "usdc",
  ): Promise<{
    unsignedTransaction: string;
    status: string;
    action: string;
  }> {
    const credential =
      await this.complianceService.getCredential(walletAddress);
    if (!credential || !credential.isActive) {
      throw new ForbiddenException("Invalid or inactive credential");
    }

    const instructions =
      await this.solsticeService.buildCancelRedeemInstructions(
        walletAddress,
        collateral,
      );
    const wallet = new PublicKey(walletAddress);
    const { blockhash } =
      await this.solanaService.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: instructions.map((i) => ({
        programId: i.programId,
        keys: i.keys,
        data: i.data,
      })),
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "vault.cancel_redeem",
      "Redeem request cancelled — USX position restored",
      { initiatedAt: new Date().toISOString(), collateral },
    );

    return {
      unsignedTransaction: Buffer.from(tx.serialize()).toString("base64"),
      status: "pending_signature",
      action: "cancel_redeem",
    };
  }
}
