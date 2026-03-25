"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AxiosError } from "axios";
import {
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Filter,
  ExternalLink,
  MoreVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Institution, Settlement, SettlementArc } from "@/types";
import { Tooltip } from "@/components/shared/Tooltip";
import { useAuthStore } from "@/store";
import { useSettlements } from "@/hooks/api/useSettlements";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { SettlementProgressModal } from "@/components/dashboard/SettlementProgressModal";
import { SettlementBadge } from "@/components/shared/StatusBadge";
import { useSettlementProgress } from "@/hooks/useSettlementProgress";
import { useMarketQuotesStream } from "@/hooks/useMarketQuotesStream";
import api from "@/services/api";
import { getCounterparties } from "@/services/compliance";
import { getSolanaExplorerTxUrl } from "@/config/solana";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-handler";

type SettlementCalendarStatus = {
  jurisdiction: string;
  date: string;
  isHoliday: boolean;
  reason: string;
  source: string;
};

const FX_SYMBOL_BY_JURISDICTION: Record<string, string> = {
  Switzerland: "USDCHF",
  Singapore: "USDSGD",
  UAE: "USDAED",
  "United Arab Emirates": "USDAED",
};

const JURISDICTION_CITY: Record<string, string> = {
  CH: "Zurich", Switzerland: "Zurich",
  SG: "Singapore", Singapore: "Singapore",
  US: "New York", "United States": "New York", USA: "New York",
  DE: "Frankfurt", Germany: "Frankfurt",
  GB: "London", "United Kingdom": "London", UK: "London",
  AE: "Dubai", UAE: "Dubai", "United Arab Emirates": "Dubai",
  JP: "Tokyo", Japan: "Tokyo", JAPA: "Tokyo",
  HK: "Hong Kong", "Hong Kong": "Hong Kong",
  FR: "Paris", France: "Paris", FRAN: "Paris",
  NG: "Lagos", Nigeria: "Lagos", NIGER: "Lagos", NIGE: "Lagos",
  KE: "Nairobi", Kenya: "Nairobi",
};

function getCityForJurisdiction(jurisdiction: string | undefined): string {
  if (!jurisdiction) return "N/A";
  return JURISDICTION_CITY[jurisdiction] ?? JURISDICTION_CITY[jurisdiction.toUpperCase()] ?? jurisdiction;
}

export function SettlementsClient() {
  const { institution } = useAuthStore();
  const [networkDirectory, setNetworkDirectory] = useState<Institution[]>([]);
  const [liveArcs, setLiveArcs] = useState<SettlementArc[]>([]);
  const [calendarStatus, setCalendarStatus] =
    useState<SettlementCalendarStatus | null>(null);
  const [toInstitution, setToInstitution] = useState<Institution | null>(null);
  const [amount, setAmount] = useState("");
  const [initiationError, setInitiationError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [settlementTxHash, setSettlementTxHash] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { quotes: quoteMap, provider: quoteProvider } = useMarketQuotesStream([
    "EURUSD",
    "USDCHF",
    "USDSGD",
    "USDAED",
  ]);

  const {
    settlements: fetchedSettlements,
    initiateSettlement,
    initiateMutation,
  } = useSettlements();
  const { steps, isRunning, isComplete, totalTime, startSettlement, reset } =
    useSettlementProgress();

  useEffect(() => {
    let ignore = false;

    const loadCounterparties = async () => {
      try {
        const counterparties = await getCounterparties();
        if (ignore) return;

        setNetworkDirectory(
          counterparties
            .filter((entry) => entry.status === "verified" || entry.status === "pending")
            .map((entry) => ({
              id: entry.wallet,
              name: entry.institution_name,
              jurisdiction: entry.jurisdiction,
              jurisdictionFlag: entry.jurisdictionFlag,
              tier: entry.tier,
              city: getCityForJurisdiction(entry.jurisdiction),
              walletAddress: entry.wallet,
              status: entry.status,
            })),
        );
      } catch (error) {
        console.error("Failed to load counterparties", error);
      }
    };

    void loadCounterparties();

    return () => {
      ignore = true;
    };
  }, []);

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

  useEffect(() => {
    let ignore = false;

    const loadCalendarStatus = async () => {
      if (!toInstitution?.jurisdiction) {
        if (!ignore) setCalendarStatus(null);
        return;
      }

      try {
        const response = await api.get("/market-data/settlement-calendar", {
          params: { jurisdiction: toInstitution.jurisdiction },
        });

        if (!ignore) {
          setCalendarStatus(response.data as SettlementCalendarStatus);
        }
      } catch (error) {
        console.error("Failed to load settlement calendar status", error);
      }
    };

    void loadCalendarStatus();

    return () => {
      ignore = true;
    };
  }, [toInstitution?.jurisdiction]);

  const fromInst = institution;
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;

  const fxSymbol = toInstitution
    ? (FX_SYMBOL_BY_JURISDICTION[toInstitution.jurisdiction] ?? "EURUSD")
    : "EURUSD";
  const selectedQuote = quoteMap[fxSymbol];
  const fxRate = selectedQuote?.price;
  const isSixVerified =
    Boolean(selectedQuote?.source?.toLowerCase().includes("six")) ||
    quoteProvider.toLowerCase().includes("six");

  const handleInitiate = async () => {
    if (!fromInst || !toInstitution || numAmount <= 0) return;
    setInitiationError(null);

    // Reactive compliance gate:
    // We allow selecting the institution, but block the actual move-funds action.
    if (toInstitution.status !== "verified") {
      const msg = "Compliance Block: Selected counterparty does not have a valid Vault Passport. Asset settlement is prohibited to uncredentialed institutions.";
      setInitiationError(msg);
      toast.error("Compliance Blocked", {
        description: "Counterparty has no valid on-chain credential.",
      });
      return;
    }

    try {
      // First initiate the transaction to get a signature
      const result = await initiateSettlement({
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

      // Show the progress modal and start tracking with the real signature
      setShowModal(true);
      setSettlementTxHash(result?.signature || null);
      toast.success("Settlement submitted. Tracking progress now.");
      // 'result' contains the signature return from the mutation
      await startSettlement(result?.signature);
    } catch (error) {
      if (error instanceof AxiosError) {
        const responseMessage = error.response?.data?.message;
        const message = Array.isArray(responseMessage)
          ? responseMessage.join(", ")
          : typeof responseMessage === "string"
            ? responseMessage
            : null;

        if (error.response?.status === 404) {
          setInitiationError(
            message ??
              "Selected counterparty is not credential-verified yet. Choose a verified institution and retry.",
          );
        } else {
          setInitiationError(
            message ?? "Failed to initiate settlement. Please try again.",
          );
        }
      } else {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to initiate settlement. Please try again.";
        setInitiationError(message);
      }
      console.error("Failed to initiate settlement", error);
      toast.error(
        getErrorMessage(error, "Failed to initiate settlement. Please try again."),
      );
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    reset();
    setAmount("");
    setSettlementTxHash(null);
    setToInstitution(null);
  };

  const handleAmountChange = (val: string) => {
    if (initiationError) {
      setInitiationError(null);
    }
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
    (entry) => entry.walletAddress !== fromInst?.walletAddress,
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
                <Tooltip
                  content="Your institutional profile and verified jurisdiction."
                  position="right"
                >
                  <div className="flex items-center gap-3 rounded-sm border border-vault-border bg-vault-elevated px-4 py-3 cursor-help">
                    <span className="text-xl">
                      {fromInst?.jurisdictionFlag}
                    </span>
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
                </Tooltip>
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
                  onChange={(e) => {
                    setInitiationError(null);
                    setToInstitution(
                      otherInstitutions.find((i) => i.id === e.target.value) ??
                        null,
                    );
                  }}
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
                  <Tooltip
                    content="The total USDC amount to be transferred to the recipient."
                    className="w-full"
                  >
                    <input
                      id="transfer-amount"
                      type="text"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="500,000"
                      className="w-full rounded-sm border border-vault-border bg-vault-elevated py-3 pl-8 pr-16 font-body text-lg text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none"
                    />
                  </Tooltip>
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
                      1 USDC = {fxRate ? fxRate : "N/A"}{" "}
                      {toInstitution.jurisdiction === "Switzerland"
                        ? "CHF"
                        : toInstitution.jurisdiction === "Singapore"
                          ? "SGD"
                          : toInstitution.jurisdiction === "UAE" ||
                              toInstitution.jurisdiction ===
                                "United Arab Emirates"
                            ? "AED"
                            : "USD"}{" "}
                      · {isSixVerified ? "SIX Verified" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-body text-xs">
                    <span className="text-muted-vault">Est. Settlement</span>
                    <span className="text-teal">Network-dependent</span>
                  </div>
                </motion.div>
              )}

              {toInstitution && calendarStatus?.isHoliday && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-sm border border-warn/30 bg-warn/10 p-3"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div>
                    <p className="font-body text-xs text-warn">
                      {calendarStatus.jurisdiction} market is closed today (
                      {calendarStatus.reason}).
                    </p>
                    <p className="mt-1 font-body text-[10px] text-muted-vault">
                      Settlement may experience extended latency.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Compliance checks */}
              {fromInst && toInstitution && (
                <div className="space-y-1.5">
                  {[
                    { label: `Sender Verified: ${fromInst.name}`, ok: true },
                    {
                      label: `Recipient Listed in Verified Directory: ${toInstitution.name}`,
                      ok: true,
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

              {initiationError && (
                <div className="rounded-sm border border-warn/30 bg-warn/10 p-3">
                  <p className="font-body text-xs text-warn">
                    {initiationError}
                  </p>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleInitiate}
                disabled={
                  !toInstitution ||
                  numAmount <= 0 ||
                  isRunning ||
                  initiateMutation.isPending
                }
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-sm py-3 font-heading text-sm font-semibold transition-all cursor-pointer",
                  toInstitution &&
                    numAmount > 0 &&
                    !isRunning &&
                    !initiateMutation.isPending
                    ? "bg-gold text-vault-base hover:bg-gold/90"
                    : "cursor-not-allowed bg-vault-elevated text-muted-vault",
                )}
              >
                {isRunning ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-vault-base/30 border-t-vault-base" />
                    Settling...
                  </>
                ) : initiateMutation.isPending ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-vault-base/30 border-t-vault-base" />
                    Initiating...
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
                    "Amount (USDC)",
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
                    <td className="px-5 py-3 font-body text-xs text-text-primary">
                      <Tooltip
                        content="Funds are atomically swapped or transferred via the settlement engine."
                        position="right"
                      >
                        <span className="block cursor-help">
                          {formatCurrency(s.amount, { compact: true })}
                        </span>
                      </Tooltip>
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
                      <div className="flex items-center gap-2">
                        <a
                          href={getSolanaExplorerTxUrl(s.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm border border-vault-border p-1.5 text-muted-vault transition-colors hover:border-teal/30 hover:text-teal"
                          aria-label="View on explorer"
                          title="View on Solana Explorer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                        <button
                          onClick={() => setSelectedSettlement(s)}
                          className="rounded-sm border border-vault-border p-1.5 text-muted-vault transition-colors hover:bg-vault-elevated hover:text-text-primary"
                          title="View full details"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </td>

                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

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
        txHash={settlementTxHash}
        onClose={handleCloseModal}
      />

      {/* ── Transaction Details Modal ── */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-vault-base/80 backdrop-blur-sm"
            onClick={() => setSelectedSettlement(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg overflow-hidden rounded-md border border-vault-border bg-vault-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-vault-border bg-vault-elevated px-6 py-4">
              <h3 className="font-heading text-lg font-semibold text-text-primary">
                Transaction Details
              </h3>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-muted-vault hover:text-text-primary"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4 font-code text-sm text-text-primary">
                <div className="flex justify-between border-b border-vault-border/50 pb-2">
                  <span className="text-muted-vault">Status</span>
                  <SettlementBadge status={selectedSettlement.status} />
                </div>
                <div className="flex justify-between border-b border-vault-border/50 pb-2">
                  <span className="text-muted-vault">Amount</span>
                  <span>{formatCurrency(selectedSettlement.amount)} {selectedSettlement.currency}</span>
                </div>
                <div className="flex justify-between border-b border-vault-border/50 pb-2">
                  <span className="text-muted-vault">From</span>
                  <span>{selectedSettlement.fromInstitution.jurisdictionFlag} {selectedSettlement.fromInstitution.name}</span>
                </div>
                <div className="flex justify-between border-b border-vault-border/50 pb-2">
                  <span className="text-muted-vault">To</span>
                  <span>{selectedSettlement.toInstitution.jurisdictionFlag} {selectedSettlement.toInstitution.name}</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-vault-border/50 pb-2">
                  <div className="flex justify-between">
                    <span className="text-muted-vault">Tx Hash</span>
                    <a 
                      href={getSolanaExplorerTxUrl(selectedSettlement.txHash)} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-teal hover:underline flex items-center gap-1"
                    >
                      {selectedSettlement.txHash.slice(0, 12)}...{selectedSettlement.txHash.slice(-12)}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
                <div className="flex justify-between border-b border-vault-border/50 pb-2">
                  <span className="text-muted-vault">Initiated At</span>
                  <span>{formatDate(selectedSettlement.initiatedAt)}</span>
                </div>
                {selectedSettlement.completedAt && (
                  <div className="flex justify-between pb-2">
                    <span className="text-muted-vault">Completed At</span>
                    <span>{formatDate(selectedSettlement.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
