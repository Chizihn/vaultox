"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency, formatPercentage } from "@/utils/format";

interface MetricCardProps {
  label: string;
  value: number;
  format?: "currency" | "number" | "percentage" | "compact-currency";
  delta?: number;
  deltaLabel?: string;
  subtitle?: string;
  accentColor?: "gold" | "teal" | "ok" | "warn";
  suffix?: string;
  className?: string;
  children?: React.ReactNode;
  index?: number;
}

const accentTextColors = {
  gold: "text-gold",
  teal: "text-teal",
  ok: "text-ok",
  warn: "text-warn",
};

const accentGlows = {
  gold: "glow-gold",
  teal: "glow-teal",
  ok: "glow-ok",
  warn: "",
};

const accentBorders = {
  gold: "border-gold/20",
  teal: "border-teal/20",
  ok: "border-ok/20",
  warn: "border-warn/20",
};

export function MetricCard({
  label,
  value,
  format = "currency",
  delta,
  deltaLabel,
  subtitle,
  accentColor = "gold",
  suffix,
  className,
  children,
  index = 0,
}: MetricCardProps) {
  const countUp = useCountUp(value, {
    duration: 800,
    decimals: format === "currency" || format === "compact-currency" ? 0 : 1,
    delay: index * 100,
  });

  const displayValue = () => {
    if (format === "currency") return formatCurrency(countUp);
    if (format === "compact-currency")
      return formatCurrency(countUp, { compact: true });
    if (format === "percentage") return formatPercentage(countUp);
    return countUp.toLocaleString();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "relative overflow-hidden rounded-sm border bg-vault-surface p-5 transition-all duration-200",
        accentBorders[accentColor],
        className,
      )}
    >
      {/* Top accent line */}
      <div
        className={cn("absolute inset-x-0 top-0 h-px", {
          "bg-gold/40": accentColor === "gold",
          "bg-teal/40": accentColor === "teal",
          "bg-ok/40": accentColor === "ok",
          "bg-warn/40": accentColor === "warn",
        })}
      />

      <p className="mb-3 font-heading text-xs font-medium uppercase tracking-widest text-muted-vault">
        {label}
      </p>

      {children ?? (
        <div className="flex items-end justify-between gap-2">
          <p
            className={cn(
              "font-heading text-[2rem] leading-none tracking-tight",
              accentTextColors[accentColor],
            )}
          >
            {displayValue()}
            {suffix && <span className="ml-1 text-xl">{suffix}</span>}
          </p>

          {(delta !== undefined || subtitle) && (
            <div className="flex flex-col items-end gap-0.5">
              {delta !== undefined && (
                <span
                  className={cn(
                    "font-body text-xs",
                    delta >= 0 ? "text-ok" : "text-warn",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              )}
              {deltaLabel && (
                <span className="font-body text-[11px] text-muted-vault">
                  {deltaLabel}
                </span>
              )}
              {subtitle && (
                <span className="font-body text-xs text-muted-vault">
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
