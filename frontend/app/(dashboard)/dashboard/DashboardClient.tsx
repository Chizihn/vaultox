"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/shared/MetricCard";
import { TierBadge } from "@/components/shared/TierBadge";
import { PortfolioDonut } from "@/components/dashboard/PortfolioDonut";
import { StrategyCard } from "@/components/dashboard/StrategyCard";
import { SettlementFeed } from "@/components/dashboard/SettlementFeed";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { ComplianceRing } from "@/components/dashboard/ComplianceRing";
import { TerminalSidebar } from "@/components/dashboard/TerminalSidebar";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { useAuthStore } from "@/store";
import { useDashboard } from "@/hooks/api/useDashboard";
import { useVaults } from "@/hooks/api/useVaults";
import { useSettlements } from "@/hooks/api/useSettlements";
import api from "@/services/api";
import { formatCurrency } from "@/utils/format";
import { TIER_LABELS } from "@/utils/constants";
import type { VaultPosition, VaultStrategy, SettlementArc } from "@/types";

export function DashboardClient() {
  const { institution, tier } = useAuthStore();
  const [liveArcs, setLiveArcs] = useState<SettlementArc[]>([]);

  const { metrics } = useDashboard();
  const { strategies, positions } = useVaults();
  const { settlements } = useSettlements();

  const safeMetrics = metrics || {
    totalAUM: 0,
    aumDelta: 0,
    yieldToday: 0,
    activeSettlements: 0,
    pendingSettlements: 0,
    complianceScore: 0,
  };
  const safePositions = (positions || []) as VaultPosition[];
  const safeStrategies = (strategies || []) as VaultStrategy[];
  const safeSettlements = settlements?.settlements || [];
  const tierLabel = tier ? TIER_LABELS[tier] : "Credential pending";

  useEffect(() => {
    let ignore = false;
    const loadArcs = async () => {
      try {
        const response = await api.get("/settlements/live-arcs");
        if (!ignore) {
          setLiveArcs(response.data.arcs ?? []);
        }
      } catch (error) {
        console.error("Failed to load live settlement arcs", error);
      }
    };

    void loadArcs();
    const timer = window.setInterval(() => void loadArcs(), 5000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, []);

  const allocationData = safePositions.map((p: VaultPosition) => ({
    name: p.strategyName,
    value: p.currentValue,
    color:
      p.strategyId === "strat-001"
        ? "#4FC3C3"
        : p.strategyId === "strat-002"
          ? "#C9A84C"
          : "#3DDC84",
  }));

  const totalAUM = safePositions.reduce((acc: number, p: VaultPosition) => {
    return acc + p.currentValue;
  }, 0);

  const [sixStatus, setSixStatus] = useState<{
    ready: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    const checkSix = async () => {
      try {
        const res = await api.get("/market-data/six/debug");
        setSixStatus({ ready: res.data.ready, reason: res.data.reason });
      } catch {
        setSixStatus({ ready: false, reason: "Connection failed" });
      }
    };
    void checkSix();
    const timer = window.setInterval(checkSix, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-heading text-2xl text-gold">
            {institution?.name ?? "Dashboard"}
          </h1>
          <p className="font-body text-xs text-muted-vault">
            Treasury Command Center ·{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sixStatus && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[10px] tracking-wide uppercase transition-colors",
                sixStatus.ready
                  ? "border-ok/30 bg-ok/5 text-ok"
                  : "border-warn/30 bg-warn/5 text-warn",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  sixStatus.ready ? "bg-ok pulse-ok" : "bg-warn",
                )}
              />
              SIX Rail: {sixStatus.ready ? "Online" : "Offline"}
            </div>
          )}
          {tier && <TierBadge tier={tier} size="md" />}
        </div>
      </motion.div>

      {/* ── Hero metrics row (settlement-first order) ── */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {/* Card 1: Active Settlements */}
        <MetricCard
          label="Active Settlements"
          value={safeMetrics.activeSettlements}
          format="number"
          subtitle={`${safeMetrics.pendingSettlements} pending`}
          accentColor="teal"
          index={0}
        >
          <div className="flex items-end justify-between gap-2">
            <p className="font-heading text-[2rem] leading-none tracking-tight text-teal tabular-nums">
              <AnimatedNumber
                value={safeMetrics.activeSettlements}
                format="number"
                delay={100}
              />
            </p>
            <div className="flex flex-col items-end gap-1">
              <span className="font-body text-xs text-muted-vault">
                {safeMetrics.pendingSettlements} pending
              </span>
              {safeMetrics.activeSettlements > 0 && (
                <Activity className="size-4 animate-pulse text-teal" />
              )}
            </div>
          </div>
        </MetricCard>

        {/* Card 2: Yield Today */}
        <MetricCard
          label="Yield Accrued Today"
          value={safeMetrics.yieldToday}
          format="currency"
          accentColor="gold"
          index={1}
        >
          <div className="flex items-end justify-between gap-2">
            <p className="font-heading text-[2rem] leading-none tracking-tight text-gold pulse-teal tabular-nums">
              <AnimatedNumber
                value={safeMetrics.yieldToday}
                format="currency"
                delay={150}
              />
            </p>
            <div className="flex size-2 items-center justify-center">
              <span className="size-2 animate-pulse rounded-full bg-gold" />
            </div>
          </div>
        </MetricCard>

        {/* Card 3: Total AUM */}
        <MetricCard
          label="Total AUM"
          value={safeMetrics.totalAUM}
          format="compact-currency"
          delta={safeMetrics.aumDelta}
          deltaLabel="24h"
          accentColor="gold"
          index={2}
        />

        {/* Card 4: Compliance Score */}
        <MetricCard
          label="Compliance Score"
          value={safeMetrics.complianceScore}
          format="number"
          accentColor="ok"
          index={3}
        >
          <div className="flex items-center justify-between gap-4">
            <ComplianceRing score={safeMetrics.complianceScore} size={68} />
            <div className="text-right">
              <p className="font-body text-xs text-muted-vault">{tierLabel}</p>
              <p className="font-body text-xs text-ok">All systems nominal</p>
              <Link
                href="/compliance"
                className="mt-1 inline-flex items-center gap-0.5 font-body text-[11px] text-teal hover:underline"
              >
                View details <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
        </MetricCard>
      </section>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* ── LEFT: Settlement feed + Vault positions ── */}
        <div className="space-y-6">
          {/* Live settlement feed (promoted to main area) */}
          <section aria-label="Live settlement feed">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Live Settlement Feed
              </h2>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-teal" />
                <span className="font-body text-[11px] text-muted-vault">
                  Live
                </span>
              </div>
            </div>

            <div className="rounded-sm border border-vault-border bg-vault-surface p-4">
              <SettlementFeed settlements={safeSettlements} maxItems={5} />
            </div>
          </section>

          {/* Active vault positions (secondary, below settlement) */}
          <section aria-label="Active vault positions">
            {/* <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Treasury Parking — Vault Positions
              </h2>
              <span className="font-body text-xs text-muted-vault">
                {safePositions.length} position
                {safePositions.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {safeStrategies.map((strategy: VaultStrategy, i: number) => {
                const position = safePositions.find(
                  (p: VaultPosition) => p.strategyId === strategy.id,
                );
                return (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    position={position}
                    userTier={tier ?? 3}
                    onDeposit={(id) => {
                      window.location.href = `/vaults?strategy=${id}`;
                    }}
                    index={i}
                  />
                );
              })}
            </div> */}

            {/* ── Settlement Hero: World Map (full width, above fold) ── */}
            <section className="mt-10" aria-label="Global settlement network">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-text-primary">
                  Global Settlement Network
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-teal" />
                    <span className="font-body text-[11px] text-muted-vault">
                      Live
                    </span>
                  </div>
                  <Link
                    href="/settlements"
                    className="inline-flex items-center gap-1 font-body text-xs text-teal hover:underline"
                  >
                    Initiate Settlement <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </div>
              <div className="overflow-hidden rounded-sm border border-vault-border">
                <WorldMap
                  arcs={liveArcs}
                  className="aspect-3/1 w-full min-h-48"
                />
              </div>
            </section>
          </section>
        </div>

        {/* ── RIGHT: Portfolio donut + Terminal ── */}
        <div className="space-y-4">
          {/* Portfolio allocation */}
          <section aria-label="Portfolio allocation">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-text-primary">
                Portfolio Allocation
              </h2>
              <Link
                href="/vaults"
                className="inline-flex items-center gap-1 font-body text-xs text-teal hover:underline"
              >
                Manage vaults <ArrowUpRight className="size-3" />
              </Link>
            </div>

            <div className="rounded-sm border border-vault-border bg-vault-surface p-5">
              <div className="flex flex-col items-center gap-6">
                <PortfolioDonut
                  data={allocationData}
                  totalValue={totalAUM}
                  className="w-full max-w-52"
                />

                <div className="w-full space-y-3">
                  {safePositions.map((pos) => {
                    const pct =
                      totalAUM > 0 ? (pos.currentValue / totalAUM) * 100 : 0;
                    const color =
                      pos.strategyId === "strat-001"
                        ? "#4FC3C3"
                        : pos.strategyId === "strat-002"
                          ? "#C9A84C"
                          : "#3DDC84";
                    return (
                      <div key={pos.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-heading text-xs font-medium text-text-primary">
                            {pos.strategyName}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-heading text-xs text-teal">
                              +
                              {formatCurrency(pos.accruedYield, {
                                compact: true,
                              })}
                            </span>
                            <span className="font-heading text-xs text-text-primary">
                              {formatCurrency(pos.currentValue, {
                                compact: true,
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-vault-elevated">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.3,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-body text-[10px] text-muted-vault">
                            {pct.toFixed(1)}% allocation
                          </span>
                          <span className="font-body text-[10px] text-muted-vault">
                            {pos.apy}% APY
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <TerminalSidebar />
        </div>
      </div>
    </div>
  );
}
