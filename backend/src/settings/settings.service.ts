import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";

type InstitutionSettings = {
  institutionName: string;
  jurisdiction: string;
  timezone: string;
  currency: string;
  settlementCurrency: "USDC" | "USDT";
  maxSingleSettlementUsd: number;
  requireTravelRuleAboveUsd: number;
  autoAmlScreening: boolean;
  rpcEndpoint?: string;
};

type NotificationPreferences = {
  settlementCompleted: boolean;
  settlementFailed: boolean;
  amlFlagRaised: boolean;
  credentialExpiringSoon: boolean;
  yieldAccrued: boolean;
  reportReady: boolean;
  emailAddress?: string;
  webhookUrl?: string;
};

type ApiKeyRecord = {
  id: string;
  name: string;
  secret: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
};

type ConnectedWallet = {
  wallet: string;
  label: string;
  linkedAt: string;
  isPrimary: boolean;
};

@Injectable()
export class SettingsService {
  private readonly settingsByWallet = new Map<string, InstitutionSettings>();
  private readonly notificationPrefsByWallet = new Map<
    string,
    NotificationPreferences
  >();
  private readonly apiKeysByWallet = new Map<string, ApiKeyRecord[]>();
  private readonly connectedWalletsByWallet = new Map<
    string,
    ConnectedWallet[]
  >();

  getSettings(walletAddress: string): InstitutionSettings {
    if (!this.settingsByWallet.has(walletAddress)) {
      this.settingsByWallet.set(walletAddress, this.defaultSettings());
    }
    return this.settingsByWallet.get(walletAddress)!;
  }

  updateSettings(
    walletAddress: string,
    patch: Partial<InstitutionSettings>,
  ): InstitutionSettings {
    const next = {
      ...this.getSettings(walletAddress),
      ...patch,
    };
    this.settingsByWallet.set(walletAddress, next);
    return next;
  }

  updateRiskLimits(
    walletAddress: string,
    patch: {
      maxSingleSettlementUsd: number;
      dailySettlementLimitUsd?: number;
    },
  ): InstitutionSettings {
    return this.updateSettings(walletAddress, {
      maxSingleSettlementUsd: patch.maxSingleSettlementUsd,
      requireTravelRuleAboveUsd:
        patch.dailySettlementLimitUsd ??
        this.getSettings(walletAddress).requireTravelRuleAboveUsd,
    });
  }

  getNotificationPreferences(walletAddress: string): NotificationPreferences {
    if (!this.notificationPrefsByWallet.has(walletAddress)) {
      this.notificationPrefsByWallet.set(
        walletAddress,
        this.defaultNotificationPreferences(),
      );
    }
    return this.notificationPrefsByWallet.get(walletAddress)!;
  }

  updateNotificationPreferences(
    walletAddress: string,
    patch: Partial<NotificationPreferences>,
  ): NotificationPreferences {
    const next = {
      ...this.getNotificationPreferences(walletAddress),
      ...patch,
    };
    this.notificationPrefsByWallet.set(walletAddress, next);
    return next;
  }

  getApiKeys(walletAddress: string) {
    return (this.apiKeysByWallet.get(walletAddress) ?? []).map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
    }));
  }

  createApiKey(walletAddress: string, name: string) {
    const secret = `vox_${randomBytes(24).toString("hex")}`;
    const created: ApiKeyRecord = {
      id: randomUUID(),
      name: name.trim() || "VaultOX API Key",
      secret,
      prefix: `...${secret.slice(-4)}`,
      createdAt: new Date().toISOString(),
    };

    const list = this.apiKeysByWallet.get(walletAddress) ?? [];
    this.apiKeysByWallet.set(walletAddress, [created, ...list]);

    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      createdAt: created.createdAt,
      secret: created.secret,
    };
  }

  revokeApiKey(walletAddress: string, id: string): void {
    const list = this.apiKeysByWallet.get(walletAddress) ?? [];
    this.apiKeysByWallet.set(
      walletAddress,
      list.filter((entry) => entry.id !== id),
    );
  }

  getConnectedWallets(walletAddress: string): ConnectedWallet[] {
    if (!this.connectedWalletsByWallet.has(walletAddress)) {
      this.connectedWalletsByWallet.set(walletAddress, [
        {
          wallet: walletAddress,
          label: "Primary",
          linkedAt: new Date().toISOString(),
          isPrimary: true,
        },
      ]);
    }

    return this.connectedWalletsByWallet.get(walletAddress)!;
  }

  linkWallet(
    walletAddress: string,
    payload: { wallet: string; label: string },
  ): ConnectedWallet {
    const list = this.getConnectedWallets(walletAddress);
    const existing = list.find((entry) => entry.wallet === payload.wallet);
    if (existing) {
      return existing;
    }

    const next: ConnectedWallet = {
      wallet: payload.wallet,
      label: payload.label?.trim() || "Linked Wallet",
      linkedAt: new Date().toISOString(),
      isPrimary: false,
    };

    this.connectedWalletsByWallet.set(walletAddress, [...list, next]);
    return next;
  }

  unlinkWallet(walletAddress: string, linkedWallet: string): void {
    const list = this.getConnectedWallets(walletAddress);
    this.connectedWalletsByWallet.set(
      walletAddress,
      list.filter((entry) => entry.isPrimary || entry.wallet !== linkedWallet),
    );
  }

  private defaultSettings(): InstitutionSettings {
    return {
      institutionName: "VaultOX Institution",
      jurisdiction: "Switzerland",
      timezone: "Europe/Zurich (UTC+1)",
      currency: "USD",
      settlementCurrency: "USDC",
      maxSingleSettlementUsd: 500000,
      requireTravelRuleAboveUsd: 1000,
      autoAmlScreening: true,
      rpcEndpoint: process.env.SOLANA_RPC_URL,
    };
  }

  private defaultNotificationPreferences(): NotificationPreferences {
    return {
      settlementCompleted: true,
      settlementFailed: true,
      amlFlagRaised: true,
      credentialExpiringSoon: true,
      yieldAccrued: true,
      reportReady: false,
    };
  }
}
