import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { PublicKey } from "@solana/web3.js";

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
  constructor(
    private readonly solanaService: SolanaService,
    private readonly complianceService: ComplianceService,
  ) {}

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
    const strategies = await this.solanaService.getVaultStrategies();

    return strategies.map((s) => ({
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
  }

  async getPositions(walletAddress: string) {
    const strategies = await this.getStrategies(walletAddress);
    const allPositions = await this.solanaService.getVaultPositions();
    const userWalletPubkey = new PublicKey(walletAddress);

    return allPositions
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
    const _walletAddress = walletAddress;
    const _strategyId = strategyId;
    return [];
  }

  async deposit(walletAddress: string, strategyId: string, amount: number) {
    // Verify credential active and sufficient tier
    const credential =
      await this.complianceService.getCredential(walletAddress);
    if (!credential || !credential.isActive) {
      throw new ForbiddenException("Invalid or inactive credential");
    }

    // Call solana service to assemble tx
    const tx = await this.solanaService.buildDepositTransaction(
      walletAddress,
      strategyId,
      amount,
    );
    const strategy = await this.solanaService.getVaultStrategy(strategyId);

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction,
      estimatedApy: Number(strategy.apyBps) / 100,
      lockupDays: Number(strategy.lockupDays),
      minDepositUsdc: Number(strategy.minDeposit),
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

    const tx = await this.solanaService.buildWithdrawTransaction(
      walletAddress,
      positionId,
      amount,
    );

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      withdrawalId: `wd_${Date.now()}`,
      unsignedTransaction,
      amountRequested: amount,
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
}
