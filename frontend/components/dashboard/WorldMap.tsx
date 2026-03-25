"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/utils/format";
import type { SettlementArc, SettlementStatus } from "@/types";
import { cn } from "@/lib/utils";

/* ── Projection Context ────────────────────────────────────────────────── */
const MAP_WIDTH = 980;
const MAP_HEIGHT = 500;

// Equirectangular projection: maps lon/lat to SVG pixels
const project = (lng: number, lat: number) => {
  const x = (lng + 180) * (MAP_WIDTH / 360);
  const y = (90 - lat) * (MAP_HEIGHT / 180);
  return { x, y };
};

/* ── Visual Config ─────────────────────────────────────────────────────── */
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

function getArcPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dr = Math.sqrt(dx * dx + dy * dy) * 1.2; // Curve radius based on distance
  return `M${x1},${y1} A${dr},${dr} 0 0,1 ${x2},${y2}`;
}

interface WorldMapProps {
  arcs: SettlementArc[];
  className?: string;
}

export function WorldMap({ arcs, className }: WorldMapProps) {
  const [activeItem, setActiveItem] = useState<{
    type: "arc" | "city";
    data: any;
    globalX: number;
    globalY: number;
  } | null>(null);

  const isRightSide = activeItem && typeof window !== "undefined"
    ? activeItem.globalX > window.innerWidth / 2
    : false;
  
  const mapRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => {
    const cityNames = new Set(arcs.flatMap((arc) => [arc.from.name, arc.to.name]));
    const settlingCount = arcs.filter((arc) => arc.status === "settling").length;
    const completedCount = arcs.filter((arc) => arc.status === "completed").length;
    const totalVolume = arcs.reduce((sum, arc) => sum + arc.amount, 0);
    return {
      cityCount: cityNames.size,
      routeCount: arcs.length,
      settlingCount,
      completedCount,
      totalVolume,
    };
  }, [arcs]);

  const handleMouseMove = (e: React.MouseEvent, type: "arc" | "city", data: any) => {
    setActiveItem({
      type,
      data,
      globalX: e.clientX,
      globalY: e.clientY,
    });
  };

  return (
    <div 
      ref={mapRef}
      className={cn("relative overflow-hidden rounded-sm bg-[#0A0E1A]", className)}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-full w-full select-none"
        aria-label="Global settlement map"
      >
        {/* ── Grid System ── */}
        <g stroke="#1A1F35" strokeWidth="0.5">
          {[...Array(9)].map((_, i) => (
            <line key={`v-${i}`} x1={i * (MAP_WIDTH / 8)} y1={0} x2={i * (MAP_WIDTH / 8)} y2={MAP_HEIGHT} />
          ))}
          {[...Array(5)].map((_, i) => (
            <line key={`h-${i}`} x1={0} y1={i * (MAP_HEIGHT / 4)} x2={MAP_WIDTH} y2={i * (MAP_HEIGHT / 4)} />
          ))}
        </g>

        {/* ── Geographically Correct Continents (Hand-tuned paths) ── */}
        <g fill="#1A1F35" stroke="#3A3F5C" strokeWidth="0.5">
          {/* North America */}
          <path d="M120,80 L220,70 L340,90 L330,180 L280,220 L160,200 L110,130 Z" />
          {/* South America */}
          <path d="M280,230 L360,260 L320,420 L240,400 L240,250 Z" />
          {/* Europe */}
          <path d="M460,80 L560,70 L580,120 L540,150 L460,140 Z" />
          {/* Africa */}
          <path d="M470,160 L580,150 L630,220 L580,400 L500,400 L450,220 Z" />
          {/* Asia */}
          <path d="M570,60 L850,50 L920,200 L800,320 L650,250 L600,100 Z" />
          {/* Australia */}
          <path d="M780,340 L880,340 L880,440 L780,440 Z" />
          {/* Antarctica */}
          <path d="M100,480 L880,480 L880,500 L100,500 Z" />
        </g>

        {/* ── Settlement Arcs ── */}
        {arcs.map((arc, i) => {
          const from = project(arc.from.lng, arc.from.lat);
          const to = project(arc.to.lng, arc.to.lat);
          const path = getArcPath(from.x, from.y, to.x, to.y);
          const color = arcColors[arc.status];
          const sw = strokeWidths[arc.status];
          const isActive = arc.status === "settling";

          return (
            <g key={`arc-${from.x}-${to.x}-${i}`}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={sw}
                strokeOpacity="0.6"
                strokeLinecap="round"
                strokeDasharray={isActive ? "6 4" : undefined}
                className="transition-all duration-300"
              />
              
              {isActive && (
                <circle r="3" fill={color}>
                  <animateMotion dur="3s" repeatCount="indefinite" path={path} />
                </circle>
              )}

              {/* Hit area for tooltips */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
                onMouseMove={(e) => handleMouseMove(e, "arc", arc)}
                onMouseLeave={() => setActiveItem(null)}
                className="cursor-pointer"
              />
            </g>
          );
        })}

        {/* ── City Nodes ── */}
        {arcs
          .flatMap((a) => [a.from, a.to])
          .filter((c, i, arr) => arr.findIndex((n) => n.name === c.name) === i)
          .map((city, idx) => {
            const pos = project(city.lng, city.lat);
            const isHovered = activeItem?.type === "city" && activeItem.data.name === city.name;
            
            return (
              <g 
                key={city.name}
                onMouseMove={(e) => handleMouseMove(e, "city", city)}
                onMouseLeave={() => setActiveItem(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? 12 : 8}
                  fill="rgba(79,195,195,0.15)"
                  className="transition-all duration-300"
                >
                  <animate attributeName="r" values="8;12;8" dur="3s" repeatCount="indefinite" begin={`${idx * 0.5}s`} />
                </circle>
                <circle cx={pos.x} cy={pos.y} r={isHovered ? 5 : 3.5} fill="#4FC3C3" className="transition-all duration-300" />
                <text
                  x={pos.x + 10}
                  y={pos.y - 6}
                  fill={isHovered ? "#fff" : "#8A8EA8"}
                  fontSize="9"
                  className="font-code pointer-events-none transition-all duration-300"
                >
                  {city.name}
                </text>
              </g>
            );
          })}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded-sm border border-vault-border/80 bg-vault-base/80 px-3 py-2 backdrop-blur-sm">
        <p className="font-heading text-[10px] uppercase tracking-wider text-gold">
          Network Snapshot
        </p>
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-body text-[10px]">
          <span className="text-muted-vault">Hubs</span>
          <span className="text-text-primary text-right">{stats.cityCount}</span>
          <span className="text-muted-vault">Routes</span>
          <span className="text-text-primary text-right">{stats.routeCount}</span>
          <span className="text-muted-vault">Live</span>
          <span className="text-gold text-right">{stats.settlingCount}</span>
          <span className="text-muted-vault">Completed</span>
          <span className="text-ok text-right">{stats.completedCount}</span>
          <span className="text-muted-vault">24h Volume</span>
          <span className="text-teal text-right">{formatCurrency(stats.totalVolume, { compact: true })}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-sm border border-vault-border/80 bg-vault-base/80 px-3 py-2 backdrop-blur-sm">
        {[
          { label: "Settling", color: arcColors.settling },
          { label: "Completed", color: arcColors.completed },
          { label: "Pending", color: arcColors.pending },
          { label: "Failed", color: arcColors.failed },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 font-body text-[10px] text-muted-vault">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Robust HTML Tooltip via React Portal ── */}
      <AnimatePresence>
        {activeItem && createPortal(
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: "fixed",
              left: activeItem.globalX,
              top: activeItem.globalY,
              transform: `translate(${isRightSide ? "-110%" : "10%"}, -120%)`,
              pointerEvents: "none",
              zIndex: 9999,
            }}
            className="min-w-[180px] rounded-sm border border-gold/30 bg-vault-surface/98 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            {activeItem.type === "city" ? (
              <>
                <p className="font-heading text-xs font-semibold text-gold border-b border-vault-border/50 pb-1.5 mb-2.5 uppercase tracking-wider">
                  {activeItem.data.name}
                </p>
                <div className="flex justify-between items-center text-[10px] mb-1.5">
                  <span className="text-muted-vault uppercase">Lat/Long</span>
                  <span className="text-text-primary tabular-nums">{activeItem.data.lat.toFixed(2)}°, {activeItem.data.lng.toFixed(2)}°</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-vault uppercase">Status</span>
                  <span className="text-ok font-bold">ACTIVE HUB</span>
                </div>
              </>
            ) : (
              <>
                <p className="font-heading text-xs font-semibold text-gold border-b border-vault-border/50 pb-1.5 mb-2.5 uppercase tracking-wider">
                  Secure Settlement
                </p>
                <div className="flex justify-between items-center text-[10px] mb-2">
                  <span className="text-muted-vault uppercase">Volume</span>
                  <span className="text-text-primary font-heading text-sm">{formatCurrency(activeItem.data.amount)} <span className="text-[10px] text-muted-vault">USDC</span></span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-vault uppercase">Protocol</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[2px] font-bold text-[9px] uppercase",
                    activeItem.data.status === "completed" ? "bg-ok/20 text-ok" : "bg-gold/20 text-gold"
                  )}>
                    {activeItem.data.status}
                  </span>
                </div>
              </>
            )}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}
