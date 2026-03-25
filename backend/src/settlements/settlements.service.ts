import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { KytService } from "../kyt/kyt.service";
import { NotificationsService } from "../notifications/notifications.service";
import { createHash } from "node:crypto";
import { interval, map, startWith, switchMap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);
  private static readonly TOKEN_ACCOUNT_SIZE = 165;

  private async assertInitiateSettlementAccountsExist(
    initiatorWallet: string,
    receiverWallet: string,
  ) {
    const initiator = new PublicKey(initiatorWallet);
    const initiatorUsdcAta = getAssociatedTokenAddressSync(
      this.solanaService.usdcMint,
      initiator,
    );
    const initiatorCredentialPda =
      this.solanaService.getCredentialPda(initiatorWallet);
    const receiverCredentialPda =
      this.solanaService.getCredentialPda(receiverWallet);

    const checks: Array<{ name: string; address: PublicKey }> = [
      { name: "usdcMint", address: this.solanaService.usdcMint },
      { name: "initiatorWallet", address: initiator },
      { name: "initiatorUsdcAta", address: initiatorUsdcAta },
      { name: "initiatorCredentialPda", address: initiatorCredentialPda },
      { name: "receiverCredentialPda", address: receiverCredentialPda },
    ];

    const infos = await this.solanaService.connection.getMultipleAccountsInfo(
      checks.map((entry) => entry.address),
      "processed",
    );

    const missing = checks
      .filter((_, index) => !infos[index])
      .map((entry) => ({
        name: entry.name,
        address: entry.address.toBase58(),
      }));

    const initiatorWalletExists = Boolean(infos[1]);
    if (!initiatorWalletExists) {
      this.logger.error(
        `[initiateSettlement] initiator wallet account not found on cluster initiator=${initiatorWallet}`,
      );
      throw new BadRequestException({
        message:
          "Initiator wallet is not initialized on devnet. Fund it with SOL first (e.g. run `solana airdrop 1 Fn5oZsN9gYS6RTiBvstPK1kjz9Waxo9m7rFFsY1UFUug --url devnet`).",
        phase: "account_validation",
        missingAccounts: [
          { name: "initiatorWallet", address: initiator.toBase58() },
        ],
      });
    }

    const initiatorLamports = infos[1]?.lamports ?? 0;
    const settlementRent =
      await this.solanaService.connection.getMinimumBalanceForRentExemption(
        558,
      );
    const escrowTokenRent =
      await this.solanaService.connection.getMinimumBalanceForRentExemption(
        SettlementsService.TOKEN_ACCOUNT_SIZE,
      );
    const estimatedTxFees = 25_000;
    const requiredLamports = settlementRent + escrowTokenRent + estimatedTxFees;

    if (initiatorLamports < requiredLamports) {
      const availableSol = initiatorLamports / 1_000_000_000;
      const requiredSol = requiredLamports / 1_000_000_000;
      this.logger.error(
        `[initiateSettlement] insufficient SOL for payer rent+fees initiator=${initiatorWallet} availableLamports=${initiatorLamports} requiredLamports=${requiredLamports}`,
      );
      throw new BadRequestException({
        message: `Insufficient SOL for settlement account creation and fees. Available ${availableSol.toFixed(6)} SOL, required at least ${requiredSol.toFixed(6)} SOL.`,
        phase: "account_validation",
        payerBalanceLamports: initiatorLamports,
        requiredLamports,
      });
    }

    if (missing.length > 0) {
      this.logger.error(
        `[initiateSettlement] required accounts missing initiator=${initiatorWallet} receiver=${receiverWallet} missing=${JSON.stringify(missing)}`,
      );
      throw new BadRequestException({
        message: "Settlement account validation failed before preflight",
        phase: "account_validation",
        missingAccounts: missing,
      });
    }
  }

  private async simulatePreflightSafe(tx: any) {
    try {
      try {
        return await (this.solanaService.connection as any).simulateTransaction(
          tx,
          {
            sigVerify: false,
            commitment: "processed",
          },
        );
      } catch (error) {
        this.logger.warn(
          `[simulatePreflightSafe] primary simulateTransaction signature failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return await (this.solanaService.connection as any).simulateTransaction(
          tx,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[simulatePreflightSafe] simulation unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  constructor(
    private readonly solanaService: SolanaService,
    private readonly complianceService: ComplianceService,
    private readonly kytService: KytService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSettlements(walletAddress: string, statusFilter?: string) {
    const related = await this.prisma.settlement.findMany({
      where: {
        OR: [
          { initiatorWallet: walletAddress },
          { receiverWallet: walletAddress },
        ],
        ...(statusFilter && statusFilter !== "all"
          ? { status: statusFilter as any }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      settlements: related.map((s) => ({
        id: s.id,
        fromInstitution: {
          id: s.initiatorWallet,
          name: s.fromInstitutionName,
          jurisdiction: s.fromJurisdiction ?? "Unknown",
          jurisdictionFlag: this.getJurisdictionFlag(s.fromJurisdiction),
          tier: 1,
          city: this.getDefaultCity(s.fromJurisdiction),
          walletAddress: s.initiatorWallet,
        },
        toInstitution: {
          id: s.receiverWallet,
          name: s.toInstitutionName,
          jurisdiction: s.toJurisdiction ?? "Unknown",
          jurisdictionFlag: this.getJurisdictionFlag(s.toJurisdiction),
          tier: 1,
          city: this.getDefaultCity(s.toJurisdiction),
          walletAddress: s.receiverWallet,
        },
        amount: Number(s.amount),
        currency: s.currency,
        status: s.status,
        initiatedAt: s.createdAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? undefined,
        txHash: s.txHash ?? "",
        fxRate: s.fxRate ?? undefined,
        settlementTime: s.completedAt
          ? Math.max(
              1,
              Math.round(
                (s.completedAt.getTime() - s.createdAt.getTime()) / 1000,
              ),
            )
          : undefined,
        corridor: s.corridor ?? "Unknown",
      })),
      total: related.length,
    };
  }

  async getSettlementDetail(id: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) {
      throw new NotFoundException("Settlement not found");
    }

    return {
      id,
      status: s.status,
      sender: { institution: s.fromInstitutionName, wallet: s.initiatorWallet },
      receiver: { institution: s.toInstitutionName, wallet: s.receiverWallet },
      amount: Number(s.amount),
      currency: s.currency,
      fee: "0.00",
      initiatedAt: s.createdAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      travelRule: this.asObjectRecord(s.travelRulePayload),
      amlFlags: [],
      complianceStatus: "cleared",
    };
  }

  async validateTravelRule(payload: any) {
    const required = [
      "originatorName",
      "originatorAddress",
      "originatorAccountId",
      "beneficiaryName",
      "beneficiaryAddress",
      "beneficiaryAccountId",
      "purposeCode",
    ];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing Travel Rule fields: ${missing.join(", ")}`,
      );
    }
    return { valid: true, errors: [] };
  }

  async initiateSettlement(walletAddress: string, data: any) {
    this.logger.log(
      `[initiateSettlement] start initiator=${walletAddress} receiver=${data?.receiver?.walletAddress} amount=${data?.amount}`,
    );

    // 0. Idempotency check — prevent duplicate settlements from rapid clicks
    // Look for a pending/settling settlement with the same initiator, receiver, and amount
    // created within the last 5 minutes
    const recentDuplicate = await this.prisma.settlement.findFirst({
      where: {
        initiatorWallet: walletAddress,
        receiverWallet: data.receiver.walletAddress,
        amount: String(data.amount),
        status: { in: ["pending", "settling"] },
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentDuplicate) {
      this.logger.log(
        `[initiateSettlement] duplicate pending settlement found id=${recentDuplicate.id}; rebuilding unsigned tx with fresh blockhash`,
      );

      // Refresh unsigned transaction so retries don't reuse stale blockhash
      const senderContext =
        await this.complianceService.resolveCredentialStatus(walletAddress);
      const normalizedTravelRule = data.travelRule ?? {
        originatorName:
          senderContext.institution?.name ?? "Unknown Institution",
        originatorAddress: `${senderContext.institution?.city ?? "Unknown"}, ${senderContext.institution?.jurisdiction ?? "UNK"}`,
        originatorAccountId: walletAddress,
        beneficiaryName: data.receiver.institutionName ?? "Counterparty",
        beneficiaryAddress: `${data.receiver.jurisdiction ?? "Unknown"}`,
        beneficiaryAccountId: data.receiver.walletAddress,
        purposeCode: "OTHR",
      };

      const complianceHash = `tr_${Date.now()}`;
      const settlementReference = this.buildSettlementReference(
        walletAddress,
        data.receiver.walletAddress,
        data.amount,
      );

      await this.assertInitiateSettlementAccountsExist(
        walletAddress,
        data.receiver.walletAddress,
      );

      const { tx, feeAmount, settlementSeedHex } =
        await this.solanaService.buildInitiateSettlementTransaction({
          initiatorWallet: walletAddress,
          receiverWallet: data.receiver.walletAddress,
          amount: data.amount,
          feeAmount: "0",
          settlementReference,
          complianceHash,
          travelRule: {
            originatorName: String(normalizedTravelRule.originatorName),
            originatorAccountId: String(
              normalizedTravelRule.originatorAccountId,
            ),
            originatorAddress: String(normalizedTravelRule.originatorAddress),
            beneficiaryName: String(normalizedTravelRule.beneficiaryName),
            beneficiaryAddress: String(normalizedTravelRule.beneficiaryAddress),
            beneficiaryAccountId: String(
              normalizedTravelRule.beneficiaryAccountId,
            ),
            purposeCode: String(normalizedTravelRule.purposeCode),
          },
        });

      const simulation = await this.simulatePreflightSafe(tx);

      if (simulation?.value?.err) {
        this.logger.error(
          `[initiateSettlement] duplicate preflight failed settlementId=${recentDuplicate.id} err=${JSON.stringify(simulation.value.err)} logs=${JSON.stringify(simulation.value.logs ?? [])}`,
        );
        throw new BadRequestException({
          message: "Settlement preflight failed before signing",
          phase: "duplicate_preflight",
          simulationError: simulation.value.err,
          simulationLogs: simulation.value.logs ?? [],
        });
      }

      this.logger.log(
        `[initiateSettlement] duplicate preflight ${simulation ? "passed" : "skipped"} settlementId=${recentDuplicate.id}`,
      );

      const refreshedUnsignedTransaction = tx
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      await this.prisma.settlement.update({
        where: { id: recentDuplicate.id },
        data: {
          unsignedTransaction: refreshedUnsignedTransaction,
          complianceHash: `${complianceHash}:${settlementSeedHex}`,
          travelRulePayload: normalizedTravelRule,
        },
      });

      return {
        settlementId: recentDuplicate.id,
        unsignedTransaction: refreshedUnsignedTransaction,
        estimatedFee: feeAmount,
        status: "pending_signature" as const,
        debug: {
          phase: "duplicate_refresh",
          settlementSeedHex,
          recentBlockhash: tx.recentBlockhash,
          cluster: process.env.SOLANA_CLUSTER ?? "unknown",
        },
      };
    }

    // 1. Validate Travel Rule payload
    if (data.travelRule) {
      await this.validateTravelRule(data.travelRule);
    } else if (Number(data.amount) >= 1000) {
      throw new BadRequestException(
        "Travel Rule payload required for amounts >= 1000 USDC",
      );
    }

    // 2. Validate receiver compliance
    const receiverCredential = await this.complianceService.getCredential(
      data.receiver.walletAddress,
    );
    if (!receiverCredential || !receiverCredential.isActive) {
      throw new ForbiddenException(
        "Counterparty credential not verified or inactive",
      );
    }

    // 3. KYT policy/provider assessment
    const senderContext =
      await this.complianceService.resolveCredentialStatus(walletAddress);
    const amount = Number(data.amount);
    const corridor = `${senderContext.institution?.jurisdiction ?? "UNK"} → ${data.receiver.jurisdiction ?? "UNK"}`;

    const kytAssessment = await this.kytService.assessTransfer({
      fromWallet: walletAddress,
      toWallet: data.receiver.walletAddress,
      amount,
      asset: data.currency ?? "USDC",
      corridor,
    });

    if (kytAssessment.status === "blocked") {
      await this.complianceService.recordAuditEvent(
        walletAddress,
        "aml.flag_raised",
        "Settlement blocked by KYT policy",
        {
          status: "blocked",
          amount,
          corridor,
          kytProvider: kytAssessment.provider,
          kytReason: kytAssessment.reason,
          kytRiskScore: kytAssessment.riskScore,
          kytFlags: kytAssessment.flags,
        },
      );

      throw new ForbiddenException("Settlement blocked by KYT policy");
    }

    // 4. Assemble tx via settlement program instruction
    const requestedAmount = Number(data.amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException("Settlement amount must be greater than 0");
    }

    const initiator = new PublicKey(walletAddress);
    const initiatorUsdcAta = getAssociatedTokenAddressSync(
      this.solanaService.usdcMint,
      initiator,
    );

    let initiatorUsdcBalanceUi = 0;
    try {
      const tokenBalance =
        await this.solanaService.connection.getTokenAccountBalance(
          initiatorUsdcAta,
        );
      initiatorUsdcBalanceUi = Number(tokenBalance.value.uiAmountString ?? "0");
    } catch {
      throw new BadRequestException(
        "Initiator USDC token account not found on devnet. Fund your wallet with devnet USDC first.",
      );
    }

    if (initiatorUsdcBalanceUi < requestedAmount) {
      throw new BadRequestException(
        `Insufficient USDC balance. Required ${requestedAmount}, available ${initiatorUsdcBalanceUi}.`,
      );
    }

    const normalizedTravelRule = data.travelRule ?? {
      originatorName: senderContext.institution?.name ?? "Unknown Institution",
      originatorAddress: `${senderContext.institution?.city ?? senderContext.institution?.jurisdiction ?? "Unknown"}, ${senderContext.institution?.jurisdiction ?? "UNK"}`,
      originatorAccountId: walletAddress,
      beneficiaryName: data.receiver.institutionName ?? "Counterparty",
      beneficiaryAddress: `${data.receiver.jurisdiction ?? "Local"}`,
      beneficiaryAccountId: data.receiver.walletAddress,
      purposeCode: "OTHR",
    };
    const complianceHash = `tr_${Date.now()}`;
    const settlementReference = this.buildSettlementReference(
      walletAddress,
      data.receiver.walletAddress,
      data.amount,
    );

    await this.assertInitiateSettlementAccountsExist(
      walletAddress,
      data.receiver.walletAddress,
    );

    const requestedAmountMicro = Math.floor(requestedAmount * 1_000_000);

    const { tx, feeAmount, settlementSeedHex } =
      await this.solanaService.buildInitiateSettlementTransaction({
        initiatorWallet: walletAddress,
        receiverWallet: data.receiver.walletAddress,
        amount: requestedAmountMicro.toString(),
        feeAmount: "0",
        settlementReference,
        complianceHash,
        travelRule: {
          originatorName: String(normalizedTravelRule.originatorName),
          originatorAccountId: String(normalizedTravelRule.originatorAccountId),
          originatorAddress: String(normalizedTravelRule.originatorAddress),
          beneficiaryName: String(normalizedTravelRule.beneficiaryName),
          beneficiaryAddress: String(normalizedTravelRule.beneficiaryAddress),
          beneficiaryAccountId: String(
            normalizedTravelRule.beneficiaryAccountId,
          ),
          purposeCode: String(normalizedTravelRule.purposeCode),
        },
      });

    const simulation = await this.simulatePreflightSafe(tx);

    if (simulation?.value?.err) {
      this.logger.error(
        `[initiateSettlement] preflight failed initiator=${walletAddress} err=${JSON.stringify(simulation.value.err)} logs=${JSON.stringify(simulation.value.logs ?? [])}`,
      );
      throw new BadRequestException({
        message: "Settlement preflight failed before signing",
        phase: "preflight",
        simulationError: simulation.value.err,
        simulationLogs: simulation.value.logs ?? [],
      });
    }

    this.logger.log(
      `[initiateSettlement] preflight ${simulation ? "passed" : "skipped"} initiator=${walletAddress} receiver=${data.receiver.walletAddress}`,
    );

    const unsignedTransaction = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    const saved = await this.prisma.settlement.create({
      data: {
        initiatorWallet: walletAddress,
        receiverWallet: data.receiver.walletAddress,
        fromInstitutionName:
          senderContext.institution?.name ?? "Unknown Institution",
        toInstitutionName: data.receiver.institutionName ?? "Counterparty",
        fromJurisdiction: senderContext.institution?.jurisdiction ?? null,
        toJurisdiction: data.receiver.jurisdiction ?? null,
        amount: String(requestedAmount),
        currency: data.currency ?? "USDC",
        status: "pending",
        unsignedTransaction,
        estimatedCompletionMs: 1800,
        travelRulePayload: normalizedTravelRule,
        complianceHash: `${complianceHash}:${settlementSeedHex}`,
        corridor,
        fxRate: 1,
      },
    });

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "settlement.initiated",
      "Settlement initiated",
      {
        settlementId: saved.id,
        amount: requestedAmount,
        jurisdiction: senderContext.institution?.jurisdiction,
        status: "success",
        kytStatus: kytAssessment.status,
        kytProvider: kytAssessment.provider,
        kytRiskScore: kytAssessment.riskScore,
        kytReason: kytAssessment.reason,
      },
    );

    // Send email notification for settlement initiated
    try {
      const senderRequest = await this.prisma.kycRequest.findFirst({
        where: { walletAddress },
        orderBy: { upgradeCreatedAt: "desc" },
      });
      if (senderRequest?.email) {
        await this.notificationsService.notifySettlementInitiated({
          email: senderRequest.email,
          settlementId: saved.id,
          amount: `${saved.amount} ${saved.currency}`,
          receiver:
            data.receiver.institutionName ?? data.receiver.walletAddress,
        });
      }
    } catch (error) {
      console.error("Failed to send settlement initiated email:", error);
    }

    return {
      settlementId: saved.id,
      unsignedTransaction,
      estimatedFee: feeAmount,
      status: "pending_signature",
      debug: {
        phase: "created",
        settlementSeedHex,
        recentBlockhash: tx.recentBlockhash,
        cluster: process.env.SOLANA_CLUSTER ?? "unknown",
      },
    };
  }

  async submitSettlementSignature(
    walletAddress: string,
    id: string,
    signature: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    if (settlement.initiatorWallet !== walletAddress) {
      throw new ForbiddenException("Only settlement initiator can submit tx");
    }

    const txStatus = await this.getTransactionStatus(signature);
    if (txStatus.status === "failed") {
      // Update settlement status to failed
      const failed = await this.prisma.settlement.update({
        where: { id },
        data: {
          txHash: signature.trim(),
          status: "failed",
        },
      });

      // Send email notification for settlement failed
      try {
        const initiatorRequest = await this.prisma.kycRequest.findFirst({
          where: { walletAddress: settlement.initiatorWallet },
          orderBy: { upgradeCreatedAt: "desc" },
        });
        if (initiatorRequest?.email) {
          await this.notificationsService.notifySettlementFailed({
            email: initiatorRequest.email,
            settlementId: failed.id,
            reason: JSON.stringify(txStatus.error ?? "unknown error"),
          });
        }
      } catch (error) {
        console.error("Failed to send settlement failed email:", error);
      }

      throw new BadRequestException(
        `Settlement transaction failed: ${JSON.stringify(txStatus.error ?? "unknown error")}`,
      );
    }

    const chainFinal =
      txStatus.status === "confirmed" || txStatus.status === "finalized";

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        txHash: signature.trim(),
        status: chainFinal ? "completed" : "settling",
        completedAt: chainFinal ? new Date() : null,
      },
    });

    if (chainFinal) {
      await this.complianceService.recordAuditEvent(
        walletAddress,
        "settlement.confirmed",
        "Settlement confirmed",
        {
          settlementId: updated.id,
          amount: Number(updated.amount),
          jurisdiction: updated.fromJurisdiction,
          status: "success",
        },
        signature.trim(),
      );

      // Send email notification for settlement completed
      try {
        const initiatorRequest = await this.prisma.kycRequest.findFirst({
          where: { walletAddress: updated.initiatorWallet },
          orderBy: { upgradeCreatedAt: "desc" },
        });
        if (initiatorRequest?.email) {
          await this.notificationsService.notifySettlementCompleted({
            email: initiatorRequest.email,
            settlementId: updated.id,
            amount: `${updated.amount} ${updated.currency}`,
            txHash: signature.trim(),
          });
        }
      } catch (error) {
        console.error("Failed to send settlement completed email:", error);
      }
    }

    return {
      settlementId: updated.id,
      txHash: updated.txHash,
      status: updated.status,
      confirmationStatus: txStatus.confirmationStatus,
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  async confirmSettlement(
    walletAddress: string,
    id: string,
    signature?: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    const effectiveSignature = signature?.trim() || settlement.txHash?.trim();
    if (!effectiveSignature) {
      throw new BadRequestException("Missing settlement transaction signature");
    }

    const txStatus = await this.getTransactionStatus(effectiveSignature);
    if (txStatus.status === "failed") {
      await this.prisma.settlement.update({
        where: { id },
        data: {
          status: "failed",
          txHash: effectiveSignature,
        },
      });
      throw new BadRequestException(
        `Settlement transaction failed: ${JSON.stringify(txStatus.error ?? "unknown error")}`,
      );
    }

    if (txStatus.status !== "confirmed" && txStatus.status !== "finalized") {
      throw new BadRequestException(
        "Settlement transaction is not yet confirmed on-chain",
      );
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
        txHash: effectiveSignature,
      },
    });

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "settlement.confirmed",
      "Settlement confirmed",
      {
        settlementId: settlement.id,
        amount: Number(settlement.amount),
        jurisdiction: settlement.fromJurisdiction,
        status: "success",
      },
      updated.txHash ?? undefined,
    );

    return {
      id: updated.id,
      status: updated.status,
      txHash: updated.txHash,
      completedAt: updated.completedAt?.toISOString(),
    };
  }

  async getTransactionStatus(signature: string) {
    const trimmedSignature = signature.trim();
    if (!trimmedSignature) {
      return {
        signature: "",
        status: "unknown",
        confirmationStatus: "unknown",
        slot: null,
        confirmations: null,
        error: "Missing signature",
      } as const;
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
      } as const;
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
    } as const;
  }

  async cancelSettlement(walletAddress: string, id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: "cancelled" },
    });

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "settlement.cancelled",
      "Settlement cancelled",
      {
        settlementId: settlement.id,
        amount: Number(settlement.amount),
        jurisdiction: settlement.fromJurisdiction,
        status: "success",
      },
    );

    return {
      id: updated.id,
      status: updated.status,
    };
  }

  async getLiveArcs() {
    const latest = await this.prisma.settlement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      arcs: latest.map((settlement, index) => ({
        from: this.toCityNode(
          settlement.fromInstitutionName,
          settlement.fromJurisdiction,
          index,
        ),
        to: this.toCityNode(
          settlement.toInstitutionName,
          settlement.toJurisdiction,
          index + 3,
        ),
        amount: Number(settlement.amount),
        status:
          settlement.status === "settling"
            ? "settling"
            : settlement.status === "completed"
              ? "completed"
              : "pending",
      })),
    };
  }

  async getMetrics(walletAddress: string) {
    const settlements = await this.prisma.settlement.findMany({
      where: {
        OR: [
          { initiatorWallet: walletAddress },
          { receiverWallet: walletAddress },
        ],
      },
    });

    const completed = settlements.filter((s) => s.status === "completed");
    const totalVolume = settlements.reduce(
      (sum, settlement) => sum + Number(settlement.amount),
      0,
    );
    const avgSeconds = completed.length
      ? Math.round(
          completed.reduce(
            (sum, settlement) =>
              sum +
              ((settlement.completedAt?.getTime() ??
                settlement.createdAt.getTime()) -
                settlement.createdAt.getTime()),
            0,
          ) /
            completed.length /
            1000,
        )
      : 0;

    const corridorMap = new Map<
      string,
      { corridor: string; volume: number; count: number }
    >();
    for (const settlement of settlements) {
      const corridor = settlement.corridor ?? "Unknown";
      const current = corridorMap.get(corridor) ?? {
        corridor,
        volume: 0,
        count: 0,
      };
      current.volume += Number(settlement.amount);
      current.count += 1;
      corridorMap.set(corridor, current);
    }

    return {
      totalVolume24h: totalVolume,
      totalVolume7d: totalVolume,
      totalSettlements: settlements.length,
      avgSettlementTimeSeconds: avgSeconds,
      successRate: settlements.length
        ? Number(((completed.length / settlements.length) * 100).toFixed(2))
        : 0,
      topCorridors: Array.from(corridorMap.values())
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    };
  }

  async getTravelRulePayload(walletAddress: string, id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (
      !settlement ||
      (settlement.initiatorWallet !== walletAddress &&
        settlement.receiverWallet !== walletAddress)
    ) {
      throw new NotFoundException("Settlement not found");
    }

    return {
      settlementId: settlement.id,
      complianceHash: settlement.complianceHash ?? "",
      ...this.asObjectRecord(settlement.travelRulePayload),
    };
  }

  private asObjectRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  streamLiveSettlements() {
    return interval(5000).pipe(
      startWith(0),
      switchMap(async () => {
        const latest = await this.prisma.settlement.findMany({
          orderBy: { updatedAt: "desc" },
          take: 5,
        });

        return latest.map((settlement) => ({
          data: JSON.stringify({
            id: settlement.id,
            status: settlement.status,
            amount: Number(settlement.amount),
            corridor: settlement.corridor,
            initiatedAt: settlement.createdAt.toISOString(),
            completedAt: settlement.completedAt?.toISOString(),
          }),
          type: "settlement",
        }));
      }),
      map(
        (events) =>
          events[0] ?? {
            data: JSON.stringify({ heartbeat: true }),
            type: "settlement",
          },
      ),
    );
  }

  private getJurisdictionCode(jurisdiction?: string | null): string {
    const nameToCode: Record<string, string> = {
      SWITZERLAND: "CH", CH: "CH",
      SINGAPORE: "SG", SG: "SG",
      GERMANY: "DE", DE: "DE",
      UAE: "AE", AE: "AE", "UNITED ARAB EMIRATES": "AE",
      "UNITED STATES": "US", US: "US", USA: "US",
      NIGERIA: "NG", NG: "NG", NIGER: "NG", NIGE: "NG",
      JAPAN: "JP", JP: "JP", JAPA: "JP",
      FRANCE: "FR", FR: "FR", FRAN: "FR",
      "UNITED KINGDOM": "GB", UK: "GB", GB: "GB",
    };
    let code = (jurisdiction ?? "").trim().toUpperCase();
    return nameToCode[code] ?? (code.length === 2 ? code : "US");
  }

  private toCityNode(name: string, jurisdiction?: string | null, offset = 0) {
    const positions: Record<
      string,
      { x: number; y: number; lat: number; lng: number }
    > = {
      CH: { x: 49, y: 28, lat: 47.3769, lng: 8.5417 },
      SG: { x: 79, y: 49, lat: 1.3521, lng: 103.8198 },
      DE: { x: 50, y: 26, lat: 50.1109, lng: 8.6821 },
      AE: { x: 64, y: 39, lat: 25.2048, lng: 55.2708 },
      US: { x: 24, y: 28, lat: 40.7128, lng: -74.006 },
      NG: { x: 49, y: 46, lat: 9.082, lng: 8.6753 },
      JP: { x: 86, y: 31, lat: 36.2048, lng: 138.2529 },
      GB: { x: 46, y: 24, lat: 55.3781, lng: -3.436 },
      FR: { x: 47, y: 28, lat: 46.2276, lng: 2.2137 },
    };
    const key = this.getJurisdictionCode(jurisdiction);
    const base = positions[key] ?? { x: 40, y: 30, lat: 0, lng: 0 };

    return {
      name,
      lat: base.lat,
      lng: base.lng,
      x: base.x + (offset % 3),
      y: base.y + (offset % 2),
    };
  }

  private getJurisdictionFlag(jurisdiction?: string | null) {
    if (!jurisdiction) return "🏳️";
    const nameToCode: Record<string, string> = {
      SWITZERLAND: "CH", CH: "CH",
      SINGAPORE: "SG", SG: "SG",
      GERMANY: "DE", DE: "DE",
      UAE: "AE", AE: "AE", "UNITED ARAB EMIRATES": "AE",
      "UNITED STATES": "US", US: "US", USA: "US",
      NIGERIA: "NG", NG: "NG", NIGER: "NG", NIGE: "NG",
      JAPAN: "JP", JP: "JP", JAPA: "JP",
      FRANCE: "FR", FR: "FR", FRAN: "FR",
      "UNITED KINGDOM": "GB", UK: "GB", GB: "GB",
    };
    let code = jurisdiction.trim().toUpperCase();
    if (nameToCode[code]) code = nameToCode[code];
    if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
    const offset = 127397; // U+1F1E6 = "A" regional indicator
    return String.fromCodePoint(
      code.charCodeAt(0) + offset,
      code.charCodeAt(1) + offset,
    );
  }

  private getDefaultCity(jurisdiction?: string | null) {
    const code = (jurisdiction ?? "").trim().toUpperCase();
    return (
      (
        {
          CH: "Zurich", SWITZERLAND: "Zurich",
          SG: "Singapore", SINGAPORE: "Singapore",
          DE: "Frankfurt", GERMANY: "Frankfurt",
          AE: "Dubai", UAE: "Dubai", "UNITED ARAB EMIRATES": "Dubai",
          US: "New York", "UNITED STATES": "New York", USA: "New York",
          NG: "Lagos", NIGERIA: "Lagos", NIGER: "Lagos", NIGE: "Lagos",
          JP: "Tokyo", JAPAN: "Tokyo", JAPA: "Tokyo",
          GB: "London", "UNITED KINGDOM": "London", UK: "London",
          FR: "Paris", FRANCE: "Paris", FRAN: "Paris",
        } as Record<string, string>
      )[code] ?? "Unknown"
    );
  }

  private buildSettlementReference(
    initiatorWallet: string,
    receiverWallet: string,
    amount: string | number,
  ) {
    const refInput = `${initiatorWallet}:${receiverWallet}:${String(amount)}:${Date.now()}`;
    return createHash("sha256").update(refInput).digest("hex");
  }
}
