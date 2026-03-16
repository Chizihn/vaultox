/**
 * services/vaults.ts
 * ───────────────────
 * Vault service — strategies, positions, deposit/withdraw, portfolio.
 */

import api from "./api";
import type { VaultStrategy, VaultPosition } from "@/types";

// ---------------------------------------------------------------------------
// Extended Types
// ---------------------------------------------------------------------------

export interface DepositRequest {
  strategyId: string;
  amount: string; // string to avoid IEEE 754 float precision issues
  currency: "USDC";
  slippageBps?: number;
}

export interface DepositResponse {
  depositId: string;
  unsignedTransaction: string; // base64 — user must sign with wallet
  estimatedYield: string;
  lockupDays: number;
  status: "pending_signature";
}

export interface WithdrawRequest {
  positionId: string;
  amount: string;
  currency: "USDC";
}

export interface WithdrawResponse {
  withdrawalId: string;
  unsignedTransaction: string;
  status: "pending_signature";
}

export interface PortfolioSummary {
  totalDeposited: number;
  totalCurrentValue: number;
  totalAccruedYield: number;
  totalPositions: number;
  weightedApy: number;
  unrealizedGainPct: number;
}

export interface PortfolioAllocation {
  strategyId: string;
  strategyName: string;
  currentValue: number;
  allocationPct: number;
  color: string;
}

export interface YieldHistoryPoint {
  date: string;
  strategyId: string;
  strategyName: string;
  apy: number;
  cumulativeYield: number;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function getStrategies(): Promise<VaultStrategy[]> {
  const { data } = await api.get<VaultStrategy[]>("/vaults/strategies");
  return data;
}

export async function getStrategyById(id: string): Promise<VaultStrategy> {
  const { data } = await api.get<VaultStrategy>(`/vaults/strategies/${id}`);
  return data;
}

export async function getMyPositions(): Promise<VaultPosition[]> {
  const { data } = await api.get<VaultPosition[]>("/vaults/positions");
  return data;
}

export async function getPositionById(id: string): Promise<VaultPosition> {
  const { data } = await api.get<VaultPosition>(`/vaults/positions/${id}`);
  return data;
}

/**
 * Build an unsigned deposit transaction.
 * The response includes a base64 Solana transaction that the user
 * must sign with their wallet, then submit back via a separate endpoint.
 */
export async function initiateDeposit(
  payload: DepositRequest,
): Promise<DepositResponse> {
  const { data } = await api.post<DepositResponse>("/vaults/deposit", payload);
  return data;
}

export async function initiateWithdrawal(
  payload: WithdrawRequest,
): Promise<WithdrawResponse> {
  const { data } = await api.post<WithdrawResponse>(
    "/vaults/withdraw",
    payload,
  );
  return data;
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const { data } = await api.get<PortfolioSummary>("/vaults/portfolio/summary");
  return data;
}

export async function getPortfolioAllocation(): Promise<PortfolioAllocation[]> {
  const { data } = await api.get<PortfolioAllocation[]>(
    "/vaults/portfolio/allocation",
  );
  return data;
}

export async function getYieldHistory(params?: {
  strategyId?: string;
  from?: string;
  to?: string;
}): Promise<YieldHistoryPoint[]> {
  const { data } = await api.get<YieldHistoryPoint[]>("/vaults/yield/history", {
    params,
  });
  return data;
}
