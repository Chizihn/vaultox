"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Users,
  BarChart3,
  Activity,
  Server,
  AlertTriangle,
  Plus,
  X,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminKycClient } from "../compliance/admin/AdminKycClient";
import { useVaults } from "@/hooks/api/useVaults";
import { useCompliance } from "@/hooks/api/useCompliance";
import { useSettlements } from "@/hooks/api/useSettlements";
import api from "@/services/api";
import { formatCurrency, formatPercentage } from "@/utils/format";

const ADMIN_TABS = [
  { id: "kyc", label: "KYC Queue", icon: Users },
  { id: "strategies", label: "Strategies", icon: BarChart3 },
  { id: "system", label: "System Health", icon: Activity },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["id"];

type SixDebugResponse = {
  ready: boolean;
  reason?: string;
  extraction?: {
    parsedQuoteCount?: number;
    matchedValorIds?: string[];
    unmatchedValorIds?: string[];
  };
};

type TelemetryLog = {
  id: string;
  action: string;
  entity: string;
  time: string;
  tone: "ok" | "warn" | "gold";
};

export function AdminDashboardClient() {
  const [activeTab, setActiveTab] = useState<AdminTab>("kyc");
  const { strategies, isLoadingStrategies } = useVaults();
  const { auditEvents } = useCompliance();
  const { settlements } = useSettlements();
  const { createStrategy, isCreatingStrategy } = useVaults();

  const [isCreateStrategyModalOpen, setCreateStrategyModalOpen] =
    useState(false);
  const [strategyForm, setStrategyForm] = useState({
    name: "",
    apyBps: "",
    minDeposit: "5000",
    maxCapacity: "1000000",
    riskTier: "1",
    lockupDays: "0",
  });

  const [sixSnapshot, setSixSnapshot] = useState<SixDebugResponse | null>(null);
  const [sixLatencyMs, setSixLatencyMs] = useState<number | null>(null);
  const [sixError, setSixError] = useState<string | null>(null);
  const [lastTelemetryAt, setLastTelemetryAt] = useState<string | null>(null);

  const handleCreateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStrategy(strategyForm);
      setCreateStrategyModalOpen(false);
      setStrategyForm({
        name: "",
        apyBps: "",
        minDeposit: "5000",
        maxCapacity: "1000000",
        riskTier: "1",
        lockupDays: "0",
      });
    } catch (err) {
      console.error("Failed to create strategy:", err);
    }
  };

  const totalTvl = useMemo(() => {
    return (strategies || []).reduce(
      (acc: number, s: any) => acc + (s.tvl || 0),
      0,
    );
  }, [strategies]);

  const activeStrategiesCount = useMemo(() => {
    return (strategies || []).filter((s: any) => s.isActive).length;
  }, [strategies]);

  const safeSettlements = settlements?.settlements ?? [];
  const completedSettlements = safeSettlements.filter(
    (item: any) => item.status === "completed",
  ).length;
  const failedSettlements = safeSettlements.filter(
    (item: any) => item.status === "failed",
  ).length;
  const pendingSettlements = safeSettlements.filter(
    (item: any) => item.status === "pending" || item.status === "settling",
  ).length;

  const travelRuleSignals = useMemo(() => {
    const events = (auditEvents ?? []) as Array<{
      description?: string;
      eventType?: string;
      timestamp?: string;
      status?: string;
    }>;
    return events.filter((event) => {
      const text =
        `${event.description ?? ""} ${event.eventType ?? ""}`.toLowerCase();
      return text.includes("travel") || text.includes("settlement");
    });
  }, [auditEvents]);

  const travelRuleRecentStatus =
    travelRuleSignals[0]?.status === "failed" ? "Attention" : "Monitoring";

  const rpcStatus = isLoadingStrategies
    ? "Syncing"
    : strategies && strategies.length > 0
      ? "Connected"
      : "Degraded";

  const rpcStatusTone =
    rpcStatus === "Connected"
      ? "ok"
      : rpcStatus === "Syncing"
        ? "gold"
        : "warn";

  const systemLogs: TelemetryLog[] = useMemo(() => {
    const rawEvents = (auditEvents ?? []) as Array<{
      id?: string;
      description?: string;
      eventType?: string;
      timestamp?: string;
      status?: string;
    }>;

    if (!rawEvents.length) {
      return [];
    }

    return rawEvents.slice(0, 6).map((event, index) => {
      const status = (event.status ?? "success").toLowerCase();
      return {
        id: event.id ?? `evt-${index}`,
        action: event.description || event.eventType || "System event",
        entity: event.eventType || "audit",
        time: event.timestamp
          ? new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        tone: status === "failed" ? "warn" : "ok",
      };
    });
  }, [auditEvents]);

  useEffect(() => {
    let ignore = false;

    const fetchSystemTelemetry = async () => {
      const startedAt = performance.now();
      try {
        const response = await api.get<SixDebugResponse>(
          "/market-data/six/debug",
          {
            params: { symbols: "EURUSD,USDCHF,XAUUSD" },
          },
        );
        if (ignore) return;
        setSixSnapshot(response.data);
        setSixLatencyMs(Math.round(performance.now() - startedAt));
        setSixError(null);
        setLastTelemetryAt(new Date().toISOString());
      } catch (error) {
        if (ignore) return;
        setSixError(
          error instanceof Error ? error.message : "Telemetry failed",
        );
        setSixLatencyMs(Math.round(performance.now() - startedAt));
        setLastTelemetryAt(new Date().toISOString());
      }
    };

    void fetchSystemTelemetry();
    const timer = window.setInterval(() => void fetchSystemTelemetry(), 30_000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-gold" />
            <h1 className="font-heading text-2xl text-gold">
              Unified Admin Dashboard
            </h1>
          </div>
          <p className="font-body text-xs text-muted-vault">
            Global protocol oversight and compliance control nexus.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-sm border border-vault-border bg-vault-surface px-4 py-2">
          <div className="text-right">
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Total Protocol TVL
            </p>
            <p className="font-heading text-sm text-gold">
              {formatCurrency(totalTvl)}
            </p>
          </div>
          <div className="h-8 w-px bg-vault-border" />
          <div className="text-right">
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Active Strategies
            </p>
            <p className="font-heading text-sm text-gold">
              {activeStrategiesCount}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div
        className="flex items-center gap-2 border-b border-vault-border"
        role="tablist"
      >
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 font-heading text-sm transition-colors",
                active
                  ? "text-gold"
                  : "text-muted-vault hover:text-text-primary",
              )}
            >
              <Icon className="size-4" />
              {tab.label}
              {active && (
                <motion.div
                  layoutId="admin-active-tab"
                  className="absolute inset-x-0 bottom-0 h-px bg-gold"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "kyc" && (
          <motion.div
            key="kyc"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <AdminKycClient />
          </motion.div>
        )}

        {activeTab === "strategies" && (
          <motion.div
            key="strategies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-sm border border-vault-border bg-vault-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-heading text-sm font-semibold text-text-primary flex items-center gap-2">
                    <BarChart3 className="size-4 text-gold" />
                    Yield Strategy Performance
                  </h3>
                  <button
                    onClick={() => setCreateStrategyModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-sm bg-gold/10 px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
                  >
                    <Plus className="size-3" />
                    Create Strategy
                  </button>
                </div>
                <div className="space-y-3">
                  {isLoadingStrategies ? (
                    <p className="text-xs text-muted-vault">
                      Loading strategy data...
                    </p>
                  ) : (
                    (strategies || []).map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-sm border border-vault-border bg-vault-elevated p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-heading text-xs font-medium text-text-primary truncate">
                            {s.name}
                          </p>
                          <p className="font-body text-[10px] text-muted-vault">
                            Risk: {s.riskRating} · Tier {s.minTier}+
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-heading text-xs text-gold">
                            {formatPercentage(s.apy)} APY
                          </p>
                          <p className="font-body text-[10px] text-muted-vault">
                            {formatCurrency(s.tvl, { compact: true })} TVL
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-5">
                <h3 className="mb-4 font-heading text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Activity className="size-4 text-gold" />
                  Yield Distribution
                </h3>
                <div className="aspect-square max-h-60 mx-auto rounded-full border border-vault-border border-dashed flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <p className="font-heading text-xl text-gold">
                      {formatPercentage(7.2)}
                    </p>
                    <p className="font-body text-[10px] uppercase text-muted-vault text-center">
                      Protocol
                      <br />
                      Average APY
                    </p>
                  </div>
                  {/* Decorative arcs */}
                  <svg className="absolute inset-0 size-full -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="280 400"
                      className="text-gold/20"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="180 400"
                      className="text-gold"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "system" && (
          <motion.div
            key="system"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── System Status Cards ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-sm border border-vault-border bg-vault-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="size-4 text-teal" />
                    <span className="font-heading text-xs font-medium text-text-primary">
                      SIX Web API
                    </span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px]",
                      sixSnapshot?.ready
                        ? "bg-ok/10 text-ok"
                        : "bg-warn/10 text-warn",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        sixSnapshot?.ready ? "bg-ok animate-pulse" : "bg-warn",
                      )}
                    />
                    {sixSnapshot?.ready ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-muted-vault">
                    Latency: {sixLatencyMs !== null ? `${sixLatencyMs}ms` : "—"}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Auth:{" "}
                    {sixSnapshot?.ready
                      ? "mTLS ready"
                      : (sixSnapshot?.reason ?? "Not ready")}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Parsed quotes:{" "}
                    {sixSnapshot?.extraction?.parsedQuoteCount ?? 0}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-gold" />
                    <span className="font-heading text-xs font-medium text-text-primary">
                      Solana RPC (Devnet)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px]",
                      rpcStatusTone === "ok"
                        ? "bg-ok/10 text-ok"
                        : rpcStatusTone === "gold"
                          ? "bg-gold/10 text-gold"
                          : "bg-warn/10 text-warn",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        rpcStatusTone === "ok"
                          ? "bg-ok animate-pulse"
                          : rpcStatusTone === "gold"
                            ? "bg-gold"
                            : "bg-warn",
                      )}
                    />
                    {rpcStatus}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-muted-vault">
                    On-chain strategy reads: {strategies?.length ?? 0}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Active strategies: {activeStrategiesCount}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Last telemetry:{" "}
                    {lastTelemetryAt
                      ? new Date(lastTelemetryAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-gold" />
                    <span className="font-heading text-xs font-medium text-text-primary">
                      Travel Rule (GTR)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px]",
                      travelRuleRecentStatus === "Attention"
                        ? "bg-warn/10 text-warn"
                        : "bg-gold/10 text-gold",
                    )}
                  >
                    {travelRuleRecentStatus}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-[11px] text-muted-vault">
                    Settlement backlog: {pendingSettlements}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Completed / Failed: {completedSettlements} /{" "}
                    {failedSettlements}
                  </p>
                  <p className="font-body text-[11px] text-muted-vault">
                    Travel-rule related events: {travelRuleSignals.length}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Resource Monitoring ── */}
            <div className="rounded-sm border border-vault-border bg-vault-surface p-5">
              <h3 className="mb-4 font-heading text-sm font-semibold text-text-primary">
                Institutional Audit Feed
              </h3>
              <div className="space-y-px overflow-hidden rounded-sm border border-vault-border">
                {systemLogs.length > 0 ? (
                  systemLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between bg-vault-elevated px-4 py-3 hover:bg-vault-border/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            log.tone === "ok"
                              ? "bg-ok"
                              : log.tone === "warn"
                                ? "bg-warn"
                                : "bg-gold",
                          )}
                        />
                        <div>
                          <p className="font-heading text-[11px] text-text-primary leading-none mb-1">
                            {log.action}
                          </p>
                          <p className="font-body text-[10px] text-muted-vault">
                            {log.entity}
                          </p>
                        </div>
                      </div>
                      <span className="font-body text-[10px] text-muted-vault">
                        {log.time}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 bg-vault-elevated px-4 py-3">
                    <AlertTriangle className="size-3 text-warn" />
                    <span className="font-body text-[11px] text-muted-vault">
                      {sixError
                        ? `Telemetry warning: ${sixError}`
                        : "No audit events yet"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateStrategyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateStrategyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-sm border border-vault-border bg-vault-surface p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-bold text-text-primary">
                    Create Yield Strategy
                  </h2>
                  <p className="font-body text-xs text-muted-vault">
                    Configure a new institutional interest-bearing strategy
                  </p>
                </div>
                <button
                  onClick={() => setCreateStrategyModalOpen(false)}
                  className="rounded-full p-1 text-muted-vault transition-colors hover:bg-vault-elevated hover:text-text-primary"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStrategy} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                    Strategy Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swiss T-Bill Plus"
                    value={strategyForm.name}
                    onChange={(e) =>
                      setStrategyForm({ ...strategyForm, name: e.target.value })
                    }
                    className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                      APY (Basis Points)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 485 for 4.85%"
                      value={strategyForm.apyBps}
                      onChange={(e) =>
                        setStrategyForm({
                          ...strategyForm,
                          apyBps: e.target.value,
                        })
                      }
                      className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                      Risk Tier
                    </label>
                    <select
                      value={strategyForm.riskTier}
                      onChange={(e) =>
                        setStrategyForm({
                          ...strategyForm,
                          riskTier: e.target.value,
                        })
                      }
                      className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                    >
                      <option value="1">Tier 1 (Low)</option>
                      <option value="2">Tier 2 (Medium)</option>
                      <option value="3">Tier 3 (High)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                      Min Deposit (USDC)
                    </label>
                    <input
                      type="number"
                      required
                      value={strategyForm.minDeposit}
                      onChange={(e) =>
                        setStrategyForm({
                          ...strategyForm,
                          minDeposit: e.target.value,
                        })
                      }
                      className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                      Capacity (USDC)
                    </label>
                    <input
                      type="number"
                      required
                      value={strategyForm.maxCapacity}
                      onChange={(e) =>
                        setStrategyForm({
                          ...strategyForm,
                          maxCapacity: e.target.value,
                        })
                      }
                      className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-vault">
                    Lockup Period (Days)
                  </label>
                  <input
                    type="number"
                    required
                    value={strategyForm.lockupDays}
                    onChange={(e) =>
                      setStrategyForm({
                        ...strategyForm,
                        lockupDays: e.target.value,
                      })
                    }
                    className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary outline-none transition-colors focus:border-gold/50"
                  />
                </div>

                <div className="rounded-sm bg-gold/5 p-3 flex items-start gap-2 border border-gold/10">
                  <Info className="size-4 text-gold shrink-0 mt-0.5" />
                  <p className="font-body text-[10px] text-muted-vault leading-relaxed">
                    Strategies are initialized directly on the Solana
                    blockchain. The platform authority will manage the treasury
                    allocation across regulated counterparts.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingStrategy}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-gold py-2.5 font-heading text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-gold-light disabled:opacity-50"
                >
                  {isCreatingStrategy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Initialize Strategy"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
