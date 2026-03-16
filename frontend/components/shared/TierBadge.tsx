"use client";

import { cn } from "@/lib/utils";
import type { ComplianceTier } from "@/types";
import { TIER_BADGES } from "@/utils/constants";

interface TierBadgeProps {
  tier: ComplianceTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const tierColors: Record<ComplianceTier, string> = {
  1: "bg-ok/10 text-ok border border-ok/30",
  2: "bg-teal/10 text-teal border border-teal/30",
  3: "bg-gold/10 text-gold border border-gold/30",
};

const tierSizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1 text-sm",
};

export function TierBadge({ tier, size = "sm", className }: TierBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-heading font-semibold uppercase tracking-widest",
        tierColors[tier],
        tierSizes[size],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          {
            1: "bg-ok",
            2: "bg-teal",
            3: "bg-gold",
          }[tier],
        )}
      />
      {TIER_BADGES[tier]}
    </span>
  );
}
