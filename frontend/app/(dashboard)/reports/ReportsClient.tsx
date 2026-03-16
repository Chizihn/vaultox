"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/format";
import { REPORT_FRAMEWORKS } from "@/utils/constants";
import type { ReportFramework, Report } from "@/types";
import { useAuthStore } from "@/store";
import { useReports } from "@/hooks/api/useReports";
import { getErrorMessage } from "@/utils/error-handler";

const frameworkColors: Record<ReportFramework, string> = {
  FINMA: "text-teal border-teal/30 bg-teal/10",
  MiCA: "text-gold border-gold/30 bg-gold/10",
  MAS: "text-ok border-ok/30 bg-ok/10",
  Custom: "text-muted-vault border-vault-border bg-vault-elevated",
};

const previewLines: Record<ReportFramework, string[]> = {
  FINMA: [
    "§ 1 — Institution Identification",
    "§ 2 — VASP Registration Status",
    "§ 3 — Travel Rule Compliance",
    "§ 4 — SAR/STR Summary",
    "§ 5 — Asset Breakdown & Custody",
    "§ 6 — Counterparty Screening Results",
    "§ 7 — On-Chain Transaction Monitoring",
  ],
  MiCA: [
    "Art. 16 — Crypto-Asset Issuer Declaration",
    "Art. 45 — Asset-Referenced Token Reserves",
    "Art. 67 — Settlement Finality Evidence",
    "Art. 68 — Segregated Custody Attestation",
    "Art. 70 — Liquidity Management Summary",
    "Art. 93 — Incident Report Log",
  ],
  MAS: [
    "Section 4 — DPT Service Provider Details",
    "Section 8 — CDD / EDD Procedures",
    "Section 12 — Travel Rule (FATF) Evidence",
    "Section 15 — Cross-Border Transaction Log",
    "Section 19 — Risk Appetite Statement",
  ],
  Custom: [
    "Custom Template Section 1",
    "Custom Template Section 2",
    "Custom Template Section 3",
    "Custom Template Section 4",
  ],
};

export function ReportsClient() {
  const { reports, isGenerating, generateReport, isLoading } = useReports();
  const safeReports = reports || [];

  const [framework, setFramework] = useState<ReportFramework>("FINMA");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-31");

  const handleGenerate = async () => {
    try {
      await generateReport({ framework, startDate, endDate });
    } catch (error: unknown) {
      console.error("Failed to generate report", getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-2xl text-gold">Regulatory Reports</h1>
        <p className="font-body text-xs text-muted-vault">
          Generate & export compliance reports for FINMA · MiCA · MAS · Custom
          frameworks
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ── Left: Report Builder ── */}
        <section aria-label="Report builder">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-sm border border-vault-border bg-vault-surface p-5"
          >
            <div className="mb-5 flex items-center gap-2">
              <FileText className="size-4 text-gold" />
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Build Report
              </h2>
            </div>

            {/* Framework selector */}
            <fieldset className="mb-5">
              <legend className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                Regulatory Framework
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.value}
                    onClick={() => setFramework(fw.value as ReportFramework)}
                    className={cn(
                      "flex items-center gap-2 rounded-sm border px-3 py-2.5 text-left transition-all",
                      framework === fw.value
                        ? frameworkColors[fw.value as ReportFramework]
                        : "border-vault-border bg-vault-elevated text-muted-vault hover:border-gold/20 hover:text-text-primary",
                    )}
                  >
                    <span className="text-base">{fw.flag}</span>
                    <span className="font-heading text-xs font-medium">
                      {fw.value}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Date range */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  <Calendar className="mr-1 inline size-3" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary focus:border-gold/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  <Calendar className="mr-1 inline size-3" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary focus:border-gold/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Report preview */}
            <div className="mb-5 rounded-sm border border-vault-border bg-vault-base p-4">
              <p className="mb-3 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                Report Outline · {framework}
              </p>
              <ul className="space-y-1.5">
                {previewLines[framework].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-0.5 block size-1.5 shrink-0 rounded-full bg-muted-vault" />
                    <span className="font-code text-[11px] text-muted-vault">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              disabled={isGenerating}
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-gold py-2.5 font-heading text-sm font-semibold text-vault-base transition-opacity disabled:opacity-60 hover:opacity-90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  Generate &amp; Download PDF
                </>
              )}
            </button>
          </motion.div>
        </section>

        {/* ── Right: Report History ── */}
        <section aria-label="Report history">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-sm border border-vault-border bg-vault-surface p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Report History
              </h2>
              <span className="font-body text-xs text-muted-vault">
                {safeReports.length} reports
              </span>
            </div>

            <ul className="space-y-3">
              <div className="space-y-3">
                {!safeReports || safeReports.length === 0 ? (
                  <li className="py-8 text-center">
                    <FileText className="mx-auto size-6 text-muted-vault/40" />
                    <p className="mt-2 font-body text-xs text-muted-vault">
                      {isLoading
                        ? "Loading reports..."
                        : "No reports generated yet."}
                    </p>
                  </li>
                ) : (
                  safeReports.map((report: Report, i: number) => (
                    <motion.li
                      key={report.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 rounded-sm border border-vault-border bg-vault-elevated p-3"
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {report.status === "ready" && (
                          <CheckCircle className="size-5 text-ok" />
                        )}
                        {report.status === "generating" && (
                          <Loader2 className="size-5 animate-spin text-teal" />
                        )}
                        {report.status === "failed" && (
                          <AlertCircle className="size-5 text-warn" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-sm border px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wider",
                              frameworkColors[
                                report.framework as ReportFramework
                              ],
                            )}
                          >
                            {report.framework}
                          </span>
                          <span className="font-body text-xs text-muted-vault">
                            {formatDate(report.dateRange.start)} –{" "}
                            {formatDate(report.dateRange.end)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-code text-[11px] text-muted-vault">
                          {report.fileName}
                        </p>
                      </div>

                      {/* Download */}
                      {report.status === "ready" && report.downloadUrl && (
                        <a
                          href={report.downloadUrl}
                          download={report.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-sm border border-vault-border p-1.5 text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
                          aria-label={`Download ${report.fileName}`}
                        >
                          <Download className="size-3.5" />
                        </a>
                      )}
                    </motion.li>
                  ))
                )}
              </div>
            </ul>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
