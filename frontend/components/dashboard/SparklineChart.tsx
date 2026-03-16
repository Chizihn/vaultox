"use client";

import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-vault-border bg-vault-surface px-2 py-1 text-[11px] font-body text-gold">
      {payload[0].value?.toFixed(1)}%
    </div>
  );
}

export function SparklineChart({
  data,
  color = "#4FC3C3",
  height = 32,
}: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
          <Tooltip content={<SparkTooltip />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
