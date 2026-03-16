"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatTimeAgo } from "@/utils/format";
import { SettlementBadge } from "@/components/shared/StatusBadge";
import type { Settlement } from "@/types";
import { cn } from "@/lib/utils";

const statusDotColors = {
  completed: "bg-ok",
  pending: "bg-gold animate-pulse",
  settling: "bg-teal animate-pulse",
  failed: "bg-warn",
};

interface SettlementFeedProps {
  settlements: Settlement[];
  maxItems?: number;
}

export function SettlementFeed({
  settlements,
  maxItems = 6,
}: SettlementFeedProps) {
  const visible = settlements.slice(0, maxItems);

  return (
    <section aria-label="Live settlement feed" className="flex flex-col gap-0">
      <ul className="divide-y divide-vault-border/50">
        {visible.map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <div className="flex items-center gap-3 py-3">
              {/* Status dot */}
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  statusDotColors[s.status],
                )}
                aria-label={s.status}
              />

              {/* Route */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-body text-xs">
                  <span>{s.fromInstitution.jurisdictionFlag}</span>
                  <span className="text-muted-vault">
                    {s.fromInstitution.city}
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-muted-vault/60" />
                  <span>{s.toInstitution.jurisdictionFlag}</span>
                  <span className="text-muted-vault truncate">
                    {s.toInstitution.city}
                  </span>
                </div>
                <p className="font-body text-[11px] text-muted-vault">
                  {formatTimeAgo(s.initiatedAt)}
                  {s.settlementTime && (
                    <span className="ml-2 text-teal">{s.settlementTime}s</span>
                  )}
                </p>
              </div>

              {/* Amount + badge */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-heading text-xs text-text-primary">
                  {formatCurrency(s.amount, { compact: true })}
                </span>
                <SettlementBadge status={s.status} />
              </div>
            </div>
          </motion.li>
        ))}
      </ul>

      <Link
        href="/settlements"
        className="mt-3 flex items-center justify-center gap-1 rounded-sm border border-vault-border py-2 font-heading text-xs text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
      >
        View all settlements <ArrowRight className="size-3" />
      </Link>
    </section>
  );
}
