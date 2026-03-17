import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SolanaService } from "../solana/solana.service";
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class ComplianceService {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly prisma: PrismaService,
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
      orderBy: { createdAt: "desc" },
    });

    const saved = await this.prisma.kycRequest.create({
      data: {
        walletAddress,
        institutionName:
          data.institutionName ??
          data.institution_name ??
          "Unknown Institution",
        jurisdiction: data.jurisdiction ?? null,
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

    return { requestId: saved.id, status: saved.status };
  }

  async getLatestKycRequest(walletAddress: string) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: "desc" },
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
      createdAt: latestRequest.createdAt,
      updatedAt: latestRequest.updatedAt,
    };
  }

  async triggerAmlScreening(walletAddress: string) {
    const lastChar = walletAddress.slice(-1).toLowerCase();
    const riskSeed = parseInt(lastChar, 36);
    const riskScore = Number.isNaN(riskSeed)
      ? 22
      : Math.min(95, 10 + riskSeed * 3);
    const flags: AmlFlag[] =
      riskScore >= 85
        ? [
            {
              category: "sanctions",
              severity: "critical",
              description: "Potential sanctions exposure identified",
              flagged_at: new Date().toISOString(),
            },
          ]
        : riskScore >= 70
          ? [
              {
                category: "adverse_media",
                severity: "medium",
                description: "Manual review recommended",
                flagged_at: new Date().toISOString(),
              },
            ]
          : [];

    const screening = await this.prisma.amlScreening.create({
      data: {
        walletAddress,
        riskScore,
        flags: flags as unknown as Prisma.InputJsonValue,
        provider: "MockAmlProvider",
        providerRef: `aml_${Date.now()}`,
        status:
          riskScore >= 85 ? "flagged" : riskScore >= 70 ? "review" : "cleared",
      },
    });

    await this.recordAuditEvent(
      walletAddress,
      screening.status === "cleared" ? "aml.cleared" : "aml.flag_raised",
      `AML screening ${screening.status}`,
      { riskScore, status: screening.status },
    );

    return this.formatAmlScreening(screening);
  }

  async getCounterparties(walletAddress: string) {
    const requests = await this.prisma.kycRequest.findMany({
      orderBy: { updatedAt: "desc" },
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
        last_verified: request.updatedAt.toISOString(),
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
        orderBy: { createdAt: "desc" },
      });

      // DEMO ONLY: If enabled, treat approved DB request as verified for testing.
      // In production/mainnet, access must come from an active on-chain credential.
      const demoModeEnabled = process.env.DEMO_MODE === "true";
      if (demoModeEnabled && latestRequest?.status === "approved") {
        return {
          credentialStatus: "verified",
          institution: {
            id: walletAddress,
            name: latestRequest.institutionName,
            tier: (latestRequest.tier as 1 | 2 | 3) ?? 3,
            jurisdiction: latestRequest.jurisdiction ?? "Unknown",
            jurisdictionFlag: this.getJurisdictionFlag(
              latestRequest.jurisdiction ?? "",
            ),
            city: this.getDefaultCity(latestRequest.jurisdiction ?? ""),
            walletAddress,
          },
        };
      }

      return {
        credentialStatus: latestRequest ? "pending_kyc" : "unregistered",
        institution: null,
      };
    }
  }

  /**
   * DEMO ONLY: Mark the latest KYC request for a wallet as approved.
   * This simulates compliance team approval and grants immediate access on next login.
   * Persisted in the database; intended for testing/demo recordings.
   */
  async approveKycRequest(walletAddress: string) {
    const latestRequest = await this.prisma.kycRequest.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRequest) {
      throw new Error(`No KYC request found for wallet ${walletAddress}`);
    }

    const updated = await this.prisma.kycRequest.update({
      where: { id: latestRequest.id },
      data: { status: "approved" },
    });

    await this.recordAuditEvent(
      walletAddress,
      "kyc.approved",
      "[DEMO] KYC request approved via demo grant endpoint",
      {
        requestId: latestRequest.id,
        institutionName: latestRequest.institutionName,
      },
    );

    return {
      success: true,
      message: `KYC request approved for ${latestRequest.institutionName}. Wallet ${walletAddress} will have verified status on next login.`,
      requestId: updated.id,
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
    const code = jurisdiction.trim().toUpperCase();
    const flags: Record<string, string> = {
      CH: "🇨🇭",
      SG: "🇸🇬",
      DE: "🇩🇪",
      AE: "🇦🇪",
      US: "🇺🇸",
      SWITZERLAND: "🇨🇭",
      SINGAPORE: "🇸🇬",
      GERMANY: "🇩🇪",
      UAE: "🇦🇪",
      "UNITED STATES": "🇺🇸",
    };

    return flags[code] ?? "🏳️";
  }

  private getDefaultCity(jurisdiction: string) {
    const normalized = jurisdiction.trim().toUpperCase();
    const cities: Record<string, string> = {
      CH: "Zurich",
      SWITZERLAND: "Zurich",
      SG: "Singapore",
      SINGAPORE: "Singapore",
      DE: "Frankfurt",
      GERMANY: "Frankfurt",
      AE: "Dubai",
      UAE: "Dubai",
      US: "New York",
      "UNITED STATES": "New York",
    };

    return cities[normalized] ?? "Unknown";
  }
}
