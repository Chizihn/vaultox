import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  BadRequestException,
} from "@nestjs/common";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { SolsticeService } from "../solstice/solstice.service";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PrismaService } from "../prisma/prisma.service";

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
  private static readonly SOLSTICE_STRATEGY_ID = "solstice-yield-vault";
  private static readonly SOLSTICE_POSITION_ID = "solstice-eusx-position";

  private getSolsticeStrategy() {
    const apy = Number(process.env.SOLSTICE_DISPLAY_APY ?? "0");
    return {
      id: VaultsService.SOLSTICE_STRATEGY_ID,
      name: "Solstice Yield Vault",
      description:
        "Live Solstice flow (USDC → USX → eUSX) with wallet-signed on-chain execution.",
      apy,
      apyBps: Math.round(apy * 100),
      minDepositUsdc: 1,
      maxCapacityUsdc: Number.MAX_SAFE_INTEGER,
      currentTvl: 0,
      tvl: 0,
      riskTier: 1,
      riskRating: "Low",
      minTier: 3 as ComplianceTier,
      lockupDays: 0,
      isActive: true,
      jurisdictions: [],
      maturity: "Flexible liquidity",
      category: "rwa",
      sparklineData: [],
    };
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
      minDepositUsdc: s.account.minDeposit.toNumber(),
      maxCapacityUsdc: s.account.maxCapacity.toNumber(),
      currentTvl: s.account.currentTvl.toNumber(),
      tvl: s.account.currentTvl.toNumber(),
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

    const solsticeStrategy = this.getSolsticeStrategy();
    if (onChainStrategies.length === 0) {
      return [solsticeStrategy];
    }

    return [solsticeStrategy, ...onChainStrategies];
  }

  async getPositions(walletAddress: string) {
    const strategies = await this.getStrategies(walletAddress);
    const allPositions = await this.solanaService.getVaultPositions();
    const userWalletPubkey = new PublicKey(walletAddress);

    const solsticeStrategy = strategies.find(
      (strategy) => strategy.id === VaultsService.SOLSTICE_STRATEGY_ID,
    );

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

    try {
      const eusxMint = new PublicKey(this.solsticeService.mints.eusx);
      const eusxAta = getAssociatedTokenAddressSync(eusxMint, userWalletPubkey);
      const balance =
        await this.solanaService.connection.getTokenAccountBalance(eusxAta);
      const eusxBalance = Number(balance.value.uiAmountString ?? "0");

      if (eusxBalance > 0 && solsticeStrategy) {
        solsticePositions.push({
          id: VaultsService.SOLSTICE_POSITION_ID,
          strategyId: solsticeStrategy.id,
          strategyName: solsticeStrategy.name,
          depositedAmount: eusxBalance,
          currentValue: eusxBalance,
          accruedYield: 0,
          apy: solsticeStrategy.apy,
          depositedAt: new Date().toISOString(),
          shares: eusxBalance,
        });
      }
    } catch {
      // No eUSX ATA or unreadable token account -> no Solstice position yet.
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
        depositedAmount: p.account.depositedAmount.toNumber(),
        currentValue: p.account.currentValue.toNumber(),
        accruedYield: p.account.accruedYield.toNumber(),
        apy:
          strategies.find(
            (strategy) => strategy.id === p.account.strategy.toBase58(),
          )?.apy ?? 0,
        depositedAt: new Date(
          p.account.openedAt.toNumber() * 1000,
        ).toISOString(),
        shares: p.account.depositedAmount.toNumber(),
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
          metadata.strategyId ?? VaultsService.SOLSTICE_STRATEGY_ID,
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
          ? VaultsService.SOLSTICE_STRATEGY_ID
          : ""),
    ).trim();

    const strategy = strategyId
      ? await this.getStrategyById(walletAddress, strategyId)
      : null;
    const amount = Number(data?.amount ?? 0);

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

    let tx: Transaction;
    if (strategyId === VaultsService.SOLSTICE_STRATEGY_ID) {
      const solsticeInstructions =
        await this.solsticeService.buildDepositFlowInstructions(
          walletAddress,
          numericAmount,
        );

      tx = new Transaction();
      const wallet = new PublicKey(walletAddress);
      solsticeInstructions.forEach((inst) => tx.add(inst));
      tx.feePayer = wallet;
      tx.recentBlockhash = (
        await this.solanaService.connection.getLatestBlockhash()
      ).blockhash;
    } else {
      tx = await this.solanaService.buildDepositTransaction(
        walletAddress,
        strategyId,
        numericAmount,
      );
    }

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction,
      estimatedApy: Number(selectedStrategy.apy ?? 0),
      lockupDays: Number(selectedStrategy.lockupDays ?? 0),
      minDepositUsdc: minDeposit,
      strategyId,
      status: "pending_signature",
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

    let tx: Transaction;
    if (positionId === VaultsService.SOLSTICE_POSITION_ID) {
      const solsticeInstructions =
        await this.solsticeService.buildWithdrawalFlowInstructions(
          walletAddress,
          numericAmount,
        );

      tx = new Transaction();
      const wallet = new PublicKey(walletAddress);
      solsticeInstructions.forEach((inst) => tx.add(inst));
      tx.feePayer = wallet;
      tx.recentBlockhash = (
        await this.solanaService.connection.getLatestBlockhash()
      ).blockhash;
    } else {
      tx = await this.solanaService.buildWithdrawTransaction(
        walletAddress,
        positionId,
        numericAmount,
      );
    }

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      withdrawalId: `wd_${Date.now()}`,
      unsignedTransaction,
      amountRequested: numericAmount,
      positionId,
      status: "pending_signature",
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
}
