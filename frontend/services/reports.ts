/**
 * services/reports.ts
 * ────────────────────
 * Reports service — generate, list, download compliance/regulatory reports.
 */

import api, { PaginatedResponse } from "./api";
import type { ReportFramework } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportStatus = "queued" | "generating" | "ready" | "failed";
export type ReportFormat = "pdf" | "csv" | "json";

export interface Report {
  id: string;
  title: string;
  framework: ReportFramework;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
  completedAt?: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
  period: { from: string; to: string };
}

export interface GenerateReportRequest {
  framework: ReportFramework;
  format?: ReportFormat;
  period: { from: string; to: string };
  includeSettlements?: boolean;
  includePositions?: boolean;
  includeAuditLog?: boolean;
}

export interface ComplianceSummaryMetrics {
  activeCredentials: number;
  pendingCredentials: number;
  restrictedCredentials: number;
  amlScreeningsThisMonth: number;
  amlFlagsRaised: number;
  travelRuleCompliantTransactions: number;
  auditEventsThisMonth: number;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function getReports(params?: {
  page?: number;
  limit?: number;
  framework?: ReportFramework;
}): Promise<PaginatedResponse<Report>> {
  const { data } = await api.get<PaginatedResponse<Report>>("/reports", {
    params,
  });
  return data;
}

export async function generateReport(
  payload: GenerateReportRequest,
): Promise<Report> {
  const { data } = await api.post<Report>("/reports/generate", payload);
  return data;
}

export async function downloadReport(id: string): Promise<Blob> {
  const { data } = await api.get(`/reports/${id}/download`, {
    responseType: "blob",
  });
  return data;
}

export async function getComplianceSummary(): Promise<ComplianceSummaryMetrics> {
  const { data } = await api.get<ComplianceSummaryMetrics>(
    "/reports/compliance/summary",
  );
  return data;
}

export async function getAuditTrail(params?: {
  page?: number;
  limit?: number;
  event_type?: string;
  from?: string;
  to?: string;
}): Promise<
  PaginatedResponse<{
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    details: Record<string, unknown>;
    tx_hash?: string;
  }>
> {
  const { data } = await api.get("/reports/audit-trail", { params });
  return data;
}

export async function getRegulatoryReport(
  framework: ReportFramework,
): Promise<Blob> {
  const { data } = await api.get(`/reports/regulatory/${framework}`, {
    responseType: "blob",
  });
  return data;
}
