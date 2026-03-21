"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { VaultStrategy, ComplianceTier } from "@/types";
import { useVaults } from "@/hooks/api/useVaults";
import { useMarketQuotesStream } from "@/hooks/useMarketQuotesStream";
import { Tooltip } from "@/components/shared/Tooltip";

interface DepositPanelProps {
  strategy: VaultStrategy | null;
  userTier: ComplianceTier;
  isOpen: boolean;
  onClose: () => void;
}

export function DepositPanel({
  strategy,
  userTier,
  isOpen,
  onClose,
}: DepositPanelProps) {
  const [amount, setAmount] = useState("");
  const [isDone, setIsDone] = useState(false);
  const { deposit, isDepositing } = useVaults();

  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const annualYield = (numAmount * (strategy?.apy ?? 0)) / 100;
  const monthlyYield = annualYield / 12;
  const isCompliant = strategy ? userTier <= strategy.minTier : false;
  const isCommodityStrategy = strategy?.category === "commodity";

  const { quotes: commodityQuotes, provider: commodityProvider } =
    useMarketQuotesStream(["XAUUSD", "XAGUSD"]);
  const goldPrice = commodityQuotes["XAUUSD"]?.price;
  const silverPrice = commodityQuotes["XAGUSD"]?.price;
  const goldEquivalentOz = goldPrice > 0 ? numAmount / goldPrice : 0;
  const silverEquivalentOz = silverPrice > 0 ? numAmount / silverPrice : 0;
  const priceSourceLabel = commodityProvider.toLowerCase().includes("six")
    ? "SIX Verified"
    : "Unavailable";

  const handleDeposit = async () => {
    if (!strategy || numAmount <= 0 || !isCompliant) return;
    try {
      await deposit({ strategyId: strategy.id, amount: numAmount });
      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        setAmount("");
        onClose();
      }, 2000);
    } catch (e) {
      console.error("Deposit failed", e);
    }
  };

  const handleAmountChange = (val: string) => {
    // Allow only numbers and commas
    const clean = val.replace(/[^0-9]/g, "");
    if (clean === "") {
      setAmount("");
      return;
    }
    setAmount(parseInt(clean).toLocaleString());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-vault-base/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.aside
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-vault-border bg-vault-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Deposit to ${strategy?.name}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-vault-border px-6 py-5">
              <div>
                <h2 className="font-heading text-base font-semibold text-text-primary">
                  Deposit
                </h2>
                {strategy && (
                  <p className="font-body text-xs text-muted-vault">
                    {strategy.name}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-sm border border-vault-border hover:border-gold/30 hover:text-gold"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {isDone ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex size-16 items-center justify-center rounded-full bg-ok/10"
                >
                  <CheckCircle className="size-8 text-ok" />
                </motion.div>
                <div className="text-center">
                  <p className="font-heading text-base font-semibold text-text-primary">
                    Deposit Confirmed
                  </p>
                  <p className="font-body text-sm text-muted-vault">
                    {formatCurrency(numAmount)} deposited to {strategy?.name}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="flex-1 space-y-6 p-6">
                  {/* Strategy info */}
                  {strategy && (
                    <div className="rounded-sm border border-vault-border bg-vault-elevated p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-sm font-semibold text-text-primary">
                          {strategy.name}
                        </span>
                        <span className="inline-flex items-center rounded-sm border border-gold/30 bg-gold/10 px-2 py-0.5 font-body text-xs text-gold">
                          {strategy.apy}% APY
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-body text-muted-vault">
                            TVL:{" "}
                          </span>
                          <span className="font-heading text-text-primary">
                            {formatCurrency(strategy.tvl, { compact: true })}
                          </span>
                        </div>
                        <div>
                          <span className="font-body text-muted-vault">
                            Risk:{" "}
                          </span>
                          <span
                            className={cn("font-body", {
                              "text-ok": strategy.riskRating === "Low",
                              "text-gold": strategy.riskRating === "Medium",
                              "text-warn": strategy.riskRating === "High",
                            })}
                          >
                            {strategy.riskRating}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Amount input */}
                  <div>
                    <label
                      htmlFor="deposit-amount"
                      className="mb-1.5 block font-body text-xs uppercase tracking-widest text-muted-vault"
                    >
                      Amount (USDC)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-vault">
                        $
                      </span>
                      <input
                        id="deposit-amount"
                        type="text"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-sm border border-vault-border bg-vault-elevated py-3 pl-8 pr-16 font-heading text-lg text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs text-muted-vault">
                        USDC
                      </span>
                    </div>

                    {/* Quick amounts */}
                    <div className="mt-2 flex gap-2">
                      {[100_000, 500_000, 1_000_000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setAmount(v.toLocaleString())}
                          className="flex-1 rounded-sm border border-vault-border py-1 font-body text-[11px] text-muted-vault transition-colors hover:border-gold/30 hover:text-gold"
                        >
                          {formatCurrency(v, { compact: true })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Yield preview */}
                  {numAmount > 0 && strategy && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="rounded-sm border border-teal/20 bg-teal/5 p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="size-4 text-teal" />
                        <span className="font-heading text-xs font-semibold text-teal">
                          Projected Returns
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Monthly
                          </p>
                          <Tooltip content="Average monthly earnings projected from the current strategy yield.">
                            <p className="font-heading text-sm text-teal cursor-help">
                              +{formatCurrency(monthlyYield)}
                            </p>
                          </Tooltip>
                        </div>
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Annual
                          </p>
                          <Tooltip content="Total projected earnings over a 12-month period based on current APY.">
                            <p className="font-heading text-sm text-teal cursor-help">
                              +{formatCurrency(annualYield, { compact: true })}
                            </p>
                          </Tooltip>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {numAmount > 0 && strategy && isCommodityStrategy && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="rounded-sm border border-gold/20 bg-gold/5 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Tooltip content="The current Net Asset Value of the base commodities, verified by SIX Institutional Data.">
                          <span className="font-heading text-xs font-semibold text-gold cursor-help">
                            Real-Time NAV Estimate
                          </span>
                        </Tooltip>
                        <span className="rounded-sm border border-gold/30 bg-gold/10 px-2 py-0.5 font-body text-[10px] text-gold">
                          {priceSourceLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Gold Spot
                          </p>
                          <p className="font-heading text-sm text-text-primary">
                            {goldPrice ? formatCurrency(goldPrice) : "N/A"}
                          </p>
                          {goldPrice && (
                            <p className="mt-1 font-body text-[11px] text-gold">
                              ≈ {goldEquivalentOz.toFixed(4)} oz
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Silver Spot
                          </p>
                          <p className="font-heading text-sm text-text-primary">
                            {silverPrice ? formatCurrency(silverPrice) : "N/A"}
                          </p>
                          {silverPrice && (
                            <p className="mt-1 font-body text-[11px] text-gold">
                              ≈ {silverEquivalentOz.toFixed(4)} oz
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Compliance check */}
                  <div className="space-y-2">
                    <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                      Compliance Check
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-sm border p-2",
                        isCompliant
                          ? "border-ok/20 bg-ok/5"
                          : "border-warn/20 bg-warn/5",
                      )}
                    >
                      {isCompliant ? (
                        <CheckCircle className="size-4 text-ok shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 text-warn shrink-0" />
                      )}
                      <span className="font-body text-xs">
                        {isCompliant
                          ? "Compliance verified — deposit permitted"
                          : `Requires Tier ${strategy?.minTier ?? 1} credential`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="border-t border-vault-border p-6">
                  <button
                    onClick={handleDeposit}
                    disabled={numAmount <= 0 || !isCompliant || isDepositing}
                    className={cn(
                      "w-full rounded-sm py-3 font-heading text-sm font-semibold transition-all",
                      numAmount > 0 && isCompliant && !isDepositing
                        ? "bg-gold text-vault-base hover:bg-gold/90"
                        : "cursor-not-allowed bg-vault-elevated text-muted-vault",
                    )}
                  >
                    {isDepositing
                      ? "Processing Deposit..."
                      : isCompliant
                        ? `Confirm Deposit`
                        : "Compliance Required"}
                  </button>
                  <p className="mt-2 text-center font-body text-[10px] text-muted-vault">
                    Transactions execute on Solana devnet
                  </p>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
