"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CheckCircle,
  Download,
  ExternalLink,
  Shield,
  FileText,
} from "lucide-react";
import { formatDate, formatAddress } from "@/utils/format";
import type {
  AuditEventType,
  ComplianceScores,
  Permission,
  AuditEvent,
} from "@/types";
import { useAuthStore } from "@/store";
import { getSolanaExplorerAddressUrl } from "@/config/solana";
import { useCompliance } from "@/hooks/api/useCompliance";
import { ComplianceRadar } from "@/components/dashboard/ComplianceRadar";
import { TierBadge } from "@/components/shared/TierBadge";
import { AuditBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { ComplianceRing } from "@/components/dashboard/ComplianceRing";
import { Tooltip } from "@/components/shared/Tooltip";

export function ComplianceClient() {
  const { tier, credentialStatus } = useAuthStore();
  const { credential, auditEvents, isLoadingCredential, isLoadingAuditEvents } =
    useCompliance();
  const [eventFilter, setEventFilter] = useState<AuditEventType | "all">("all");

  const safeEvents = (auditEvents || []) as AuditEvent[];

  const filteredEvents =
    eventFilter === "all"
      ? safeEvents
      : safeEvents.filter((e: AuditEvent) => e.eventType === eventFilter);

  const complianceScores = credential?.complianceScores as
    | ComplianceScores
    | undefined;
  const overallScore = complianceScores
    ? Math.round(
        Object.values(complianceScores).reduce(
          (a: number, b: number) => a + b,
          0,
        ) / Object.values(complianceScores).length,
      )
    : 0;

  if (isLoadingCredential || isLoadingAuditEvents) {
    return (
      <div className="p-8 text-center text-muted-vault font-heading text-sm">
        Loading compliance passport...
      </div>
    );
  }

  if (!credential || credentialStatus !== "verified") {
    return (
      <div className="p-8 text-center text-muted-vault font-heading text-sm">
        Valid Compliance Passport not found on-chain. Please complete KYC.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-heading text-2xl text-gold">
            Compliance & Credential Center
          </h1>
          <p className="font-body text-xs text-muted-vault">
            On-chain Vault Passport · Audit trails · Regulatory reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/compliance/admin"
            className="rounded-sm border border-vault-border px-3 py-2 font-heading text-xs text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
          >
            Admin Queue
          </Link>
          {tier && <TierBadge tier={tier} size="md" />}
        </div>
      </motion.div>

      {/* ── Institution Credential card ── */}
      <section aria-label="Institution credential">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-sm border border-gold/20 bg-vault-surface p-6"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── Left: Status + Info ── */}
            <div className="flex flex-col gap-5">
              {/* VERIFIED badge */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex size-20 items-center justify-center rounded-full border-2 border-ok/30 bg-ok/10">
                    <CheckCircle className="size-10 text-ok" />
                  </div>
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 animate-ping rounded-full border border-ok/20" />
                </div>
                <div>
                  <p className="font-heading text-4xl leading-none tracking-tight text-ok">
                    VERIFIED
                  </p>
                  <p className="font-body text-xs text-muted-vault">
                    On-chain credential active
                  </p>
                </div>
              </div>

              {/* Institution details */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Institution",
                    value:
                      (credential as { institutionName?: string })
                        .institutionName ?? "Unknown Institution",
                  },
                  {
                    label: "Jurisdiction",
                    value: `${credential.jurisdiction} ${credential.jurisdictionFlag}`,
                  },
                  { label: "Issued", value: formatDate(credential.issuedAt) },
                  { label: "Expires", value: formatDate(credential.expiresAt) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                      {label}
                    </p>
                    <p className="font-body text-sm text-text-primary">
                      {value}
                    </p>
                  </div>
                ))}

                {/* Credential address */}
                <div className="col-span-2">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                    Credential Address
                  </p>
                  <div className="flex items-center gap-2">
                    <Tooltip content="Your unique Vault Passport ID on the Solana blockchain (Program Derived Address).">
                      <span className="font-code text-xs text-muted-vault cursor-help">
                        {formatAddress(credential.credentialAddress, 8)}
                      </span>
                    </Tooltip>
                    <a
                      href={getSolanaExplorerAddressUrl(
                        credential.credentialAddress,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal hover:underline"
                      aria-label="View on Solana Explorer"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Tier badge */}
              {tier && <TierBadge tier={tier} size="lg" />}
            </div>

            {/* ── Right: Radar chart ── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm font-semibold text-text-primary">
                  Compliance Dimensions
                </p>
                <Tooltip content="Weighted average of all compliance risk factors. 100 is the best possible score.">
                  <div className="cursor-help">
                    <ComplianceRing
                      score={overallScore}
                      size={52}
                      strokeWidth={4}
                    />
                  </div>
                </Tooltip>
              </div>
              <ComplianceRadar scores={credential.complianceScores} />

              {/* Score breakdown */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  Object.entries(credential.complianceScores) as [
                    string,
                    number,
                  ][]
                ).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-vault-elevated">
                      <motion.div
                        className="h-full rounded-full bg-teal"
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    <span className="font-body text-[11px] text-muted-vault w-6 shrink-0">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Permissions + KYC ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Encoded permissions */}
        <section aria-label="Encoded permissions">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="h-full rounded-sm border border-vault-border bg-vault-surface p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Shield className="size-4 text-gold" />
              <Tooltip content="Capabilities granted to your institution based on your verified compliance tier.">
                <h2 className="font-heading text-sm font-semibold text-text-primary cursor-help">
                  Encoded Permissions
                </h2>
              </Tooltip>
            </div>
            <ul className="space-y-3">
              {credential.permissions.map((p: Permission) => (
                <li key={p.label} className="flex items-center gap-3">
                  <CheckCircle className="size-4 shrink-0 text-ok" />
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <span className="font-body text-xs text-text-primary">
                      {p.label}
                    </span>
                    <span className="font-body text-xs text-muted-vault">
                      {p.value}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </section>

        {/* KYC Attestation */}
        <section aria-label="KYC attestation">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="h-full rounded-sm border border-vault-border bg-vault-surface p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <FileText className="size-4 text-gold" />
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                KYC Attestation
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Provider
                </p>
                <p className="font-body text-sm text-text-primary">
                  {credential.kycProvider}
                </p>
              </div>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Verified
                </p>
                <p className="font-body text-sm text-text-primary">
                  {formatDate(
                    credential.kycProviderVerifiedAt,
                    "MMM dd, yyyy HH:mm",
                  )}
                </p>
              </div>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Attestation Hash
                </p>
                <p className="font-code text-xs text-muted-vault break-all">
                  {credential.attestationHash}
                </p>
              </div>

              <button
                disabled
                className="mt-2 w-full cursor-not-allowed rounded-sm border border-vault-border py-2 font-heading text-xs text-muted-vault opacity-60"
              >
                Re-verify (endpoint pending)
              </button>
            </div>
          </motion.div>
        </section>
      </div>

      {/* ── Audit Trail ── */}
      <section aria-label="Audit trail">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-sm border border-vault-border bg-vault-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vault-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              Audit Trail
            </h2>

            <div className="flex items-center gap-2">
              <select
                value={eventFilter}
                onChange={(e) =>
                  setEventFilter(e.target.value as AuditEventType | "all")
                }
                className="rounded-sm border border-vault-border bg-vault-elevated px-2.5 py-1.5 font-body text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="settlement">Settlements</option>
                <option value="credential_update">Credential Updates</option>
                <option value="report_generated">Reports</option>
              </select>

              <button
                disabled
                className="flex cursor-not-allowed items-center gap-1.5 rounded-sm border border-vault-border px-2.5 py-1.5 font-body text-xs text-muted-vault opacity-60"
              >
                <Download className="size-3" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Compliance audit events">
              <thead>
                <tr className="border-b border-vault-border/50">
                  {[
                    "Timestamp",
                    "Event Type",
                    "Amount",
                    "TX Hash",
                    "Jurisdiction",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-5 py-3 text-left font-body text-[10px] uppercase tracking-widest text-muted-vault"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border/30">
                {filteredEvents.map((event: AuditEvent, i: number) => (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="group transition-colors hover:bg-vault-elevated/40"
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-body text-xs text-muted-vault">
                      {formatDate(event.timestamp, "MMM dd, HH:mm")}
                    </td>
                    <td className="px-5 py-3">
                      <AuditBadge type={event.eventType} />
                    </td>
                    <td className="px-5 py-3 font-body text-xs text-text-primary">
                      {event.amount
                        ? `$${(event.amount / 1000).toFixed(0)}K`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-code text-[11px] text-muted-vault">
                        {event.txHash !== "N/A"
                          ? `${event.txHash.slice(0, 8)}...`
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-body text-xs text-text-primary">
                      {event.jurisdiction}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        status={
                          event.status === "success" ? "success" : "failed"
                        }
                        label={
                          event.status === "success" ? "Success" : "Failed"
                        }
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
