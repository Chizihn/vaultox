import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { SolanaService } from "../solana/solana.service";
import { ComplianceService } from "../compliance/compliance.service";
import { PublicKey, Transaction } from "@solana/web3.js";
import { interval, map, startWith, switchMap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettlementsService {
  constructor(
    private readonly solanaService: SolanaService,
    private readonly complianceService: ComplianceService,
    private readonly prisma: PrismaService,
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

    // 3. Assemble tx
    const senderContext =
      await this.complianceService.resolveCredentialStatus(walletAddress);
    const tx = new Transaction();
    tx.feePayer = new PublicKey(walletAddress);
    tx.recentBlockhash = (
      await this.solanaService.connection.getLatestBlockhash()
    ).blockhash;
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
        amount: String(data.amount),
        currency: data.currency ?? "USDC",
        status: "settling",
        unsignedTransaction,
        estimatedCompletionMs: 1800,
        travelRulePayload: data.travelRule ?? null,
        complianceHash: `tr_${Date.now()}`,
        corridor: `${senderContext.institution?.jurisdiction ?? "UNK"} → ${data.receiver.jurisdiction ?? "UNK"}`,
        fxRate: 1,
      },
    });

    await this.complianceService.recordAuditEvent(
      walletAddress,
      "settlement.initiated",
      "Settlement initiated",
      {
        settlementId: saved.id,
        amount: Number(data.amount),
        jurisdiction: senderContext.institution?.jurisdiction,
        status: "success",
      },
    );

    return {
      settlementId: saved.id,
      unsignedTransaction,
      estimatedFee: "0.00",
      status: "pending_signature",
    };
  }

  async confirmSettlement(walletAddress: string, id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
        txHash:
          settlement.txHash ??
          `devnet_${settlement.id.replace(/-/g, "").slice(0, 24)}`,
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
    };
    const key = (jurisdiction ?? "US").toUpperCase().slice(0, 2);
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
    const code = (jurisdiction ?? "").trim().toUpperCase();
    return (
      (
        { CH: "🇨🇭", SG: "🇸🇬", DE: "🇩🇪", AE: "🇦🇪", US: "🇺🇸" } as Record<
          string,
          string
        >
      )[code] ?? "🏳️"
    );
  }

  private getDefaultCity(jurisdiction?: string | null) {
    const code = (jurisdiction ?? "").trim().toUpperCase();
    return (
      (
        {
          CH: "Zurich",
          SG: "Singapore",
          DE: "Frankfurt",
          AE: "Dubai",
          US: "New York",
        } as Record<string, string>
      )[code] ?? "Unknown"
    );
  }
}
