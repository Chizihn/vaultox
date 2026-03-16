"use client";

import { motion } from "framer-motion";
import { Lock, Unlock, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceTier } from "@/types";

interface YieldRung {
  apy: number;
  label: string;
  minTier: ComplianceTier;
  tiers: string;
  color: string;
}

const RUNGS: YieldRung[] = [
  {
    apy: 4.2,
    label: "USDC T-Bill Strategy",
    minTier: 3,
    tiers: "All Tiers",
    color: "#4FC3C3",
  },
  {
    apy: 7.8,
    label: "Private Credit RWA",
    minTier: 2,
    tiers: "Tier 2+",
    color: "#C9A84C",
  },
  {
    apy: 11.4,
    label: "Commodity + Institutional LP",
    minTier: 1,
    tiers: "Tier 1 Only",
    color: "#C9A84C",
  },
];

interface YieldLadderProps {
  userTier: ComplianceTier;
  className?: string;
}

export function YieldLadder({ userTier, className }: YieldLadderProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-text-primary">
          Your Yield Access
        </h3>
        <span className="font-body text-[11px] text-muted-vault">
          Compliance-gated
        </span>
      </div>

      <div className="relative flex flex-col-reverse gap-2">
        {/* Left rail line */}
        <div className="absolute left-5 top-0 bottom-0 flex flex-col items-center">
          <ArrowUp className="size-4 text-muted-vault/40" />
          <div className="flex-1 w-px bg-linear-to-t from-teal/20 to-gold/40" />
        </div>

        {RUNGS.map((rung, i) => {
          const locked = userTier > rung.minTier;
          const isCurrentTierRung = rung.minTier === userTier;

          return (
            <motion.div
              key={rung.label}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.35 }}
              className={cn(
                "relative ml-10 flex items-center gap-3 rounded-sm border p-4 transition-all",
                locked
                  ? "border-vault-border bg-vault-surface opacity-50"
                  : isCurrentTierRung
                    ? "border-gold/50 bg-gold/5 glow-gold"
                    : "border-vault-border bg-vault-surface",
              )}
            >
              {/* Rung connector */}
              <div
                className="absolute -left-5.5 top-1/2 h-px w-5 -translate-y-1/2"
                style={{ backgroundColor: locked ? "#3A3F5C" : rung.color }}
              />

              {/* Lock/unlock icon */}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  locked
                    ? "border-vault-border bg-vault-elevated"
                    : "border-gold/30 bg-gold/10",
                )}
              >
                {locked ? (
                  <Lock className="size-4 text-muted-vault" />
                ) : (
                  <Unlock className="size-4 text-gold" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-heading text-xs font-semibold",
                    locked ? "text-muted-vault" : "text-text-primary",
                  )}
                >
                  {rung.label}
                </p>
                <p className="font-body text-[11px] text-muted-vault">
                  {rung.tiers}
                </p>
              </div>

              {/* APY */}
              <div className="shrink-0 text-right">
                <p
                  className="font-heading text-xl font-bold leading-none"
                  style={{ color: locked ? "#3A3F5C" : rung.color }}
                >
                  {rung.apy}%
                </p>
                <p className="font-body text-[10px] text-muted-vault">APY</p>
              </div>

              {/* Current tier marker */}
              {isCurrentTierRung && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                  <div className="rounded-full border border-gold bg-vault-base px-1.5 py-0.5 font-body text-[9px] text-gold">
                    YOU
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {userTier > 1 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 rounded-sm border border-teal/20 bg-teal/5 p-3 font-body text-xs text-muted-vault"
        >
          Upgrade your compliance tier to unlock higher yield strategies.{" "}
          <a href="/compliance" className="text-teal hover:underline">
            Learn more →
          </a>
        </motion.p>
      )}
    </div>
  );
}
