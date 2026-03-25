"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface PortfolioDonutProps {
  data: DonutSlice[];
  totalLabel?: string;
  totalValue?: number;
  className?: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-sm border border-vault-border bg-vault-surface px-3 py-2 shadow-lg">
      <p className="font-heading text-xs font-semibold text-text-primary">
        {item.name}
      </p>
      <p className="font-body text-xs text-gold">
        {formatCurrency(item.value ?? 0, { compact: true })}
      </p>
    </div>
  );
}

export function PortfolioDonut({
  data,
  totalLabel = "Total AUM",
  totalValue,
  className,
}: PortfolioDonutProps) {
  const total = totalValue ?? data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="relative h-52 w-full max-w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="82%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
            {totalLabel}
          </span>
          <span className="font-body text-xl text-gold">
            {formatCurrency(total, { compact: true })}
          </span>
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-4 w-full space-y-2">
        {data.map((item) => {
          const pct =
            total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
          return (
            <li key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-body text-xs text-text-primary">
                  {item.name}
                </span>
              </div>
              <span className="font-body text-xs text-muted-vault">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
