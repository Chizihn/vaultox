"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/utils/format";
import type { SettlementArc, SettlementStatus } from "@/types";
import { cn } from "@/lib/utils";

/* ── Colour map ─────────────────────────────────────────────────────────── */
const arcColors: Record<SettlementStatus, string> = {
  settling: "#C9A84C",
  completed: "#4FC3C3",
  pending: "#8B6F30",
  failed: "#FF5A5A",
};

const strokeWidths: Record<SettlementStatus, number> = {
  settling: 2,
  completed: 1.5,
  pending: 1,
  failed: 1,
};

/* ── Quadratic arc path from (x1,y1) to (x2,y2) with vertical control pt ─ */
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.25;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

interface WorldMapProps {
  arcs: SettlementArc[];
  className?: string;
}

export function WorldMap({ arcs, className }: WorldMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className={cn("relative overflow-hidden rounded-sm", className)}>
      <svg
        viewBox="0 0 980 500"
        className="h-full w-full"
        aria-label="Global settlement map"
        role="img"
      >
        {/* ── Flat world outline (simplified) ────────────────────────────── */}
        {/* Background */}
        <rect width={980} height={500} fill="#0A0E1A" />

        {/* Grid lines */}
        {[100, 200, 300, 400].map((y) => (
          <line
            key={y}
            x1={0}
            y1={y}
            x2={980}
            y2={y}
            stroke="#1A1F35"
            strokeWidth={0.5}
          />
        ))}
        {[0, 140, 280, 420, 560, 700, 840, 980].map((x) => (
          <line
            key={x}
            x1={x}
            y1={0}
            x2={x}
            y2={500}
            stroke="#1A1F35"
            strokeWidth={0.5}
          />
        ))}

        {/* Very simplified continent shapes */}
        {/* North America */}
        <path
          d="M 160 80 L 260 70 L 320 100 L 310 160 L 280 200 L 240 210 L 200 190 L 160 160 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* South America */}
        <path
          d="M 220 230 L 280 220 L 310 260 L 300 320 L 270 360 L 230 350 L 210 300 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* Europe */}
        <path
          d="M 460 80 L 540 75 L 560 100 L 540 130 L 500 135 L 465 120 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* Africa */}
        <path
          d="M 480 145 L 560 140 L 580 200 L 565 290 L 520 310 L 475 290 L 460 220 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* Middle East */}
        <path
          d="M 580 110 L 640 105 L 660 140 L 630 165 L 580 155 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* Asia */}
        <path
          d="M 640 60 L 840 55 L 870 100 L 850 160 L 780 180 L 700 170 L 640 140 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />
        {/* Australia */}
        <path
          d="M 760 280 L 840 275 L 860 320 L 840 355 L 790 355 L 760 320 Z"
          fill="#1A1F35"
          stroke="#3A3F5C"
          strokeWidth={0.5}
        />

        {/* ── Settlement arcs ─────────────────────────────────────────── */}
        {arcs.map((arc, i) => {
          const id = `arc-${i}`;
          const path = arcPath(arc.from.x, arc.from.y, arc.to.x, arc.to.y);
          const color = arcColors[arc.status];
          const sw = strokeWidths[arc.status];
          const isActive = arc.status === "settling";
          const isHovered = hovered === id;

          return (
            <g key={id}>
              {/* Base arc line */}
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? sw + 1 : sw}
                strokeOpacity={isHovered ? 1 : 0.6}
                strokeLinecap="round"
                strokeDasharray={isActive ? "6 4" : undefined}
              />

              {/* Animated travel dot for settling arcs */}
              {isActive && (
                <circle r="4" fill={color} opacity="0.9">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
              )}

              {/* Hover hit area */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
              />

              {/* Hover tooltip */}
              {isHovered && (
                <foreignObject
                  x={Math.min(arc.from.x, arc.to.x) - 10}
                  y={Math.min(arc.from.y, arc.to.y) - 60}
                  width={140}
                  height={40}
                >
                  <div className="rounded-sm border border-vault-border bg-vault-surface px-2 py-1 font-body text-[10px] text-text-primary shadow-lg">
                    {formatCurrency(arc.amount, { compact: true })} USDC
                    &middot; {arc.status}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* ── City node dots ───────────────────────────────────────────── */}
        {arcs
          .flatMap((a) => [a.from, a.to])
          .filter((c, i, arr) => arr.findIndex((n) => n.name === c.name) === i)
          .map((city, cityIdx) => (
            <g key={city.name}>
              {/* Outer glow ring */}
              <circle
                cx={city.x}
                cy={city.y}
                r={10}
                fill="rgba(79,195,195,0.1)"
                stroke="rgba(79,195,195,0.3)"
                strokeWidth={1}
              >
                <animate
                  attributeName="r"
                  values="8;14;8"
                  dur="3s"
                  repeatCount="indefinite"
                  begin={`${(cityIdx * 0.4) % 2}s`}
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="3s"
                  repeatCount="indefinite"
                  begin={`${(cityIdx * 0.4) % 2}s`}
                />
              </circle>
              {/* Core dot */}
              <circle cx={city.x} cy={city.y} r={4} fill="#4FC3C3" />
              {/* Label */}
              <text
                x={city.x + 8}
                y={city.y - 6}
                fill="#8A8EA8"
                fontSize={9}
                fontFamily="var(--font-dm-mono), monospace"
              >
                {city.name}
              </text>
            </g>
          ))}
      </svg>
    </div>
  );
}
