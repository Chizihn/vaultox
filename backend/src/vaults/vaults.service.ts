import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { PublicKey, Transaction } from "@solana/web3.js";

@Injectable()
export class VaultsService {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly complianceService: ComplianceService,
  ) {}

  async getStrategies(walletAddress: string) {
    const strategies = await this.solanaService.getVaultStrategies();

    return strategies.map((s, index) => ({
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
      minTier: s.account.riskTier === 3 ? 1 : s.account.riskTier === 2 ? 2 : 3,
      lockupDays: s.account.lockupDays,
      isActive: s.account.isActive,
      jurisdictions: ["🇨🇭", "🇸🇬", "🇩🇪"],
      maturity:
        s.account.lockupDays > 0
          ? `${s.account.lockupDays} day lockup`
          : "Flexible liquidity",
      category:
        index % 3 === 0
          ? "tbill"
          : index % 3 === 1
            ? "private_credit"
            : "commodity",
      allocation: [
        { label: "T-Bills", percentage: 55, color: "#4FC3C3" },
        { label: "Cash", percentage: 25, color: "#C9A84C" },
        { label: "Reserve", percentage: 20, color: "#3DDC84" },
      ],
      sparklineData: [
        4.1,
        4.3,
        4.25,
        4.5,
        4.6,
        4.7,
        Number(s.account.apyBps) / 100,
      ],
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
    const positions = await this.getPositions(walletAddress);
    return positions
      .filter((position) => !strategyId || position.strategyId === strategyId)
      .flatMap((position) =>
        [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          date: new Date(Date.now() - (6 - day) * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          strategyId: position.strategyId,
          strategyName: position.strategyName,
          apy: position.apy,
          cumulativeYield: Number(
            (position.accruedYield * ((day + 1) / 7)).toFixed(2),
          ),
        })),
      );
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

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      depositId: `dep_${Date.now()}`,
      unsignedTransaction,
      estimatedYield: "4.85",
      lockupDays: 30,
      status: "pending_signature",
    };
  }

  async withdraw(walletAddress: string, positionId: string, amount: number) {
    // A real implementation would build a withdraw transaction using Anchor
    const userWallet = new PublicKey(walletAddress);
    const tx = new Transaction();
    tx.feePayer = userWallet;
    tx.recentBlockhash = (
      await this.solanaService.connection.getLatestBlockhash()
    ).blockhash;

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return {
      withdrawId: `wd_${Date.now()}`,
      unsignedTransaction,
      amountRequested: amount,
      status: "pending_signature",
    };
  }
}
