"use client";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from "recharts";
import type { ComplianceScores } from "@/types";

interface ComplianceRadarProps {
  scores: ComplianceScores;
  size?: number;
}

const SCORE_LABELS: Record<keyof ComplianceScores, string> = {
  kycDepth: "KYC Depth",
  amlCoverage: "AML Coverage",
  jurisdictionReach: "Jurisdiction",
  reportingQuality: "Reporting",
  transactionLimits: "Tx Limits",
};

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { subject: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-vault-border bg-vault-surface px-3 py-2 font-body text-xs shadow-lg">
      <p className="text-text-primary">{payload[0].payload.subject}</p>
      <p className="text-teal">{payload[0].value}%</p>
    </div>
  );
}

export function ComplianceRadar({ scores }: ComplianceRadarProps) {
  const data = (Object.keys(scores) as (keyof ComplianceScores)[]).map(
    (key) => ({
      subject: SCORE_LABELS[key],
      value: scores[key],
      fullMark: 100,
    }),
  );

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <PolarGrid stroke="#3A3F5C" gridType="polygon" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "#8A8EA8",
              fontSize: 10,
              fontFamily: "var(--font-dm-mono)",
            }}
          />
          <Radar
            name="Compliance"
            dataKey="value"
            stroke="#4FC3C3"
            fill="#4FC3C3"
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
