/**
 * services/settlements.ts
 * ────────────────────────
 * Settlement service — initiate, confirm, cancel, Travel Rule, metrics.
 */

import api, { PaginatedResponse } from "./api";
import type { Settlement } from "@/types";
import { getAccessToken } from "@/utils/session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TravelRulePayload {
  originatorName: string;
  originatorAddress: string;
  originatorAccountId: string; // IBAN or routing number
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryAccountId: string;
  purposeCode: string; // ISO 20022, e.g. "INTC", "SUPP"
}

export interface InitiateSettlementRequest {
  receiver: {
    walletAddress: string;
    institutionName: string;
    jurisdiction: string;
    bic?: string;
    iban?: string;
  };
  amount: string; // string for precision
  currency: "USDC" | "USDT";
  memo?: string;
  travelRule: TravelRulePayload;
}

export interface InitiateSettlementResponse {
  settlementId: string;
  unsignedTransaction: string; // base64 Solana tx
  estimatedFee: string;
  status: "pending_signature";
}

export interface SettlementMetrics {
  totalVolume24h: number;
  totalVolume7d: number;
  totalSettlements: number;
  avgSettlementTimeSeconds: number;
  successRate: number;
  topCorridors: Array<{ corridor: string; volume: number; count: number }>;
}

export interface SettlementListParams {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  corridor?: string;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function getSettlements(
  params?: SettlementListParams,
): Promise<PaginatedResponse<Settlement>> {
  const { data } = await api.get<PaginatedResponse<Settlement>>(
    "/settlements",
    { params },
  );
  return data;
}

export async function getSettlementById(id: string): Promise<Settlement> {
  const { data } = await api.get<Settlement>(`/settlements/${id}`);
  return data;
}

/**
 * Initiate a cross-border settlement.
 * Returns an unsigned Solana transaction — user must sign with wallet.
 */
export async function initiateSettlement(
  payload: InitiateSettlementRequest,
): Promise<InitiateSettlementResponse> {
  const { data } = await api.post<InitiateSettlementResponse>(
    "/settlements/initiate",
    payload,
  );
  return data;
}

export async function confirmSettlement(id: string): Promise<Settlement> {
  const { data } = await api.post<Settlement>(`/settlements/${id}/confirm`);
  return data;
}

export async function cancelSettlement(id: string): Promise<Settlement> {
  const { data } = await api.post<Settlement>(`/settlements/${id}/cancel`);
  return data;
}

export async function getSettlementMetrics(): Promise<SettlementMetrics> {
  const { data } = await api.get<SettlementMetrics>("/settlements/metrics");
  return data;
}

export async function getTravelRulePayload(
  settlementId: string,
): Promise<
  TravelRulePayload & { settlementId: string; complianceHash: string }
> {
  const { data } = await api.get(`/settlements/travel-rule/${settlementId}`);
  return data;
}

export async function validateTravelRule(
  payload: TravelRulePayload,
): Promise<{ valid: boolean; errors: string[] }> {
  const { data } = await api.post("/settlements/travel-rule/validate", payload);
  return data;
}

// ---------------------------------------------------------------------------
// SSE Live Feed
// ---------------------------------------------------------------------------

/**
 * Connect to the settlement SSE feed.
 * Returns an EventSource — caller is responsible for closing it.
 *
 * Usage:
 *   const es = subscribeLiveSettlements((event) => { ... });
 *   // cleanup:  es.close();
 */
export function subscribeLiveSettlements(
  onEvent: (settlement: Settlement) => void,
  onError?: (err: Event) => void,
): EventSource {
  const token = typeof window !== "undefined" ? getAccessToken() : "";

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

  // JWT passed as query param — SSE doesn't support custom headers
  const es = new EventSource(`${baseUrl}/settlements/live?token=${token}`);

  es.addEventListener("settlement", (e: MessageEvent) => {
    try {
      const parsed = JSON.parse(e.data) as Settlement;
      onEvent(parsed);
    } catch {
      console.error("[SSE] Failed to parse settlement event", e.data);
    }
  });

  if (onError) {
    es.onerror = onError;
  }

  return es;
}
