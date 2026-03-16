"use client";

import { motion } from "framer-motion";
import { Lock, ChevronRight, Shield } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/utils/format";
import type {
  VaultStrategy,
  VaultPosition,
  ComplianceTier,
  RiskRating,
} from "@/types";
import { SparklineChart } from "./SparklineChart";

const riskColors: Record<RiskRating, string> = {
  Low: "text-ok border-ok/30 bg-ok/10",
  Medium: "text-gold border-gold/30 bg-gold/10",
  High: "text-warn border-warn/30 bg-warn/10",
};

interface StrategyCardProps {
  strategy: VaultStrategy;
  position?: VaultPosition;
  userTier: ComplianceTier;
  onDeposit?: (strategyId: string) => void;
  index?: number;
}

export function StrategyCard({
  strategy,
  position,
  userTier,
  onDeposit,
  index = 0,
}: StrategyCardProps) {
  const locked = userTier > strategy.minTier;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={locked ? {} : { y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-sm border bg-vault-surface p-5 transition-all duration-200",
        locked
          ? "border-vault-border opacity-60"
          : "border-vault-border hover:border-gold/30 hover:glow-gold cursor-pointer",
      )}
    >
      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-vault-surface/80 backdrop-blur-[2px]">
          <div className="flex size-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <Lock className="size-5 text-gold" />
          </div>
          <p className="font-body text-xs text-muted-vault">
            Requires Tier {strategy.minTier} Compliance
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-text-primary">
            {strategy.name}
          </h3>
          <p className="mt-0.5 font-body text-[11px] text-muted-vault line-clamp-2">
            {strategy.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center rounded-sm border border-gold/40 bg-gold/10 px-2 py-0.5 font-body text-xs font-medium text-gold">
            {formatPercentage(strategy.apy)} APY
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-1.5 py-0 font-body text-[10px] uppercase tracking-wide",
              riskColors[strategy.riskRating],
            )}
          >
            {strategy.riskRating}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
            TVL
          </p>
          <p className="font-heading text-sm text-text-primary">
            {formatCurrency(strategy.tvl, { compact: true })}
          </p>
        </div>
        {position && (
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Your Position
            </p>
            <p className="font-heading text-sm text-gold">
              {formatCurrency(position.currentValue, { compact: true })}
            </p>
          </div>
        )}
        {position && (
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Accrued Yield
            </p>
            <p className="font-heading text-sm text-teal">
              {formatCurrency(position.accruedYield)}
            </p>
          </div>
        )}
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
            Maturity
          </p>
          <p className="font-body text-sm text-text-primary">
            {strategy.maturity}
          </p>
        </div>
      </div>

      {/* Jurisdictions */}
      <div className="mb-4 flex items-center gap-1">
        <Shield className="size-3 text-muted-vault" />
        <div className="flex gap-1">
          {strategy.jurisdictions.slice(0, 5).map((flag, i) => (
            <span key={i} className="text-sm" title={flag}>
              {flag}
            </span>
          ))}
        </div>
      </div>

      {/* Sparkline */}
      <div className="mb-4">
        <p className="mb-1 font-body text-[10px] uppercase tracking-widest text-muted-vault">
          7-day APY
        </p>
        <SparklineChart
          data={strategy.sparklineData}
          color="#4FC3C3"
          height={36}
        />
      </div>

      {/* Actions */}
      {!locked && (
        <div className="flex gap-2">
          <button
            onClick={() => onDeposit?.(strategy.id)}
            className="flex-1 rounded-sm bg-gold py-2 font-heading text-xs font-semibold text-vault-base transition-colors hover:bg-gold/90"
          >
            Deposit
          </button>
          <Link
            href="/vaults"
            className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-gold/30 py-2 font-heading text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            Manage <ChevronRight className="size-3" />
          </Link>
        </div>
      )}
    </motion.article>
  );
}
