/**
 * services/compliance.ts
 * ───────────────────────
 * Compliance service — KYC credentials, AML screening, audit log.
 */

import api, { PaginatedResponse } from "./api";
import type { ComplianceCredential, AuditEvent } from "@/types";

// ---------------------------------------------------------------------------
/**
 * Admin: Resync DB from on-chain credentials for all wallets (after DB reset).
 */
export async function resyncKycDbFromChainAdmin(adminKey: string) {
  const { data } = await api.post(
    "/compliance/admin/resync-kyc-from-chain",
    {},
    { headers: { "x-admin-api-key": adminKey } },
  );
  return data;
}
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

export interface AdminKycRequestItem {
  id: string;
  walletAddress: string;
  institutionName: string;
  jurisdiction: string | null;
  role: string | null;
  email: string | null;
  tier: number;
  status: "pending" | "under_review" | "approved" | "rejected";
  reviewerNotes: string | null;
  amlRiskScore: number | null;
  amlStatus: "cleared" | "review" | "flagged" | "not_screened";
  amlScreenedAt: string | null;
  recommendedTier: 1 | 2 | 3;
  tierRecommendationReasons: string[];
  requiresManualReview: boolean;
  latestCredentialTxHash: string | null;
  latestCredentialTxAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminKycQueueResponse {
  total: number;
  limit: number;
  offset: number;
  items: AdminKycRequestItem[];
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

export async function getAdminKycQueue(params: {
  adminKey: string;
  status?: "pending" | "under_review" | "approved" | "rejected";
  limit?: number;
  offset?: number;
}): Promise<AdminKycQueueResponse> {
  const { data } = await api.get<AdminKycQueueResponse>(
    "/compliance/admin/kyc-requests",
    {
      params: {
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      },
      headers: {
        "x-admin-key": params.adminKey,
      },
    },
  );
  return data;
}

export async function approveKycRequestAdmin(payload: {
  adminKey: string;
  overrideApprovalKey?: string;
  walletAddress: string;
  tier: 1 | 2 | 3;
  kycLevel?: number;
  amlCoverage?: number;
  validityDays?: number;
  reviewerNotes?: string;
}): Promise<{
  success: boolean;
  message: string;
  requestId: string;
  txHash: string;
  credentialAddress: string;
}> {
  const { data } = await api.post(
    "/compliance/credential/approve",
    {
      walletAddress: payload.walletAddress,
      tier: payload.tier,
      kycLevel: payload.kycLevel,
      amlCoverage: payload.amlCoverage,
      validityDays: payload.validityDays,
      reviewerNotes: payload.reviewerNotes,
    },
    {
      headers: {
        "x-admin-key": payload.adminKey,
        ...(payload.overrideApprovalKey
          ? { "x-admin-override-key": payload.overrideApprovalKey }
          : {}),
      },
    },
  );
  return data;
}

export async function rejectKycRequestAdmin(payload: {
  adminKey: string;
  walletAddress: string;
  reviewerNotes?: string;
}): Promise<{
  success: boolean;
  requestId: string;
  status: "rejected";
}> {
  const { data } = await api.post(
    "/compliance/credential/reject",
    {
      walletAddress: payload.walletAddress,
      reviewerNotes: payload.reviewerNotes,
    },
    {
      headers: {
        "x-admin-key": payload.adminKey,
      },
    },
  );
  return data;
}

export async function resyncKycCredentialAdmin(payload: {
  adminKey: string;
  walletAddress: string;
  tier: 1 | 2 | 3;
  kycLevel?: number;
  amlCoverage?: number;
  validityDays?: number;
  reviewerNotes?: string;
}): Promise<{
  success: boolean;
  message: string;
  requestId: string;
  txHash: string;
  credentialAddress: string;
}> {
  const { data } = await api.post(
    "/compliance/credential/resync",
    {
      walletAddress: payload.walletAddress,
      tier: payload.tier,
      kycLevel: payload.kycLevel,
      amlCoverage: payload.amlCoverage,
      validityDays: payload.validityDays,
      reviewerNotes: payload.reviewerNotes,
    },
    {
      headers: {
        "x-admin-key": payload.adminKey,
      },
    },
  );
  return data;
}
