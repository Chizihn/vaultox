"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  Filter,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Institution, Settlement, SettlementArc } from "@/types";
import { useAuthStore } from "@/store";
import { useSettlements } from "@/hooks/api/useSettlements";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { SettlementProgressModal } from "@/components/dashboard/SettlementProgressModal";
import { SettlementBadge } from "@/components/shared/StatusBadge";
import { useSettlementProgress } from "@/hooks/useSettlementProgress";
import api from "@/services/api";

const FX_RATES: Record<string, number> = {
  "CH → SG": 0.9201,
  "CH → AE": 0.9548,
  "US → CH": 1.0,
  "SG → JP": 0.0067,
  "DE → CH": 1.0812,
  default: 1.0,
};

export function SettlementsClient() {
  const { institution } = useAuthStore();
  const [liveArcs, setLiveArcs] = useState<SettlementArc[]>([]);

  // Network Directory Fallback
  const networkDirectory: Institution[] = [
    {
      id: "inst-002",
      name: "DBS Institutional",
      jurisdiction: "Singapore",
      jurisdictionFlag: "🇸🇬",
      tier: 1,
      city: "Singapore",
      walletAddress: "7Kx2nPz8Wp5RuXmL9tSg3McEiO7hBd4kNr",
    },
    {
      id: "inst-003",
      name: "Deutsche Digital Assets",
      jurisdiction: "Germany",
      jurisdictionFlag: "🇩🇪",
      tier: 2,
      city: "Frankfurt",
      walletAddress: "4Jw9mNy6Tp3QsVkH8rUf5LbDgA2iCe7jXp",
    },
    {
      id: "inst-004",
      name: "Emirates NBD Digital",
      jurisdiction: "UAE",
      jurisdictionFlag: "🇦🇪",
      tier: 2,
      city: "Dubai",
      walletAddress: "9Fx5lKw3Sn8PtYhG7qRe4MaDfC1jBg6iWo",
    },
    {
      id: "inst-005",
      name: "JPM Onyx Settlement",
      jurisdiction: "United States",
      jurisdictionFlag: "🇺🇸",
      tier: 1,
      city: "New York",
      walletAddress: "2Hw6oLx4Um9QvZiJ8sTg5NbEhD3kCf7lYq",
    },
  ];
  const {
    settlements: fetchedSettlements,
    initiateSettlement,
  } = useSettlements();
  const { steps, isRunning, isComplete, totalTime, startSettlement, reset } =
    useSettlementProgress();

  useEffect(() => {
    let ignore = false;
    const loadArcs = async () => {
      try {
        const response = await api.get("/settlements/live-arcs");
        if (!ignore) setLiveArcs(response.data.arcs ?? []);
      } catch (error) {
        console.error("Failed to load settlement arcs", error);
      }
    };

    void loadArcs();
    const timer = window.setInterval(() => void loadArcs(), 5000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, []);

  const [toInstitution, setToInstitution] = useState<Institution | null>(null);
  const [amount, setAmount] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fromInst = institution ?? networkDirectory[0];
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;

  const fxRate =
    fromInst && toInstitution
      ? (FX_RATES[`${fromInst.city.slice(0, 2)}`] ?? FX_RATES["default"])
      : 1;

  const handleInitiate = async () => {
    if (!fromInst || !toInstitution || numAmount <= 0) return;
    setShowModal(true);
    await startSettlement();

    try {
      await initiateSettlement({
        receiver: {
          walletAddress: toInstitution.walletAddress,
          institutionName: toInstitution.name,
          jurisdiction: toInstitution.jurisdiction,
        },
        amount: String(numAmount),
        currency: "USDC",
        travelRule: {
          originatorName: fromInst.name,
          originatorAddress: `${fromInst.city}, ${fromInst.jurisdiction}`,
          originatorAccountId: fromInst.walletAddress,
          beneficiaryName: toInstitution.name,
          beneficiaryAddress: `${toInstitution.city}, ${toInstitution.jurisdiction}`,
          beneficiaryAccountId: toInstitution.walletAddress,
          purposeCode: "INTC",
        },
      });
    } catch (e) {
      console.error("Failed to initiate settlement", e);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    reset();
    setAmount("");
    setToInstitution(null);
  };

  const handleAmountChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    if (!clean) {
      setAmount("");
      return;
    }
    setAmount(parseInt(clean).toLocaleString());
  };

  const safeSettlements = (fetchedSettlements?.settlements ||
    []) as Settlement[];

  const filteredSettlements = safeSettlements
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .sort((a, b) =>
      sortDir === "desc"
        ? new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()
        : new Date(a.initiatedAt).getTime() - new Date(b.initiatedAt).getTime(),
    );

  const otherInstitutions = networkDirectory.filter(
    (i) => i.id !== fromInst?.id,
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-2xl text-gold">
          Cross-Border Settlement Rail
        </h1>
        <p className="font-body text-xs text-muted-vault">
          Atomic USDC transfers with real-time compliance verification
        </p>
      </motion.div>

      {/* ── World Map ── */}
      <section aria-label="Global settlement network">
        <div className="overflow-hidden rounded-sm border border-vault-border">
          <div className="flex items-center justify-between border-b border-vault-border px-4 py-3">
            <span className="font-heading text-sm font-semibold text-text-primary">
              Global Settlement Network
            </span>
            <div className="flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-teal" />
              <span className="font-body text-[11px] text-muted-vault">
                Live
              </span>
            </div>
          </div>
          <WorldMap arcs={liveArcs} className="aspect-3/1 w-full min-h-55" />
        </div>
      </section>

      {/* ── Initiate + History ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {/* ── Initiate Transfer form ── */}
        <section aria-label="Initiate transfer">
          <div className="rounded-sm border border-vault-border bg-vault-surface">
            <div className="border-b border-vault-border px-5 py-4">
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Initiate Transfer
              </h2>
            </div>

            <div className="space-y-4 p-5">
              {/* From */}
              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  From Institution
                </label>
                <div className="flex items-center gap-3 rounded-sm border border-vault-border bg-vault-elevated px-4 py-3">
                  <span className="text-xl">{fromInst?.jurisdictionFlag}</span>
                  <div>
                    <p className="font-heading text-sm text-text-primary">
                      {fromInst?.name}
                    </p>
                    <p className="font-body text-[11px] text-muted-vault">
                      {fromInst?.city}
                    </p>
                  </div>
                  <CheckCircle className="ml-auto size-4 text-ok" />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-vault/40">
                  <div className="h-px w-12 bg-vault-border" />
                  <ArrowRight className="size-4" />
                  <div className="h-px w-12 bg-vault-border" />
                </div>
              </div>

              {/* To */}
              <div>
                <label
                  htmlFor="to-institution"
                  className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault"
                >
                  To Institution
                </label>
                <select
                  id="to-institution"
                  value={toInstitution?.id ?? ""}
                  onChange={(e) =>
                    setToInstitution(
                      otherInstitutions.find((i) => i.id === e.target.value) ??
                        null,
                    )
                  }
                  className="w-full rounded-sm border border-vault-border bg-vault-elevated px-4 py-3 font-body text-sm text-text-primary focus:border-gold/40 focus:outline-none"
                >
                  <option value="">Select institution...</option>
                  {otherInstitutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.jurisdictionFlag} {inst.name} — {inst.city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="transfer-amount"
                  className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault"
                >
                  Amount USDC
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-vault">
                    $
                  </span>
                  <input
                    id="transfer-amount"
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="500,000"
                    className="w-full rounded-sm border border-vault-border bg-vault-elevated py-3 pl-8 pr-16 font-body text-lg text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs text-muted-vault">
                    USDC
                  </span>
                </div>
              </div>

              {/* FX + estimate */}
              {toInstitution && numAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 rounded-sm border border-vault-border bg-vault-elevated p-3"
                >
                  <div className="flex items-center justify-between font-body text-xs">
                    <span className="text-muted-vault">FX Rate</span>
                    <span className="text-text-primary">
                      1 USDC = {fxRate}{" "}
                      {toInstitution.jurisdiction === "Switzerland"
                        ? "CHF"
                        : "USD"}{" "}
                      · Live
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-body text-xs">
                    <span className="text-muted-vault">Est. Settlement</span>
                    <span className="text-teal">~1.8 seconds</span>
                  </div>
                </motion.div>
              )}

              {/* Compliance checks */}
              {fromInst && toInstitution && (
                <div className="space-y-1.5">
                  {[
                    { label: `Sender Verified: ${fromInst.name}`, ok: true },
                    {
                      label: `Recipient Verified: ${toInstitution.name}`,
                      ok: toInstitution.tier <= 2,
                    },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2">
                      <CheckCircle
                        className={cn(
                          "size-4 shrink-0",
                          ok ? "text-ok" : "text-warn",
                        )}
                      />
                      <span className="font-body text-xs text-muted-vault">
                        {label}
                      </span>
                      {ok && (
                        <span className="font-body text-xs text-ok ml-auto">
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleInitiate}
                disabled={!toInstitution || numAmount <= 0 || isRunning}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-sm py-3 font-heading text-sm font-semibold transition-all",
                  toInstitution && numAmount > 0 && !isRunning
                    ? "bg-gold text-vault-base hover:bg-gold/90"
                    : "cursor-not-allowed bg-vault-elevated text-muted-vault",
                )}
              >
                {isRunning ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-vault-base/30 border-t-vault-base" />
                    Settling...
                  </>
                ) : (
                  <>
                    Initiate Settlement
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ── Settlement History ── */}
        <section
          aria-label="Settlement history"
          className="overflow-hidden rounded-sm border border-vault-border bg-vault-surface"
        >
          {/* Table header */}
          <div className="flex items-center justify-between gap-4 border-b border-vault-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              Settlement History
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-sm border border-vault-border bg-vault-elevated px-2.5 py-1.5 font-body text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="settling">Settling</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={() =>
                  setSortDir((d) => (d === "desc" ? "asc" : "desc"))
                }
                className="flex items-center gap-1.5 rounded-sm border border-vault-border px-2.5 py-1.5 font-body text-xs text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
              >
                <Filter className="size-3" />
                {sortDir === "desc" ? "Newest" : "Oldest"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Settlement transactions">
              <thead>
                <tr className="border-b border-vault-border/50">
                  {[
                    "Date / Time",
                    "Route",
                    "Amount",
                    "Status",
                    "TX Hash",
                    "Actions",
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
                {filteredSettlements.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group transition-colors hover:bg-vault-elevated/40"
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-body text-xs text-muted-vault">
                      {formatDate(s.initiatedAt, "MMM dd, HH:mm")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 font-body text-xs">
                        <span>{s.fromInstitution.jurisdictionFlag}</span>
                        <ArrowRight className="size-3 text-muted-vault/50" />
                        <span>{s.toInstitution.jurisdictionFlag}</span>
                        <span className="ml-1 text-muted-vault">
                          {s.corridor}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-heading text-xs text-text-primary">
                      {formatCurrency(s.amount, { compact: true })} {s.currency}
                    </td>
                    <td className="px-5 py-3">
                      <SettlementBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-code text-[11px] text-muted-vault">
                        {s.txHash.length > 16
                          ? `${s.txHash.slice(0, 8)}...${s.txHash.slice(-4)}`
                          : s.txHash}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="rounded-sm border border-vault-border p-1.5 text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
                          aria-label="Download report"
                          title="Download FINMA report"
                          onClick={() => alert("Report download simulated")}
                        >
                          <Download className="size-3" />
                        </button>
                        <a
                          href={`https://explorer.solana.com/tx/${s.txHash}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm border border-vault-border p-1.5 text-muted-vault transition-colors hover:border-teal/30 hover:text-teal"
                          aria-label="View on explorer"
                          title="View on Solana Explorer"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Settlement Progress Modal ── */}
      <SettlementProgressModal
        isOpen={showModal}
        steps={steps}
        isComplete={isComplete}
        isRunning={isRunning}
        totalTime={totalTime}
        amountUsdc={numAmount}
        fromCity={fromInst?.city ?? "Origin"}
        toCity={toInstitution?.city ?? "Destination"}
        onClose={handleCloseModal}
      />
    </div>
  );
}
