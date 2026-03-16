/**
 * services/settings.ts
 * ─────────────────────
 * Settings service — institution config, notifications, API keys, wallets.
 */

import api from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstitutionSettings {
  institutionName: string;
  jurisdiction: string;
  timezone: string;
  currency: string;
  settlementCurrency: "USDC" | "USDT";
  maxSingleSettlementUsd: number;
  requireTravelRuleAboveUsd: number;
  autoAmlScreening: boolean;
  rpcEndpoint?: string;
}

export interface NotificationPreferences {
  settlementCompleted: boolean;
  settlementFailed: boolean;
  amlFlagRaised: boolean;
  credentialExpiringSoon: boolean;
  yieldAccrued: boolean;
  reportReady: boolean;
  emailAddress?: string;
  webhookUrl?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string; // last 4 chars shown, e.g. "...ab3f"
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface ApiKeyCreated extends ApiKey {
  secret: string; // full key — shown once only
}

export interface ConnectedWallet {
  wallet: string;
  label: string;
  linkedAt: string;
  isPrimary: boolean;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<InstitutionSettings> {
  const { data } = await api.get<InstitutionSettings>("/settings");
  return data;
}

export async function updateSettings(
  payload: Partial<InstitutionSettings>,
): Promise<InstitutionSettings> {
  const { data } = await api.patch<InstitutionSettings>("/settings", payload);
  return data;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>(
    "/settings/notifications",
  );
  return data;
}

export async function updateNotificationPreferences(
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await api.patch<NotificationPreferences>(
    "/settings/notifications",
    payload,
  );
  return data;
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const { data } = await api.get<ApiKey[]>("/settings/api-keys");
  return data;
}

export async function createApiKey(name: string): Promise<ApiKeyCreated> {
  const { data } = await api.post<ApiKeyCreated>("/settings/api-keys", {
    name,
  });
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/settings/api-keys/${id}`);
}

export async function getConnectedWallets(): Promise<ConnectedWallet[]> {
  const { data } = await api.get<ConnectedWallet[]>(
    "/settings/connected-wallets",
  );
  return data;
}

export async function linkWallet(
  wallet: string,
  label: string,
): Promise<ConnectedWallet> {
  const { data } = await api.post<ConnectedWallet>(
    "/settings/connected-wallets",
    { wallet, label },
  );
  return data;
}

export async function unlinkWallet(wallet: string): Promise<void> {
  await api.delete(`/settings/connected-wallets/${wallet}`);
}

export async function updateRiskLimits(limits: {
  maxSingleSettlementUsd: number;
  dailySettlementLimitUsd?: number;
}): Promise<InstitutionSettings> {
  const { data } = await api.patch<InstitutionSettings>(
    "/settings/risk-limits",
    limits,
  );
  return data;
}
