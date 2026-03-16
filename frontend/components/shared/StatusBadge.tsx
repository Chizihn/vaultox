"use client";

import { cn } from "@/lib/utils";
import type { SettlementStatus, AuditEventType } from "@/types";

/* ── Settlement status badges ─────────────────────────────────────────── */

const settlementStyles: Record<SettlementStatus, string> = {
  completed: "bg-ok/10 text-ok border border-ok/30",
  pending: "bg-[#C9A84C]/10 text-gold border border-gold/30",
  settling: "bg-teal/10 text-teal border border-teal/30",
  failed: "bg-warn/10 text-warn border border-warn/30",
};

const settlementDots: Record<SettlementStatus, string> = {
  completed: "bg-ok",
  pending: "bg-gold",
  settling: "bg-teal animate-pulse",
  failed: "bg-warn",
};

const settlementLabels: Record<SettlementStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  settling: "Settling",
  failed: "Failed",
};

interface SettlementBadgeProps {
  status: SettlementStatus;
  className?: string;
}

export function SettlementBadge({ status, className }: SettlementBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-body text-[11px] font-medium tracking-wide uppercase",
        settlementStyles[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", settlementDots[status])} />
      {settlementLabels[status]}
    </span>
  );
}

/* ── Audit event type badges ──────────────────────────────────────────── */

const auditStyles: Record<AuditEventType, string> = {
  deposit: "bg-ok/10 text-ok border border-ok/20",
  withdrawal: "bg-[#C9A84C]/10 text-gold border border-gold/20",
  settlement: "bg-teal/10 text-teal border border-teal/20",
  credential_update: "bg-[#8A8EA8]/10 text-[#8A8EA8] border border-[#3A3F5C]",
  report_generated: "bg-[#1A1F35] text-[#8A8EA8] border border-[#3A3F5C]",
};

const auditLabels: Record<AuditEventType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  settlement: "Settlement",
  credential_update: "Credential Update",
  report_generated: "Report",
};

interface AuditBadgeProps {
  type: AuditEventType;
  className?: string;
}

export function AuditBadge({ type, className }: AuditBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-wide",
        auditStyles[type],
        className,
      )}
    >
      {auditLabels[type]}
    </span>
  );
}

/* ── Generic status badge ─────────────────────────────────────────────── */

interface StatusBadgeProps {
  status: "success" | "failed" | "warning" | "info";
  label: string;
  className?: string;
}

const statusStyles = {
  success: "bg-ok/10 text-ok border border-ok/30",
  failed: "bg-warn/10 text-warn border border-warn/30",
  warning: "bg-gold/10 text-gold border border-gold/30",
  info: "bg-teal/10 text-teal border border-teal/30",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-body text-[11px] font-medium uppercase tracking-wide",
        statusStyles[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
