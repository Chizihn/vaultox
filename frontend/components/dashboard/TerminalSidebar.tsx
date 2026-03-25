"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketQuotesStream } from "@/hooks/useMarketQuotesStream";

const TAPE_SYMBOLS = ["XAUUSD", "XAGUSD", "EURUSD", "USDCHF", "GBPUSD"];
const STREAM_SYMBOLS = [
  ...TAPE_SYMBOLS,
  "OILHVY",
  "NATGAS",
  "BLK",
  "FOREX_RANK_1",
];

const LABELS: Record<string, string> = {
  XAUUSD: "Gold",
  XAGUSD: "Silver",
  EURUSD: "EUR/USD",
  USDCHF: "USD/CHF",
  GBPUSD: "GBP/USD",
  OILHVY: "Crude Oil",
  NATGAS: "Natural Gas",
  BLK: "BlackRock",
  FOREX_RANK_1: "Forex Rank #1",
};

function formatQuotePrice(symbol: string, price: number): string {
  if (symbol === "XAUUSD") return `$${price.toFixed(2)}`;
  if (symbol === "XAGUSD") return `$${price.toFixed(3)}`;
  if (symbol === "BLK") return `$${price.toFixed(2)}`;
  if (symbol === "OILHVY" || symbol === "NATGAS") return `$${price.toFixed(2)}`;
  return price.toFixed(4);
}

export function TerminalSidebar() {
  const { quotes, provider, transport } = useMarketQuotesStream(STREAM_SYMBOLS);

  const rows = useMemo(
    () =>
      TAPE_SYMBOLS.map((symbol) => ({
        symbol,
        label: LABELS[symbol] ?? symbol,
        quote: quotes[symbol],
      })),
    [quotes],
  );

  const topMovers = useMemo(
    () =>
      STREAM_SYMBOLS.map((symbol) => ({
        symbol,
        label: LABELS[symbol] ?? symbol,
        quote: quotes[symbol],
      }))
        .filter((entry) => Boolean(entry.quote))
        .sort(
          (a, b) =>
            Math.abs(b.quote?.change24hPct ?? 0) -
            Math.abs(a.quote?.change24hPct ?? 0),
        )
        .slice(0, 3),
    [quotes],
  );

  const sourceLabel = provider.toLowerCase().includes("six")
    ? "SIX Verified"
    : "Unavailable";

  return (
    <section aria-label="Institutional terminal">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-text-primary">
          Institutional Terminal
        </h2>
        <div className="flex items-center gap-1.5">
          <Activity className="size-3.5 text-teal" />
          <span className="font-body text-[11px] text-muted-vault">
            {transport === "stream" ? "Live stream" : "10s refresh"}
          </span>
        </div>
      </div>

      <div className="rounded-sm border border-vault-border bg-vault-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
            Market Source
          </span>
          <span
            className={cn(
              "rounded-sm border px-2 py-0.5 font-body text-[10px]",
              sourceLabel === "SIX Verified"
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-vault-border bg-vault-elevated text-muted-vault",
            )}
          >
            {sourceLabel}
          </span>
        </div>

        <div className="divide-y divide-vault-border/60">
          {rows.map(({ symbol, label, quote }) => {
            const change = quote?.change24hPct ?? 0;
            const isPositive = change >= 0;

            return (
              <div
                key={symbol}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="font-heading text-xs text-text-primary">
                    {label}
                  </p>
                  <p className="font-body text-[10px] text-muted-vault">
                    {symbol}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-body text-xs text-text-primary">
                    {quote ? formatQuotePrice(symbol, quote.price) : "N/A"}
                  </p>
                  <p
                    className={cn(
                      "font-body text-[10px]",
                      isPositive ? "text-ok" : "text-warn",
                    )}
                  >
                    {quote
                      ? `${isPositive ? "+" : ""}${change.toFixed(2)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-vault-border/60 pt-2.5">
          <p className="mb-1.5 font-body text-[10px] uppercase tracking-widest text-muted-vault">
            Top Movers
          </p>
          <div className="space-y-1.5">
            {topMovers.map(({ symbol, label, quote }) => {
              const change = quote?.change24hPct ?? 0;
              const isPositive = change >= 0;

              return (
                <div key={symbol} className="flex items-center justify-between">
                  <span className="font-body text-[11px] text-text-primary">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "font-body text-[11px]",
                      isPositive ? "text-ok" : "text-warn",
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
