"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader, X, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { SettlementStep } from "@/types";
import { useReports } from "@/hooks/api/useReports";
import { getSolanaExplorerTxUrl } from "@/config/solana";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-handler";

interface SettlementProgressModalProps {
  isOpen: boolean;
  steps: SettlementStep[];
  isComplete: boolean;
  isRunning: boolean;
  totalTime: number;
  amountUsdc: number;
  fromCity: string;
  toCity: string;
  txHash?: string | null;
  onClose: () => void;
}

export function SettlementProgressModal({
  isOpen,
  steps,
  isComplete,
  isRunning,
  totalTime,
  amountUsdc,
  fromCity,
  toCity,
  txHash,
  onClose,
}: SettlementProgressModalProps) {
  const { generateReport, isGenerating } = useReports();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-vault-base/80 backdrop-blur-md"
            // onClick={isComplete ? onClose : undefined} // Removed to prevent accidental closure
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md rounded-sm border border-vault-border bg-vault-surface shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Settlement progress"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-vault-border px-6 py-5">
                <div>
                  <h2 className="font-heading text-base font-semibold text-text-primary">
                    {isComplete
                      ? "Settlement Complete"
                      : "Processing Settlement"}
                  </h2>
                  <p className="font-body text-xs text-muted-vault">
                    {formatCurrency(amountUsdc)} USDC · {fromCity} → {toCity}
                  </p>
                </div>
                {isComplete && (
                  <button
                    onClick={onClose}
                    className="flex size-8 items-center justify-center rounded-sm border border-vault-border hover:border-gold/30"
                    aria-label="Close"
                  >
                    <X className="size-4 text-muted-vault" />
                  </button>
                )}
              </div>

              {/* Steps */}
              <div className="px-6 py-5">
                <ol className="space-y-4">
                  {steps.map((step, i) => {
                    const isDone = step.status === "completed";
                    const isActive = step.status === "processing";
                    const isPending = step.status === "pending";

                    return (
                      <motion.li
                        key={step.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4"
                      >
                        {/* Step icon */}
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border transition-all",
                            isDone
                              ? "border-ok bg-ok/10"
                              : isActive
                                ? "border-gold bg-gold/10"
                                : "border-vault-border bg-vault-elevated",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle className="size-4 text-ok" />
                          ) : isActive ? (
                            <Loader className="size-4 animate-spin text-gold" />
                          ) : (
                            <span className="font-body text-xs text-muted-vault">
                              {i + 1}
                            </span>
                          )}
                        </div>

                        {/* Step label */}
                        <div className="flex-1">
                          <span
                            className={cn(
                              "font-heading text-sm font-medium transition-colors",
                              isDone
                                ? "text-ok"
                                : isActive
                                  ? "text-gold"
                                  : isPending
                                    ? "text-muted-vault"
                                    : "text-text-primary",
                            )}
                          >
                            {step.label}
                          </span>
                        </div>

                        {/* Checkmark */}
                        {isDone && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="font-body text-xs text-ok"
                          >
                            ✓
                          </motion.span>
                        )}
                      </motion.li>
                    );
                  })}
                </ol>

                {/* Completion state */}
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 rounded-sm border border-ok/20 bg-ok/5 p-4 text-center"
                  >
                    <p className="font-heading text-3xl text-ok">
                      {totalTime.toFixed(1)}s
                    </p>
                    <p className="font-body text-xs text-muted-vault">
                      Total settlement time
                    </p>

                    {/* Travel Rule Payload */}
                    <div className="mt-4 rounded-sm border border-vault-border bg-vault-elevated p-3 text-left">
                      <p className="mb-2 font-heading text-[10px] uppercase tracking-widest text-gold">
                        FATF Travel Rule Payload
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-body text-[11px]">
                        <span className="text-muted-vault">Originator</span>
                        <span className="text-text-primary truncate">{fromCity}</span>
                        <span className="text-muted-vault">Beneficiary</span>
                        <span className="text-text-primary truncate">{toCity}</span>
                        <span className="text-muted-vault">Amount</span>
                        <span className="text-text-primary">{formatCurrency(amountUsdc)} USDC</span>
                        <span className="text-muted-vault">Purpose Code</span>
                        <span className="text-text-primary">INTC (Intercompany)</span>
                        <span className="text-muted-vault">Status</span>
                        <span className="text-ok">✓ Validated &amp; On-Chain</span>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={onClose}
                        className="flex-1 rounded-sm border border-vault-border py-2 font-heading text-xs text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
                      >
                        Close
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const today = new Date().toISOString().split("T")[0];
                            const report = await generateReport({
                              framework: "FINMA",
                              startDate: "2026-01-01", // Or another valid period
                              endDate: today,
                            });
                            if (report?.downloadUrl) {
                              window.open(report.downloadUrl, "_blank");
                              toast.success("Compliance report generated.");
                            } else {
                              toast.error("Report generated without a download URL.");
                            }
                          } catch (err) {
                            console.error("Failed to generate report", err);
                            toast.error(
                              getErrorMessage(
                                err,
                                "Failed to generate report. Please try again.",
                              ),
                            );
                          }
                        }}
                        disabled={isGenerating}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-gold py-2 font-heading text-xs font-semibold text-vault-base transition-colors hover:bg-gold/90 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <Loader className="size-3 animate-spin" />
                        ) : (
                          <Download className="size-3" />
                        )}
                        {isGenerating ? "Generating..." : "Download Report"}
                      </button>
                    </div>
                    {txHash && (
                      <a
                        href={getSolanaExplorerTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-vault-border bg-vault-surface py-2 font-heading text-xs text-text-primary transition-colors hover:border-teal/30 hover:text-teal"
                      >
                        <ExternalLink className="size-3" />
                        View on Explorer
                      </a>
                    )}
                  </motion.div>
                )}

                {/* Running progress bar */}
                {isRunning && (
                  <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-vault-elevated">
                    <motion.div
                      className="h-full bg-gold"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
