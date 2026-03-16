"use client";

import { cn } from "@/lib/utils";

interface ComplianceRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ComplianceRing({
  score,
  size = 72,
  strokeWidth = 5,
  className,
}: ComplianceRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 90 ? "#3DDC84" : score >= 70 ? "#C9A84C" : "#FF5A5A";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label={`Compliance score ${score} out of 100`}
      role="img"
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1A1F35"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-heading font-bold leading-none"
          style={{ color, fontSize: size * 0.26 }}
        >
          {score}
        </span>
        <span
          className="font-body text-muted-vault leading-none"
          style={{ fontSize: size * 0.12 }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
