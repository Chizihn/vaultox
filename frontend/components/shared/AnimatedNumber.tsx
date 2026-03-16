"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency, formatPercentage } from "@/utils/format";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: "number" | "currency" | "compact-currency" | "percentage";
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = "number",
  duration = 800,
  delay = 0,
  decimals,
  prefix,
  suffix,
  className,
}: AnimatedNumberProps) {
  const resolvedDecimals =
    decimals ??
    (format === "currency" || format === "compact-currency" ? 0 : 1);

  const count = useCountUp(value, {
    duration,
    delay,
    decimals: resolvedDecimals,
  });

  const display = () => {
    if (format === "currency")
      return formatCurrency(count, { decimals: resolvedDecimals });
    if (format === "compact-currency")
      return formatCurrency(count, { compact: true });
    if (format === "percentage")
      return formatPercentage(count, resolvedDecimals);
    return count.toLocaleString("en-US", {
      minimumFractionDigits: resolvedDecimals,
      maximumFractionDigits: resolvedDecimals,
    });
  };

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {display()}
      {suffix}
    </span>
  );
}
