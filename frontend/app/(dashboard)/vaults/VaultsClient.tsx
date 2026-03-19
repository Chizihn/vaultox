"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ChevronDown,
  ChevronUp,
  Shield,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/utils/format";
import type {
  RiskRating,
  VaultPosition,
  VaultStrategy,
  StrategyAllocation,
} from "@/types";
import { useAuthStore } from "@/store";
import { useVaults } from "@/hooks/api/useVaults";
import { YieldLadder } from "@/components/dashboard/YieldLadder";
import { DepositPanel } from "@/components/dashboard/DepositPanel";
import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { TierBadge } from "@/components/shared/TierBadge";
import { Tooltip } from "@/components/shared/Tooltip";
import api from "@/services/api";

const TABS = ["My Vaults", "Available Strategies", "RWA Vaults"] as const;
type Tab = (typeof TABS)[number];

const riskColors: Record<RiskRating, string> = {
  Low: "text-ok bg-ok/10 border-ok/30",
  Medium: "text-gold bg-gold/10 border-gold/30",
  High: "text-warn bg-warn/10 border-warn/30",
};
 
const getRiskDescription = (rating: RiskRating) => {
  switch (rating) {
    case "Low":
      return "Government-backed or high-grade corporate assets with minimal volatility.";
    case "Medium":
      return "Diversified private credit or collateralized debt with moderate yield.";
    case "High":
      return "Commodity-linked or aggressive yield strategies with higher market sensitivity.";
    default:
      return "";
  }
};

type MarketQuote = {
  symbol: string;
  price: number;
  change24hPct: number;
  asOf: string;
  source: string;
};

export function VaultsClient() {
  const searchParams = useSearchParams();
  const { tier } = useAuthStore();
  const {
    strategies,
    positions,
    isLoadingStrategies,
    isLoadingPositions,
    withdraw,
  } = useVaults();

  const [activeTab, setActiveTab] = useState<Tab>("Available Strategies");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [depositTarget, setDepositTarget] = useState<string | null>(null);
  const [commodityQuotes, setCommodityQuotes] = useState<
    Record<string, MarketQuote>
  >({});
  const [commodityProvider, setCommodityProvider] = useState("unavailable");

  const currentStrategy = searchParams.get("strategy");
  const [prevStrategy, setPrevStrategy] = useState<string | null>(
    currentStrategy,
  );

  useEffect(() => {
    let ignore = false;

    const loadCommodityQuotes = async () => {
      try {
        const response = await api.get("/market-data/quotes", {
          params: { symbols: "XAUUSD,XAGUSD" },
        });

        const quotes = (response.data?.quotes ?? []) as MarketQuote[];
        const nextQuotes = quotes.reduce<Record<string, MarketQuote>>(
          (acc, quote) => {
            acc[quote.symbol] = quote;
            return acc;
          },
          {},
        );

        if (!ignore) {
          setCommodityQuotes(nextQuotes);
          setCommodityProvider(response.data?.provider ?? "unavailable");
        }
      } catch (error) {
        console.error("Failed to load commodity quotes", error);
      }
    };

    void loadCommodityQuotes();
    const timer = window.setInterval(() => void loadCommodityQuotes(), 10_000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, []);

  if (currentStrategy !== prevStrategy) {
    setPrevStrategy(currentStrategy);
    if (currentStrategy) {
      setActiveTab("Available Strategies");
      setExpandedId(currentStrategy);
      setDepositTarget(currentStrategy);
    }
  }

  const userTier = tier ?? 3;

  const safeStrategies = (strategies || []) as VaultStrategy[];
  const safePositions = (positions || []) as VaultPosition[];
  const firstEligibleStrategy = safeStrategies.find(
    (strategy) => userTier <= strategy.minTier,
  );

  const executeWithdraw = async (positionId: string) => {
    const position = safePositions.find((entry) => entry.id === positionId);
    if (!position) return;
    try {
      await withdraw({ positionId, amount: position.depositedAmount });
    } catch (error) {
      console.error("Failed to initiate withdrawal", error);
    }
  };

  const visibleStrategies =
    activeTab === "My Vaults"
      ? safeStrategies.filter((s: VaultStrategy) =>
          safePositions.some((p: VaultPosition) => p.strategyId === s.id),
        )
      : activeTab === "RWA Vaults"
        ? safeStrategies.filter((s: VaultStrategy) => s.category !== "tbill")
        : safeStrategies;

  const depositStrategy =
    safeStrategies.find((s: VaultStrategy) => s.id === depositTarget) ?? null;

  const goldQuote = commodityQuotes["XAUUSD"];
  const silverQuote = commodityQuotes["XAGUSD"];
  const commoditySourceLabel = commodityProvider.toLowerCase().includes("six")
    ? "SIX Verified"
    : "Unavailable";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gold">Vault Management</h1>
          <p className="font-body text-xs text-muted-vault">
            Compliance-gated yield strategies for regulated institutions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {firstEligibleStrategy && (
            <button
              onClick={() => {
                setActiveTab("Available Strategies");
                setExpandedId(firstEligibleStrategy.id);
                setDepositTarget(firstEligibleStrategy.id);
              }}
              className="inline-flex items-center gap-1 rounded-sm bg-gold px-3 py-2 font-heading text-xs font-semibold text-vault-base transition-colors hover:bg-gold/90"
            >
              Quick Deposit
              <ArrowRight className="size-3" />
            </button>
          )}
          {tier && <TierBadge tier={tier} size="md" />}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex items-center gap-1 border-b border-vault-border"
        role="tablist"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "relative px-4 py-2.5 font-heading text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-gold"
                : "text-muted-vault hover:text-text-primary",
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="vault-tab-underline"
                className="absolute inset-x-0 bottom-0 h-px bg-gold"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Main grid: Strategies + Yield Ladder ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: Strategy cards ── */}
        <div className="space-y-3" role="tabpanel">
          <AnimatePresence mode="wait">
            {visibleStrategies.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-sm border border-vault-border bg-vault-surface py-16 text-center"
              >
                <TrendingUp className="size-10 text-muted-vault/40" />
                <p className="font-heading text-sm text-muted-vault">
                  {isLoadingStrategies || isLoadingPositions
                    ? "Loading strategies..."
                    : activeTab === "My Vaults"
                      ? "No active positions. Deposit to a strategy to get started."
                      : "No vaults available for this filter."}
                </p>
              </motion.div>
            ) : (
              <motion.div key="list" className="space-y-3">
                {visibleStrategies.map((strategy: VaultStrategy, i: number) => {
                  const position = safePositions.find(
                    (p: VaultPosition) => p.strategyId === strategy.id,
                  );
                  const locked = userTier > strategy.minTier;
                  const expanded = expandedId === strategy.id;

                  return (
                    <motion.article
                      key={strategy.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={cn(
                        "rounded-sm border bg-vault-surface transition-all duration-200",
                        locked
                          ? "border-vault-border opacity-60"
                          : expanded
                            ? "border-gold/30"
                            : "border-vault-border hover:border-vault-border/80",
                      )}
                    >
                      {/* Collapsed header */}
                      <button
                        onClick={() =>
                          setExpandedId(expanded ? null : strategy.id)
                        }
                        className="flex w-full items-center gap-4 px-5 py-4 text-left"
                        aria-expanded={expanded}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {locked && (
                            <Lock className="size-4 shrink-0 text-muted-vault" />
                          )}
                          <div className="min-w-0">
                            <p className="font-heading text-sm font-semibold text-text-primary truncate">
                              {strategy.name}
                            </p>
                            <p className="font-body text-[11px] text-muted-vault">
                              {strategy.maturity}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <Tooltip content={getRiskDescription(strategy.riskRating)}>
                            <span
                              className={cn(
                                "rounded-sm border px-1.5 py-0.5 font-body text-[11px] uppercase cursor-help",
                                riskColors[strategy.riskRating],
                              )}
                            >
                              {strategy.riskRating}
                            </span>
                          </Tooltip>
                          <Tooltip content="Estimated annual yield based on the current strategy performance and underlying asset returns.">
                            <span className="rounded-sm border border-gold/30 bg-gold/10 px-2 py-0.5 font-body text-xs text-gold cursor-help">
                              {formatPercentage(strategy.apy)} APY
                            </span>
                          </Tooltip>
                          {position && (
                            <span className="rounded-sm bg-teal/10 px-2 py-0.5 font-body text-xs text-teal">
                              Active
                            </span>
                          )}
                          {expanded ? (
                            <ChevronUp className="size-4 text-muted-vault" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-vault" />
                          )}
                        </div>
                      </button>

                      {/* Expanded content */}
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.25,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-vault-border/50 px-5 pb-5 pt-4">
                              <p className="mb-4 font-body text-xs text-muted-vault">
                                {strategy.description}
                              </p>

                              {strategy.category === "commodity" && (
                                <div className="mb-4 rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                      Spot Market
                                    </p>
                                    <span className="rounded-sm border border-gold/30 bg-gold/10 px-2 py-0.5 font-body text-[10px] text-gold">
                                      {commoditySourceLabel}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                        Gold (XAU/USD)
                                      </p>
                                      <p className="font-body text-sm text-text-primary">
                                        {goldQuote
                                          ? formatCurrency(goldQuote.price)
                                          : "N/A"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                        Silver (XAG/USD)
                                      </p>
                                      <p className="font-body text-sm text-text-primary">
                                        {silverQuote
                                          ? formatCurrency(silverQuote.price)
                                          : "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Stats row */}
                              <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                                {[
                                  {
                                    label: "TVL",
                                    value: formatCurrency(strategy.tvl, {
                                      compact: true,
                                    }),
                                    color: "text-text-primary",
                                    tooltip: "Total Value Locked in this strategy across all participating institutions.",
                                  },
                                  {
                                    label: "Min Tier",
                                    value: `Tier ${strategy.minTier}`,
                                    color: "text-text-primary",
                                    tooltip: "The minimum compliance credential level required to access this strategy.",
                                  },
                                  position && {
                                    label: "Your Position",
                                    value: formatCurrency(
                                      position.currentValue,
                                      { compact: true },
                                    ),
                                    color: "text-gold",
                                  },
                                  position && {
                                    label: "Accrued Yield",
                                    value: formatCurrency(
                                      position.accruedYield,
                                    ),
                                    color: "text-teal",
                                  },
                                ]
                                  .filter(Boolean)
                                  .map(
                                    (stat) =>
                                      stat && (
                                        <Tooltip key={stat.label} content={stat.tooltip} position="bottom">
                                          <div className="cursor-help">
                                            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                              {stat.label}
                                            </p>
                                            <p
                                              className={cn(
                                                "font-body text-sm",
                                                stat.color,
                                              )}
                                            >
                                              {stat.value}
                                            </p>
                                          </div>
                                        </Tooltip>
                                      ),
                                  )}
                              </div>

                              {/* Jurisdiction flags */}
                              <div className="mb-4 flex items-center gap-2">
                                <Shield className="size-3 text-muted-vault" />
                                <div className="flex gap-1.5">
                                  {strategy.jurisdictions.map(
                                    (flag: string, fi: number) => (
                                      <span key={fi} className="text-base">
                                        {flag}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>

                              {/* Allocation bar */}
                              {strategy.allocation && (
                                <div className="mb-4">
                                  <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                    Allocation Breakdown
                                  </p>
                                  <div className="flex h-2 overflow-hidden rounded-full">
                                    {strategy.allocation.map(
                                      (a: StrategyAllocation) => (
                                        <motion.div
                                          key={a.label}
                                          className="h-full"
                                          style={{
                                            backgroundColor: a.color,
                                            width: `${a.percentage}%`,
                                          }}
                                          initial={{ scaleX: 0 }}
                                          animate={{ scaleX: 1 }}
                                          transition={{
                                            duration: 0.6,
                                            delay: 0.1,
                                          }}
                                        />
                                      ),
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap gap-3">
                                    {strategy.allocation.map(
                                      (a: StrategyAllocation) => (
                                        <div
                                          key={a.label}
                                          className="flex items-center gap-1"
                                        >
                                          <span
                                            className="size-2 rounded-full"
                                            style={{ backgroundColor: a.color }}
                                          />
                                          <span className="font-body text-[11px] text-muted-vault">
                                            {a.label} {a.percentage}%
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Sparkline */}
                              <div className="mb-5">
                                <p className="mb-1 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                                  7-day APY trend
                                </p>
                                <SparklineChart
                                  data={strategy.sparklineData}
                                  color="#4FC3C3"
                                  height={48}
                                />
                              </div>

                              {/* Actions */}
                              {locked ? (
                                <div className="flex items-center gap-2 rounded-sm border border-gold/20 bg-gold/5 p-3">
                                  <Lock className="size-4 text-gold" />
                                  <p className="font-body text-xs text-muted-vault">
                                    Requires Tier {strategy.minTier} Compliance
                                    Credential. Upgrade your institution profile
                                    to unlock.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex gap-3">
                                  <button
                                    onClick={() =>
                                      setDepositTarget(strategy.id)
                                    }
                                    className="flex-1 rounded-sm bg-gold py-2.5 font-heading text-sm font-semibold text-vault-base transition-colors hover:bg-gold/90"
                                  >
                                    Deposit
                                  </button>
                                  {position && (
                                    <button
                                      onClick={() =>
                                        executeWithdraw(position.id)
                                      }
                                      className="flex-1 rounded-sm border border-gold/30 py-2.5 font-heading text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
                                    >
                                      Withdraw
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: Yield Ladder ── */}
        <aside>
          <div className="sticky top-24 rounded-sm border border-vault-border bg-vault-surface p-5">
            <YieldLadder userTier={userTier} />

            {/* Summary positions */}
            {safePositions.length > 0 && (
              <div className="mt-6 border-t border-vault-border pt-4">
                <p className="mb-3 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Active Positions
                </p>
                <ul className="space-y-2">
                  {safePositions.map((p: VaultPosition) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between"
                    >
                      <span className="font-body text-[11px] text-text-primary truncate max-w-35">
                        {p.strategyName}
                      </span>
                      <span className="font-heading text-[11px] text-gold">
                        {formatCurrency(p.currentValue, { compact: true })}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-vault-border pt-3">
                  <span className="font-body text-[11px] text-muted-vault">
                    Total
                  </span>
                  <span className="font-heading text-sm text-gold">
                    {formatCurrency(
                      safePositions.reduce(
                        (a: number, p: VaultPosition) => a + p.currentValue,
                        0,
                      ),
                      { compact: true },
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Deposit Panel ── */}
      <DepositPanel
        strategy={depositStrategy}
        userTier={userTier}
        isOpen={depositTarget !== null}
        onClose={() => setDepositTarget(null)}
      />
    </div>
  );
}
