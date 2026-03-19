import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

type NotificationType = "settlement" | "compliance" | "vault" | "system";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: NotificationType;
};

@Injectable()
export class NotificationsService {
  private readonly readByWallet = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async list(walletAddress: string, limit = 20): Promise<NotificationItem[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { walletAddress },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });

    const readSet = this.readByWallet.get(walletAddress) ?? new Set<string>();

    return rows.map((row) => ({
      id: row.id,
      title: this.titleForEventType(row.eventType),
      message: row.description,
      timestamp: row.createdAt.toISOString(),
      read: readSet.has(row.id),
      type: this.typeForEventType(row.eventType),
    }));
  }

  markRead(walletAddress: string, id: string) {
    const set = this.readByWallet.get(walletAddress) ?? new Set<string>();
    set.add(id);
    this.readByWallet.set(walletAddress, set);
    return { success: true };
  }

  async markAllRead(walletAddress: string) {
    const rows = await this.prisma.auditEvent.findMany({
      where: { walletAddress },
      select: { id: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const set = this.readByWallet.get(walletAddress) ?? new Set<string>();
    rows.forEach((row) => set.add(row.id));
    this.readByWallet.set(walletAddress, set);

    return { success: true };
  }

  private typeForEventType(eventType: string): NotificationType {
    if (
      eventType.startsWith("settlement") ||
      eventType === "travel_rule.validated"
    ) {
      return "settlement";
    }
    if (
      eventType.startsWith("kyc") ||
      eventType.startsWith("aml") ||
      eventType.startsWith("credential")
    ) {
      return "compliance";
    }
    if (eventType.startsWith("vault")) {
      return "vault";
    }
    return "system";
  }

  private titleForEventType(eventType: string): string {
    if (eventType === "kyc.approved") return "KYC Approved";
    if (eventType === "kyc.rejected") return "KYC Rejected";
    if (eventType === "credential.issued") return "Credential Issued";
    if (eventType === "credential.renewed") return "Credential Renewed";
    if (eventType === "aml.flag_raised") return "AML Flag Raised";
    if (eventType.startsWith("settlement")) return "Settlement Update";
    if (eventType.startsWith("vault.deposit")) return "Vault Deposit";
    if (eventType.startsWith("vault.withdraw")) return "Vault Withdrawal";
    return "System Update";
  }

  async notifyKycApproved(data: {
    email: string;
    institutionName: string;
    tier: number;
  }) {
    return this.emailService.send({
      template: "kyc-approved",
      to: data.email,
      data: {
        institutionName: data.institutionName,
        tier: data.tier,
      },
    });
  }

  async notifyKycRejected(data: {
    email: string;
    institutionName: string;
    reason: string;
  }) {
    return this.emailService.send({
      template: "kyc-rejected",
      to: data.email,
      data: {
        institutionName: data.institutionName,
        reason: data.reason,
      },
    });
  }

  async notifySettlementInitiated(data: {
    email: string;
    settlementId: string;
    amount: string;
    receiver: string;
  }) {
    return this.emailService.send({
      template: "settlement-initiated",
      to: data.email,
      data: {
        settlementId: data.settlementId,
        amount: data.amount,
        receiver: data.receiver,
      },
    });
  }

  async notifySettlementCompleted(data: {
    email: string;
    settlementId: string;
    amount: string;
    txHash: string;
  }) {
    return this.emailService.send({
      template: "settlement-completed",
      to: data.email,
      data: {
        settlementId: data.settlementId,
        amount: data.amount,
        txHash: data.txHash,
      },
    });
  }

  async notifySettlementFailed(data: {
    email: string;
    settlementId: string;
    reason: string;
  }) {
    return this.emailService.send({
      template: "settlement-failed",
      to: data.email,
      data: {
        settlementId: data.settlementId,
        reason: data.reason,
      },
    });
  }
}
