import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SolanaService } from "../solana/solana.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "kyc.request_submitted"
  | "kyc.approved"
  | "kyc.rejected"
  | "aml.screening_triggered"
  | "aml.flag_raised"
  | "aml.cleared"
  | "settlement.initiated"
  | "settlement.confirmed"
  | "settlement.cancelled"
  | "vault.deposit"
  | "vault.withdraw"
  | "credential.issued"
  | "credential.renewed"
  | "credential.revoked"
  | "credential.restricted"
  | "travel_rule.validated";

type AmlFlag = {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  flagged_at: string;
};

type TierRecommendation = {
  recommendedTier: 1 | 2 | 3;
  amlRiskScore: number | null;
  amlStatus: "cleared" | "review" | "flagged" | "not_screened";
  amlScreenedAt: Date | null;
  reasons: string[];
  requiresManualReview: boolean;
};

type AmlAssessment = {
  riskScore: number;
  status: "cleared" | "review" | "flagged";
  flags: AmlFlag[];
  provider: string;
  providerRef: string;
};

@Injectable()
export class ComplianceService {
  /**
   * Scan for valid on-chain credentials and populate DB with missing KYC requests.
   */
  async resyncDbFromOnChainCredentials(walletAddresses: string[]) {
    const results = [];
    for (const wallet of walletAddresses) {
      try {
        const credential = await this.getCredential(wallet);
        // Check if DB record exists
        const existing = await this.prisma.kycRequest.findFirst({
          where: { walletAddress: wallet },
        });
        if (!existing && credential.isActive) {
          // Create DB record
          const created = await this.prisma.kycRequest.create({
            data: {
              walletAddress: wallet,
              institutionName: credential.institutionName,
              jurisdiction: credential.jurisdiction,
              tier: credential.tier,
              status: "approved",
              reviewerNotes: "Auto-resynced from on-chain credential",
            },
          });
          results.push({ wallet, status: "created", kycRequestId: created.id });
        } else {
          results.push({ wallet, status: existing ? "exists" : "inactive" });
        }
      } catch (err) {
        results.push({ wallet, status: "error", error: String(err) });
      }
    }
    return results;
  }
  async submitTierUpgradeRequest(walletAddress: string, data: any) {
    // Validate input
    const upgradeType = String(data.upgradeType ?? "general");
    const upgradeDocsHash = String(data.upgradeDocsHash ?? "");
    const upgradeRequestedTier = Number(data.upgradeRequestedTier ?? 3);
    const now = new Date();

    // Find latest KYC request
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    if (!latestRequest) {
      throw new NotFoundException("No KYC request found for wallet");
    }

    // Update KYC request with upgrade fields
    const updated = await this.prisma.kycRequest.update({
      where: { id: latestRequest.id },
      data: {
        upgradeType,
        upgradeDocsHash,
        upgradeRequestedTier,
        upgradeStatus: "pending",
        upgradeSlaDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days SLA
        upgradeCreatedAt: now,
        upgradeUpdatedAt: now,
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      "kyc.request_submitted",
      "Tier upgrade request submitted",
      {
        requestId: updated.id,
        upgradeType,
        upgradeDocsHash,
        upgradeRequestedTier,
        upgradeStatus: "pending",
      },
    );

    return {
      requestId: updated.id,
      upgradeStatus: (updated as any).upgradeStatus,
      upgradeSlaDeadline: (updated as any).upgradeSlaDeadline,
    };
  }
  constructor(
    private readonly solanaService: SolanaService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getCredential(walletAddress: string) {
    const account =
      await this.solanaService.getComplianceCredential(walletAddress);

    if (!account) {
      throw new NotFoundException("Credential not found");
    }

    // Format the parsed Anchor data into standard JSON response
    const tier = Number(account.tier) as 1 | 2 | 3;
    const amlCoverage = Number(account.amlCoverage);

    return {
      institutionWallet: account.wallet.toBase58(),
      institutionName: Buffer.from(account.institutionName)
        .toString("utf8")
        .replace(/\0/g, ""),
      jurisdiction: Buffer.from(account.jurisdiction)
        .toString("utf8")
        .replace(/\0/g, ""),
      jurisdictionFlag: this.getJurisdictionFlag(
        Buffer.from(account.jurisdiction).toString("utf8").replace(/\0/g, ""),
      ),
      tier,
      kycLevel: Number(account.kycLevel),
      amlCoverage,
      issuedAt: new Date(account.issuedAt.toNumber() * 1000).toISOString(),
      expiresAt: new Date(account.expiresAt.toNumber() * 1000).toISOString(),
      attestationHash: Buffer.from(account.attestationHash).toString("hex"),
      kycProvider: "Fireblocks Compliance",
      kycProviderVerifiedAt: new Date(
        account.issuedAt.toNumber() * 1000,
      ).toISOString(),
      status: account.status === 1 ? "verified" : "inactive",
      isActive: account.status === 1,
      credentialAddress: this.solanaService
        .getCredentialPda(walletAddress)
        .toBase58(),
      permissions: this.getPermissionsForTier(tier),
      complianceScores: {
        kycDepth: Number(account.kycLevel) * 32,
        amlCoverage,
        jurisdictionReach: tier === 1 ? 92 : tier === 2 ? 78 : 61,
        reportingQuality: 88,
        transactionLimits: tier === 1 ? 95 : tier === 2 ? 75 : 50,
      },
    };
  }

  async getAuditEvents(walletAddress: string, limit = 50, offset = 0) {
    const [events, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where: { walletAddress },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditEvent.count({ where: { walletAddress } }),
    ]);

    return {
      events: events.map((event) => ({
        id: event.id,
        timestamp: event.createdAt.toISOString(),
        eventType: this.mapAuditEventType(event.eventType),
        txHash: event.txHash ?? "",
        jurisdiction:
          (event.metadata as Record<string, any> | null)?.jurisdiction ?? "N/A",
        status:
          (event.metadata as Record<string, any> | null)?.status ?? "success",
        amount: (event.metadata as Record<string, any> | null)?.amount,
        description: event.description,
      })),
      total,
    };
  }

  async getLatestAmlScreening(walletAddress: string) {
    const screening = await this.prisma.amlScreening.findFirst({
      where: { walletAddress },
      orderBy: { screenedAt: "desc" },
    });

    if (!screening) {
      return this.triggerAmlScreening(walletAddress);
    }

    return this.formatAmlScreening(screening);
  }

  async submitKycRequest(walletAddress: string, data: any) {
    const existing = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    // Normalize jurisdiction to full country name or ISO code
    let jurisdiction = data.jurisdiction ?? null;
    if (jurisdiction && typeof jurisdiction === "string") {
      jurisdiction = jurisdiction.trim();
      // If it's a 2-letter code, uppercase it
      if (/^[A-Za-z]{2}$/.test(jurisdiction)) {
        jurisdiction = jurisdiction.toUpperCase();
      } else {
        // Otherwise, normalize to Title Case (e.g., "Nigeria")
        jurisdiction = jurisdiction
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
    const saved = await this.prisma.kycRequest.create({
      data: {
        walletAddress,
        institutionName:
          data.institutionName ??
          data.institution_name ??
          "Unknown Institution",
        jurisdiction,
        role: data.role ?? null,
        email: data.email ?? null,
        tier: Number(data.tier ?? 3),
        kycDocumentsHash:
          data.kycDocumentsHash ?? data.kyc_documents_hash ?? null,
        status: existing?.status === "approved" ? "under_review" : "pending",
      },
    });
    await this.recordAuditEvent(
      walletAddress,
      "kyc.request_submitted",
      "KYC access request submitted",
      {
        requestId: saved.id,
        institutionName: saved.institutionName,
        jurisdiction: saved.jurisdiction,
        status: saved.status,
      },
    );

    await this.triggerAmlScreening(walletAddress).catch(() => null);

    return { requestId: saved.id, status: saved.status };
  }

  async getLatestKycRequest(walletAddress: string) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    if (!latestRequest) {
      return null;
    }

    return {
      requestId: latestRequest.id,
      walletAddress: latestRequest.walletAddress,
      institutionName: latestRequest.institutionName,
      jurisdiction: latestRequest.jurisdiction,
      role: latestRequest.role,
      email: latestRequest.email,
      tier: latestRequest.tier,
      status: latestRequest.status,
      upgradeCreatedAt: latestRequest.upgradeCreatedAt,
      upgradeUpdatedAt: latestRequest.upgradeUpdatedAt,
    };
  }

  async listKycRequestsForReview(options?: {
    status?: "pending" | "under_review" | "approved" | "rejected";
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(200, Math.max(1, Number(options?.limit ?? 50)));
    const offset = Math.max(0, Number(options?.offset ?? 0));

    const where = options?.status ? { status: options.status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.kycRequest.findMany({
        where,
        orderBy: { upgradeCreatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.kycRequest.count({ where }),
    ]);

    const wallets = Array.from(
      new Set(items.map((item) => item.walletAddress)),
    );
    const latestTxByWallet = new Map<
      string,
      { txHash: string; createdAt: Date }
    >();
    const latestAmlByWallet = new Map<
      string,
      {
        riskScore: number;
        status: "cleared" | "review" | "flagged";
        screenedAt: Date;
        flags: Prisma.JsonValue;
      }
    >();

    await Promise.all(
      wallets.map(async (walletAddress) => {
        const latestCredentialAudit = await this.prisma.auditEvent.findFirst({
          where: {
            walletAddress,
            eventType: {
              in: ["credential.issued", "credential.renewed"],
            },
            txHash: {
              not: null,
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            txHash: true,
            createdAt: true,
          },
        });

        if (latestCredentialAudit?.txHash) {
          latestTxByWallet.set(walletAddress, {
            txHash: latestCredentialAudit.txHash,
            createdAt: latestCredentialAudit.createdAt,
          });
        }

        const latestAml = await this.prisma.amlScreening.findFirst({
          where: { walletAddress },
          orderBy: { screenedAt: "desc" },
          select: {
            riskScore: true,
            status: true,
            screenedAt: true,
            flags: true,
          },
        });

        if (latestAml) {
          latestAmlByWallet.set(walletAddress, latestAml);
        }
      }),
    );

    return {
      total,
      limit,
      offset,
      items: items.map((item) => {
        const recommendation = this.resolveTierRecommendation(
          {
            requestedTier: Math.min(3, Math.max(1, item.tier || 3)) as
              | 1
              | 2
              | 3,
            jurisdiction: item.jurisdiction,
          },
          latestAmlByWallet.get(item.walletAddress),
        );

        return {
          id: item.id,
          walletAddress: item.walletAddress,
          institutionName: item.institutionName,
          jurisdiction: item.jurisdiction,
          role: item.role,
          email: item.email,
          tier: item.tier,
          status: item.status,
          reviewerNotes: item.reviewerNotes,
          amlRiskScore: recommendation.amlRiskScore,
          amlStatus: recommendation.amlStatus,
          amlScreenedAt: recommendation.amlScreenedAt,
          recommendedTier: recommendation.recommendedTier,
          tierRecommendationReasons: recommendation.reasons,
          requiresManualReview: recommendation.requiresManualReview,
          latestCredentialTxHash:
            latestTxByWallet.get(item.walletAddress)?.txHash ?? null,
          latestCredentialTxAt:
            latestTxByWallet.get(item.walletAddress)?.createdAt ?? null,
          upgradeCreatedAt: item.upgradeCreatedAt,
          upgradeUpdatedAt: item.upgradeUpdatedAt,
        };
      }),
    };
  }

  async triggerAmlScreening(walletAddress: string) {
    const assessment = this.evaluateAmlAssessment(walletAddress);

    const screening = await this.prisma.amlScreening.create({
      data: {
        walletAddress,
        riskScore: assessment.riskScore,
        flags: assessment.flags as unknown as Prisma.InputJsonValue,
        provider: assessment.provider,
        providerRef: assessment.providerRef,
        status: assessment.status,
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      screening.status === "cleared" ? "aml.cleared" : "aml.flag_raised",
      `AML screening ${screening.status}`,
      {
        riskScore: assessment.riskScore,
        status: screening.status,
        provider: assessment.provider,
      },
    );

    return this.formatAmlScreening(screening);
  }

  async getCounterparties(walletAddress: string) {
    const requests = await this.prisma.kycRequest.findMany({
      orderBy: { upgradeUpdatedAt: "desc" },
      take: 20,
    });

    return requests
      .filter((request) => request.walletAddress !== walletAddress)
      .map((request) => ({
        wallet: request.walletAddress,
        institution_name: request.institutionName,
        jurisdiction: request.jurisdiction ?? "Unknown",
        jurisdictionFlag: this.getJurisdictionFlag(request.jurisdiction ?? ""),
        tier: Math.min(3, Math.max(1, request.tier || 3)) as 1 | 2 | 3,
        kyc_level: Math.min(3, Math.max(1, request.tier || 3)),
        last_verified: request.upgradeUpdatedAt
          ? request.upgradeUpdatedAt.toISOString()
          : request.upgradeCreatedAt
            ? request.upgradeCreatedAt.toISOString()
            : null,
        status:
          request.status === "approved"
            ? "verified"
            : request.status === "pending" || request.status === "under_review"
              ? "pending"
              : "revoked",
      }));
  }

  async resolveCredentialStatus(walletAddress: string) {
    try {
      const credential = await this.getCredential(walletAddress);
      return {
        credentialStatus: credential.isActive ? "verified" : "unregistered",
        institution: credential.isActive
          ? {
              id: credential.institutionWallet,
              name: credential.institutionName,
              tier: credential.tier,
              jurisdiction: credential.jurisdiction,
              jurisdictionFlag: credential.jurisdictionFlag,
              city: this.getDefaultCity(credential.jurisdiction),
              walletAddress: credential.institutionWallet,
            }
          : null,
      };
    } catch {
      const latestRequest = await this.prisma.kycRequest.findFirst({
        where: { walletAddress },
        orderBy: { upgradeCreatedAt: "desc" },
      });

      return {
        credentialStatus: latestRequest ? "pending_kyc" : "unregistered",
        institution: null,
      };
    }
  }

  async approveKycRequest(
    walletAddress: string,
    options?: {
      reviewerNotes?: string;
      tier?: number;
      kycLevel?: number;
      amlCoverage?: number;
      validityDays?: number;
      attestationHash?: string;
      overrideApprovalKey?: string;
    },
  ) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    if (!latestRequest) {
      throw new Error(`No KYC request found for wallet ${walletAddress}`);
    }

    const latestAml = await this.prisma.amlScreening.findFirst({
      where: { walletAddress },
      orderBy: { screenedAt: "desc" },
      select: {
        riskScore: true,
        status: true,
        screenedAt: true,
        flags: true,
      },
    });

    const recommendation = this.resolveTierRecommendation(
      {
        requestedTier: Math.min(
          3,
          Math.max(1, Number(latestRequest.tier ?? 3)),
        ) as 1 | 2 | 3,
        jurisdiction: latestRequest.jurisdiction,
      },
      latestAml,
    );

    const tier = Math.min(
      3,
      Math.max(
        1,
        Number(
          options?.tier ??
            recommendation.recommendedTier ??
            latestRequest.tier ??
            3,
        ),
      ),
    ) as 1 | 2 | 3;

    const overrideUsed = tier < recommendation.recommendedTier;
    if (overrideUsed) {
      const configuredOverrideKey = this.normalizeApiKey(
        process.env.ADMIN_OVERRIDE_API_KEY,
      );
      const providedOverrideKey = this.normalizeApiKey(
        options?.overrideApprovalKey,
      );

      if (!configuredOverrideKey) {
        throw new ForbiddenException("ADMIN_OVERRIDE_API_KEY_NOT_CONFIGURED");
      }

      if (
        !providedOverrideKey ||
        providedOverrideKey !== configuredOverrideKey
      ) {
        throw new ForbiddenException("INVALID_ADMIN_OVERRIDE_API_KEY");
      }
    }

    const issuance = await this.solanaService.issueOrRenewComplianceCredential({
      walletAddress,
      institutionName: latestRequest.institutionName,
      jurisdiction: latestRequest.jurisdiction ?? "US",
      tier,
      kycLevel: options?.kycLevel,
      amlCoverage: options?.amlCoverage,
      validityDays: options?.validityDays,
      attestationHash: options?.attestationHash,
    });

    const updated = await this.prisma.kycRequest.update({
      where: { id: latestRequest.id },
      data: {
        status: "approved",
        tier,
        reviewerNotes:
          options?.reviewerNotes ??
          `Approved via policy tier ${recommendation.recommendedTier}; credential ${issuance.action} on-chain`,
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      "kyc.approved",
      "KYC request approved",
      {
        requestId: latestRequest.id,
        institutionName: latestRequest.institutionName,
        amlRiskScore: recommendation.amlRiskScore,
        amlStatus: recommendation.amlStatus,
        recommendedTier: recommendation.recommendedTier,
        approvedTier: tier,
        overrideUsed,
      },
      issuance.txHash,
    );

    await this.recordAuditEvent(
      walletAddress,
      issuance.action === "issued" ? "credential.issued" : "credential.renewed",
      `Compliance credential ${issuance.action} on-chain`,
      {
        credentialAddress: issuance.credentialAddress,
        tier,
      },
      issuance.txHash,
    );

    // Send email notification for KYC approval
    if (latestRequest.email) {
      try {
        await this.notificationsService.notifyKycApproved({
          email: latestRequest.email,
          institutionName: latestRequest.institutionName,
          tier,
        });
      } catch (error) {
        // Log error but don't fail the approval
        console.error("Failed to send KYC approval email:", error);
      }
    }

    return {
      success: true,
      message: `KYC request approved and credential ${issuance.action} on-chain for ${latestRequest.institutionName}.`,
      requestId: updated.id,
      txHash: issuance.txHash,
      credentialAddress: issuance.credentialAddress,
      overrideUsed,
    };
  }

  async resyncApprovedCredential(
    walletAddress: string,
    options?: {
      reviewerNotes?: string;
      tier?: number;
      kycLevel?: number;
      amlCoverage?: number;
      validityDays?: number;
      attestationHash?: string;
    },
  ) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    if (!latestRequest) {
      throw new Error(`No KYC request found for wallet ${walletAddress}`);
    }

    if (latestRequest.status !== "approved") {
      throw new Error(
        `Cannot resync credential: latest KYC status is '${latestRequest.status}', expected 'approved'`,
      );
    }

    const tier = Math.min(
      3,
      Math.max(1, Number(options?.tier ?? latestRequest.tier ?? 3)),
    ) as 1 | 2 | 3;

    const issuance = await this.solanaService.issueOrRenewComplianceCredential({
      walletAddress,
      institutionName: latestRequest.institutionName,
      jurisdiction: latestRequest.jurisdiction ?? "US",
      tier,
      kycLevel: options?.kycLevel,
      amlCoverage: options?.amlCoverage,
      validityDays: options?.validityDays,
      attestationHash: options?.attestationHash,
    });

    const updated = await this.prisma.kycRequest.update({
      where: { id: latestRequest.id },
      data: {
        tier,
        reviewerNotes:
          options?.reviewerNotes ??
          `Admin resync: credential ${issuance.action} on-chain`,
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      issuance.action === "issued" ? "credential.issued" : "credential.renewed",
      `Compliance credential ${issuance.action} via admin resync`,
      {
        requestId: updated.id,
        credentialAddress: issuance.credentialAddress,
        tier,
      },
      issuance.txHash,
    );

    return {
      success: true,
      message: `Credential ${issuance.action} on-chain via resync for ${latestRequest.institutionName}.`,
      requestId: updated.id,
      txHash: issuance.txHash,
      credentialAddress: issuance.credentialAddress,
    };
  }

  async rejectKycRequest(walletAddress: string, reviewerNotes?: string) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { upgradeCreatedAt: "desc" },
    });

    if (!latestRequest) {
      throw new Error(`No KYC request found for wallet ${walletAddress}`);
    }

    const updated = await this.prisma.kycRequest.update({
      where: { id: latestRequest.id },
      data: {
        status: "rejected",
        reviewerNotes: reviewerNotes ?? "Rejected during manual review",
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      "kyc.rejected",
      "KYC request rejected",
      {
        requestId: updated.id,
        institutionName: updated.institutionName,
      },
    );

    // Send email notification for KYC rejection
    if (latestRequest.email) {
      try {
        await this.notificationsService.notifyKycRejected({
          email: latestRequest.email,
          institutionName: latestRequest.institutionName,
          reason: reviewerNotes || "Rejected during manual review",
        });
      } catch (error) {
        // Log error but don't fail the rejection
        console.error("Failed to send KYC rejection email:", error);
      }
    }

    return {
      success: true,
      requestId: updated.id,
      status: updated.status,
    };
  }

  async recordAuditEvent(
    walletAddress: string,
    eventType: AuditEventType,
    description: string,
    metadata?: Record<string, any>,
    txHash?: string,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        walletAddress,
        eventType,
        description,
        metadata: (metadata ?? null) as Prisma.InputJsonValue,
        txHash: txHash ?? null,
      },
    });
  }

  private formatAmlScreening(screening: {
    walletAddress: string;
    screenedAt: Date;
    riskScore: number;
    flags: Prisma.JsonValue;
    status: "cleared" | "flagged" | "review";
    provider: string;
  }) {
    return {
      wallet: screening.walletAddress,
      screened_at: screening.screenedAt.toISOString(),
      risk_score: screening.riskScore,
      flags: (screening.flags as unknown as AmlFlag[]) ?? [],
      status: screening.status,
      provider: screening.provider,
    };
  }

  private mapAuditEventType(
    eventType: string,
  ):
    | "deposit"
    | "withdrawal"
    | "settlement"
    | "credential_update"
    | "report_generated" {
    if (eventType === "vault.deposit") return "deposit";
    if (eventType === "vault.withdraw") return "withdrawal";
    if (
      eventType.startsWith("settlement") ||
      eventType === "travel_rule.validated"
    )
      return "settlement";
    return "credential_update";
  }

  private getPermissionsForTier(tier: 1 | 2 | 3) {
    return [
      {
        label: "Vault Access",
        value:
          tier === 1
            ? "All Vaults"
            : tier === 2
              ? "Standard Vaults"
              : "T-Bill Only",
        enabled: true,
      },
      {
        label: "Settlement Scope",
        value: tier === 3 ? "Domestic Only" : "Cross-Border Enabled",
        enabled: true,
      },
      {
        label: "Travel Rule",
        value: "Required Above Threshold",
        enabled: true,
      },
      { label: "Reporting", value: "Institutional Audit Trail", enabled: true },
    ];
  }

  private getJurisdictionFlag(jurisdiction: string) {
    if (!jurisdiction) return "🏳️";
    const nameToCode: Record<string, string> = {
      SWITZERLAND: "CH",
      SINGAPORE: "SG",
      GERMANY: "DE",
      UAE: "AE",
      "UNITED STATES": "US",
      USA: "US",
      CHINA: "CN",
      JAPAN: "JP",
      "UNITED KINGDOM": "GB",
      UK: "GB",
      FRANCE: "FR",
      INDIA: "IN",
      CANADA: "CA",
      AUSTRALIA: "AU",
      RUSSIA: "RU",
      BRAZIL: "BR",
      "SOUTH AFRICA": "ZA",
      NIGERIA: "NG",
      KENYA: "KE",
      HONGKONG: "HK",
      HONG_KONG: "HK",
      "HONG KONG": "HK",
      TAIWAN: "TW",
      KOREA: "KR",
      "SOUTH KOREA": "KR",
      "NORTH KOREA": "KP",
      TURKEY: "TR",
      TÜRKİYE: "TR",
      MEXICO: "MX",
      ARGENTINA: "AR",
      SPAIN: "ES",
      ITALY: "IT",
      POLAND: "PL",
      NETHERLANDS: "NL",
      BELGIUM: "BE",
      SWEDEN: "SE",
      NORWAY: "NO",
      DENMARK: "DK",
      FINLAND: "FI",
      AUSTRIA: "AT",
      IRELAND: "IE",
      PORTUGAL: "PT",
      GREECE: "GR",
      HUNGARY: "HU",
      CZECHIA: "CZ",
      CZECH: "CZ",
      SLOVAKIA: "SK",
      ROMANIA: "RO",
      BULGARIA: "BG",
      CROATIA: "HR",
      SLOVENIA: "SI",
      ESTONIA: "EE",
      LATVIA: "LV",
      LITHUANIA: "LT",
      LUXEMBOURG: "LU",
      ICELAND: "IS",
      MALTA: "MT",
      CYPRUS: "CY",
      MONACO: "MC",
      LIECHTENSTEIN: "LI",
      SAN_MARINO: "SM",
      "SAN MARINO": "SM",
      VATICAN: "VA",
      ANDORRA: "AD",
      "NEW ZEALAND": "NZ",
      ISRAEL: "IL",
      SAUDI_ARABIA: "SA",
      "SAUDI ARABIA": "SA",
      QATAR: "QA",
      BAHRAIN: "BH",
      KUWAIT: "KW",
      OMAN: "OM",
      EGYPT: "EG",
      MOROCCO: "MA",
      TUNISIA: "TN",
      ALGERIA: "DZ",
      ETHIOPIA: "ET",
      GHANA: "GH",
      UGANDA: "UG",
      TANZANIA: "TZ",
      ZIMBABWE: "ZW",
      ZAMBIA: "ZM",
      BOTSWANA: "BW",
      MOZAMBIQUE: "MZ",
      ANGOLA: "AO",
      SENEGAL: "SN",
      CAMEROON: "CM",
      COTE_DIVOIRE: "CI",
      "CÔTE D'IVOIRE": "CI",
      SUDAN: "SD",
      SOUTH_SUDAN: "SS",
      "SOUTH SUDAN": "SS",
      "UNITED ARAB EMIRATES": "AE",
      // add more as needed
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

  private evaluateAmlAssessment(walletAddress: string): AmlAssessment {
    const strategy = (process.env.AML_PROVIDER_STRATEGY ?? "deterministic")
      .trim()
      .toLowerCase();

    if (strategy === "allowlist") {
      return this.evaluateAllowlistAssessment(walletAddress);
    }

    return this.evaluateDeterministicAssessment(walletAddress);
  }

  private evaluateAllowlistAssessment(walletAddress: string): AmlAssessment {
    const normalizedWallet = walletAddress.trim().toLowerCase();
    const flaggedWallets = this.parseEnvCsv("AML_FLAGGED_WALLETS");
    const reviewWallets = this.parseEnvCsv("AML_REVIEW_WALLETS");
    const timestamp = new Date().toISOString();

    if (flaggedWallets.includes(normalizedWallet)) {
      return {
        riskScore: 90,
        status: "flagged",
        flags: [
          {
            category: "sanctions",
            severity: "critical",
            description: "Wallet matched configured AML flagged list",
            flagged_at: timestamp,
          },
        ],
        provider: process.env.AML_PROVIDER_NAME?.trim() || "AmlAllowlistEngine",
        providerRef: `aml_allowlist_${Date.now()}`,
      };
    }

    if (reviewWallets.includes(normalizedWallet)) {
      return {
        riskScore: 72,
        status: "review",
        flags: [
          {
            category: "adverse_media",
            severity: "medium",
            description: "Wallet matched configured AML review list",
            flagged_at: timestamp,
          },
        ],
        provider: process.env.AML_PROVIDER_NAME?.trim() || "AmlAllowlistEngine",
        providerRef: `aml_allowlist_${Date.now()}`,
      };
    }

    return {
      riskScore: 24,
      status: "cleared",
      flags: [],
      provider: process.env.AML_PROVIDER_NAME?.trim() || "AmlAllowlistEngine",
      providerRef: `aml_allowlist_${Date.now()}`,
    };
  }

  private evaluateDeterministicAssessment(
    walletAddress: string,
  ): AmlAssessment {
    const lastChar = walletAddress.slice(-1).toLowerCase();
    const riskSeed = parseInt(lastChar, 36);
    const riskScore = Number.isNaN(riskSeed)
      ? 22
      : Math.min(95, 10 + riskSeed * 3);
    const timestamp = new Date().toISOString();

    const flags: AmlFlag[] =
      riskScore >= 85
        ? [
            {
              category: "sanctions",
              severity: "critical",
              description: "Potential sanctions exposure identified",
              flagged_at: timestamp,
            },
          ]
        : riskScore >= 70
          ? [
              {
                category: "adverse_media",
                severity: "medium",
                description: "Manual review recommended",
                flagged_at: timestamp,
              },
            ]
          : [];

    return {
      riskScore,
      status:
        riskScore >= 85 ? "flagged" : riskScore >= 70 ? "review" : "cleared",
      flags,
      provider: process.env.AML_PROVIDER_NAME?.trim() || "PolicyAmlProvider",
      providerRef: `aml_${Date.now()}`,
    };
  }

  private parseEnvCsv(name: string): string[] {
    const value = (process.env[name] ?? "").trim();
    if (!value) {
      return [];
    }

    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private getDefaultCity(jurisdiction: string) {
    const normalized = jurisdiction.trim().toUpperCase();
    const cities: Record<string, string> = {
      CH: "Zurich", SWITZERLAND: "Zurich",
      SG: "Singapore", SINGAPORE: "Singapore",
      DE: "Frankfurt", GERMANY: "Frankfurt",
      AE: "Dubai", UAE: "Dubai", "UNITED ARAB EMIRATES": "Dubai",
      US: "New York", USA: "New York", "UNITED STATES": "New York",
      GB: "London", UK: "London", "UNITED KINGDOM": "London",
      FR: "Paris", FRANCE: "Paris",
      JP: "Tokyo", JAPAN: "Tokyo",
      CN: "Shanghai", CHINA: "Shanghai",
      HK: "Hong Kong", "HONG KONG": "Hong Kong",
      NG: "Lagos", NIGERIA: "Lagos",
      ZA: "Johannesburg", "SOUTH AFRICA": "Johannesburg",
      BR: "São Paulo", BRAZIL: "São Paulo",
      IN: "Mumbai", INDIA: "Mumbai",
      CA: "Toronto", CANADA: "Toronto",
      AU: "Sydney", AUSTRALIA: "Sydney",
      KR: "Seoul", "SOUTH KOREA": "Seoul",
      MX: "Mexico City", MEXICO: "Mexico City",
      ES: "Madrid", SPAIN: "Madrid",
      IT: "Milan", ITALY: "Milan",
      NL: "Amsterdam", NETHERLANDS: "Amsterdam"
    };

    return cities[normalized] ?? (jurisdiction.trim() || "Unknown");
  }

  private resolveTierRecommendation(
    request: {
      requestedTier: 1 | 2 | 3;
      jurisdiction?: string | null;
    },
    screening?: {
      riskScore: number;
      status: "cleared" | "review" | "flagged";
      screenedAt: Date;
      flags: Prisma.JsonValue;
    },
  ): TierRecommendation {
    let recommendedTier: 1 | 2 | 3 = 1;
    const reasons: string[] = [];
    let requiresManualReview = false;

    const jurisdiction = (request.jurisdiction ?? "").trim().toUpperCase();
    const trustedJurisdictions = new Set([
      "CH",
      "SWITZERLAND",
      "SG",
      "SINGAPORE",
      "DE",
      "GERMANY",
      "US",
      "UNITED STATES",
    ]);
    const monitoredJurisdictions = new Set([
      "AE",
      "UAE",
      "UNITED ARAB EMIRATES",
    ]);

    if (jurisdiction && !trustedJurisdictions.has(jurisdiction)) {
      if (monitoredJurisdictions.has(jurisdiction)) {
        recommendedTier = Math.max(recommendedTier, 2) as 1 | 2 | 3;
        reasons.push("Monitored jurisdiction policy sets minimum Tier 2");
      } else {
        recommendedTier = Math.max(recommendedTier, 3) as 1 | 2 | 3;
        reasons.push("Unrecognized jurisdiction policy sets Tier 3");
      }
    }

    const amlRiskScore = screening?.riskScore ?? null;
    const amlStatus = screening?.status ?? "not_screened";
    const amlScreenedAt = screening?.screenedAt ?? null;

    if (amlRiskScore !== null) {
      if (amlRiskScore >= 85 || amlStatus === "flagged") {
        recommendedTier = 3;
        requiresManualReview = true;
        reasons.push("High AML risk/flagged profile requires Tier 3");
      } else if (amlRiskScore >= 70 || amlStatus === "review") {
        recommendedTier = Math.max(recommendedTier, 2) as 1 | 2 | 3;
        requiresManualReview = true;
        reasons.push("AML review profile requires at least Tier 2");
      } else if (amlRiskScore >= 50) {
        recommendedTier = Math.max(recommendedTier, 2) as 1 | 2 | 3;
        reasons.push("Moderate AML risk suggests Tier 2");
      } else {
        reasons.push("Low AML risk eligible for Tier 1");
      }
    } else {
      recommendedTier = Math.max(recommendedTier, 2) as 1 | 2 | 3;
      requiresManualReview = true;
      reasons.push(
        "No AML screening available; defaulting to Tier 2 pending review",
      );
    }

    recommendedTier = Math.max(recommendedTier, request.requestedTier) as
      | 1
      | 2
      | 3;
    if (recommendedTier === request.requestedTier) {
      reasons.push(
        `Requested tier ${request.requestedTier} retained as minimum`,
      );
    }

    return {
      recommendedTier,
      amlRiskScore,
      amlStatus,
      amlScreenedAt,
      reasons,
      requiresManualReview,
    };
  }

  private normalizeApiKey(value?: string | null): string {
    return (value ?? "").trim().replace(/^['\"]|['\"]$/g, "");
  }
}
