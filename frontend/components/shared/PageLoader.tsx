"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Full-page Loader ──────────────────────────────────────────────────── */
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-vault-base">
      <div className="relative">
        {/* Outer ring */}
        <motion.div
          className="size-14 rounded-full border-2 border-vault-border"
          style={{ borderTopColor: "#C9A84C" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
        {/* Inner dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-2 rounded-full bg-gold" />
        </div>
      </div>
      <p className="font-body text-xs uppercase tracking-widest text-muted-vault">
        {label}
      </p>
    </div>
  );
}

/* ─── Inline Section Loader ─────────────────────────────────────────────── */
export function SectionLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <motion.div
        className="size-8 rounded-full border-2 border-vault-border"
        style={{ borderTopColor: "#C9A84C" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

/* ─── Skeleton primitives ───────────────────────────────────────────────── */
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-vault-elevated", className)}
    />
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="rounded-sm border border-vault-border bg-vault-surface p-5">
      <SkeletonPulse className="mb-3 h-3 w-24" />
      <SkeletonPulse className="h-9 w-36" />
    </div>
  );
}

export function SkeletonStrategyCard() {
  return (
    <div className="rounded-sm border border-vault-border bg-vault-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-32" />
        <SkeletonPulse className="h-5 w-16" />
      </div>
      <SkeletonPulse className="h-3 w-full" />
      <SkeletonPulse className="h-3 w-4/5" />
      <div className="flex gap-2 pt-2">
        <SkeletonPulse className="h-8 flex-1" />
        <SkeletonPulse className="h-8 flex-1" />
      </div>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 border-b border-vault-border/50 py-3">
      <SkeletonPulse className="h-3 w-32" />
      <SkeletonPulse className="h-3 w-20" />
      <SkeletonPulse className="h-3 w-24" />
      <SkeletonPulse className="h-5 w-16 ml-auto" />
    </div>
  );
}
