/**
 * services/compliance.ts
 * ───────────────────────
 * Compliance service — KYC credentials, AML screening, audit log.
 */

import api, { PaginatedResponse } from "./api";
import type { ComplianceCredential, AuditEvent } from "@/types";

// ---------------------------------------------------------------------------
// Extended Types (API-specific, not in shared types)
// ---------------------------------------------------------------------------

export interface AmlScreeningResult {
  wallet: string;
  screened_at: string;
  risk_score: number; // 0–100 (lower = safer)
  flags: AmlFlag[];
  status: "cleared" | "flagged" | "review";
  provider: string;
}

export interface AmlFlag {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  flagged_at: string;
}

export interface CounterpartyRecord {
  wallet: string;
  institution_name: string;
  jurisdiction: string;
  jurisdictionFlag: string;
  tier: 1 | 2 | 3;
  kyc_level: number;
  last_verified: string;
  status: "verified" | "pending" | "revoked";
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Fetch the caller's on-chain ComplianceCredential.
 */
export async function getMyCredential(): Promise<ComplianceCredential> {
  const { data } = await api.get<ComplianceCredential>(
    "/compliance/credential",
  );
  return data;
}

/**
 * Fetch a specific institution's credential (admin only).
 */
export async function getCredentialByWallet(
  wallet: string,
): Promise<ComplianceCredential> {
  const { data } = await api.get<ComplianceCredential>(
    `/compliance/credential/${wallet}`,
  );
  return data;
}

/**
 * Submit an institution's KYC onboarding request.
 */
export async function requestCredential(payload: {
  institution_name: string;
  jurisdiction: string;
  tier: 1 | 2 | 3;
  kyc_documents_hash: string; // SHA-256 of document bundle
}): Promise<{ request_id: string; status: "pending" }> {
  const { data } = await api.post("/compliance/credential/request", payload);
  return data;
}

/**
 * Fetch the latest AML screening result for the caller's wallet.
 */
export async function getAmlScreening(): Promise<AmlScreeningResult> {
  const { data } = await api.get<AmlScreeningResult>(
    "/compliance/aml/screening",
  );
  return data;
}

/**
 * Trigger a fresh AML screening (may take a few seconds to complete).
 */
export async function triggerAmlScreening(): Promise<AmlScreeningResult> {
  const { data } = await api.post<AmlScreeningResult>(
    "/compliance/aml/screening",
  );
  return data;
}

/**
 * Fetch compliance audit log with optional filters.
 */
export async function getAuditLog(params?: {
  page?: number;
  limit?: number;
  event_type?: string;
  from?: string;
  to?: string;
}): Promise<PaginatedResponse<AuditEvent>> {
  const { data } = await api.get<PaginatedResponse<AuditEvent>>(
    "/compliance/audit-log",
    { params },
  );
  return data;
}

/**
 * Fetch the list of verified counterparties for this institution.
 */
export async function getCounterparties(): Promise<CounterpartyRecord[]> {
  const { data } = await api.get<CounterpartyRecord[]>(
    "/compliance/counterparties",
  );
  return data;
}
