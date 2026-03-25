"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, ArrowDownCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { VaultPosition } from "@/types";
import { useVaults } from "@/hooks/api/useVaults";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-handler";

interface WithdrawPanelProps {
  position: VaultPosition | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawPanel({
  position,
  isOpen,
  onClose,
}: WithdrawPanelProps) {
  const [amount, setAmount] = useState("");
  const [isDone, setIsDone] = useState(false);
  const { withdraw, isWithdrawing, withdrawStep, withdrawStatus } = useVaults();
  const maxWithdrawAmount = position?.depositedAmount ?? 0;

  // Sync amount when position changes (or panel opens with a position)
  // We use the "adjustment during render" pattern to avoid useEffect cascading renders
  const [prevPositionId, setPrevPositionId] = useState<string | null>(null);
  if (position && isOpen && position.id !== prevPositionId) {
    setPrevPositionId(position.id);
    setAmount(position.depositedAmount.toString());
  }

  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const isSolstice = position?.strategyId.includes("solstice");
  const isSolsticeLiquidity = position?.strategyId === "solstice-liquidity";
  const isSolsticeYieldLike = Boolean(isSolstice && !isSolsticeLiquidity);

  const handleWithdraw = async () => {
    if (!position || numAmount <= 0) return;
    const safeAmount = Math.floor(
      Math.min(numAmount, maxWithdrawAmount) * 1_000_000,
    ) / 1_000_000;
    if (safeAmount <= 0) return;

    try {
      await withdraw({
        positionId: position.id,
        strategyId: position.strategyId,
        amount: safeAmount,
      });
      toast.success("Withdrawal flow started successfully.");
      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        onClose();
      }, 2000);
    } catch (e) {
      console.error("Withdrawal failed", e);
      toast.error(getErrorMessage(e, "Withdrawal failed. Please try again."));
    }
  };

  const handleAmountChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, "");
    if (clean === "") {
      setAmount("");
      return;
    }
    setAmount(clean);
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
            aria-label={`Withdraw from ${position?.strategyName}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-vault-border px-6 py-5">
              <div>
                <h2 className="font-heading text-base font-semibold text-text-primary">
                  Withdraw
                </h2>
                {position && (
                  <p className="font-body text-xs text-muted-vault">
                    {position.strategyName}
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
                    Withdrawal Initiated
                  </p>
                  <p className="font-body text-sm text-muted-vault">
                    {formatCurrency(numAmount)} recovery process started.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="flex-1 space-y-6 p-6">
                  {/* Position info */}
                  {position && (
                    <div className="rounded-sm border border-vault-border bg-vault-elevated p-4">
                      <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                        Active Position
                      </p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="font-heading text-xl font-bold text-gold">
                            {formatCurrency(position.currentValue)}
                          </p>
                          <p className="font-body text-[10px] text-muted-vault">
                            Includes {formatCurrency(position.accruedYield)} accrued yield
                          </p>
                        </div>
                        <ArrowDownCircle className="size-5 text-gold/40" />
                      </div>
                    </div>
                  )}

                  {/* Amount input */}
                  <div>
                    <label
                      htmlFor="withdraw-amount"
                      className="mb-1.5 block font-body text-xs uppercase tracking-widest text-muted-vault"
                    >
                      Amount to Withdraw
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-vault">
                        $
                      </span>
                      <input
                        id="withdraw-amount"
                        type="text"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-sm border border-vault-border bg-vault-elevated py-3 pl-8 pr-16 font-heading text-lg text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                      />
                      <button
                        onClick={() =>
                          setAmount(
                            (position?.depositedAmount ?? 0).toString(),
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 font-heading text-[10px] font-bold uppercase text-gold hover:text-gold/80"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* Warning for Solstice Yield-like */}
                  {isSolsticeYieldLike && (
                    <div className="rounded-sm border border-gold/20 bg-gold/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="size-4 text-gold" />
                        <span className="font-heading text-xs font-semibold text-gold">
                          Institutional Protocol Notice
                        </span>
                      </div>
                      <p className="font-body text-[11px] text-muted-vault leading-relaxed">
                        Solstice redemptions require an oracle-verified multi-signature process. 
                        Your assets will undergo a 3-phase recovery sequence to ensure liquidity finality.
                      </p>
                      <p className="mt-3 font-body text-[11px] text-muted-vault leading-relaxed border-t border-gold/10 pt-3">
                        <span className="text-gold/90 font-semibold">Amounts:</span> Withdrawals move{" "}
                        <span className="text-text-primary">eUSX</span>, then USX → USDC. A{" "}
                        <span className="text-text-primary">1 USDC</span> deposit may show as{" "}
                        <span className="text-text-primary">~0.99 USX / eUSX</span> in your wallet due to
                        protocol mint/lock fees and rounding — that is expected. Use{" "}
                        <span className="text-gold">Max</span> or the position balance so you never
                        request more than you hold.
                      </p>
                    </div>
                  )}

                  {/* Warning for Solstice Liquidity */}
                  {isSolsticeLiquidity && (
                    <div className="rounded-sm border border-ok/20 bg-ok/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="size-4 text-ok" />
                        <span className="font-heading text-xs font-semibold text-ok">
                          Institutional Protocol Notice
                        </span>
                      </div>
                      <p className="font-body text-[11px] text-muted-vault leading-relaxed">
                        Solstice Liquidity withdrawals are instant redeems: the protocol converts
                        your <span className="text-text-primary">USX</span> into{" "}
                        <span className="text-text-primary">USDC</span> via oracle redemption, without
                        the yield vault unlock/cooldown.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer CTA */}
                <div className="border-t border-vault-border p-6">
                  <button
                    onClick={handleWithdraw}
                    disabled={numAmount <= 0 || isWithdrawing}
                    className={cn(
                      "w-full rounded-sm py-3 font-heading text-sm font-semibold transition-all",
                      numAmount > 0 && !isWithdrawing
                        ? "bg-gold text-vault-base hover:bg-gold/90"
                        : "cursor-not-allowed bg-vault-elevated text-muted-vault",
                    )}
                  >
                    {isWithdrawing
                      ? withdrawStatus || "Processing Withdrawal..."
                      : "Confirm Withdrawal"}
                  </button>

                  {/* Progressive Stepper UI */}
                  {isWithdrawing && withdrawStep > 0 && (
                    <div className="mt-6 space-y-4 rounded-sm border border-gold/20 bg-gold/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-heading text-[10px] uppercase tracking-widest text-gold">
                          Recovery Sequence
                        </p>
                        <span className="font-body text-[10px] text-muted-vault">
                          Phase {withdrawStep} of {isSolsticeLiquidity ? 2 : 3}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {(
                          isSolsticeLiquidity
                            ? [
                                {
                                  step: 1,
                                  label: "Oracle Redemption Request",
                                  desc: "Initiating USX to USDC conversion request",
                                },
                                {
                                  step: 2,
                                  label: "Asset Finalization",
                                  desc: "Receiving USDC settlement into your wallet",
                                },
                              ]
                            : [
                                {
                                  step: 1,
                                  label: "De-stacking & Yield Claim",
                                  desc: "Unlocking eUSX and claiming accrued yield to USX",
                                },
                                {
                                  step: 2,
                                  label: "Oracle Redemption Request",
                                  desc: "Initiating USX to USDC conversion request",
                                },
                                {
                                  step: 3,
                                  label: "Asset Finalization",
                                  desc: "Receiving USDC settlement into your wallet",
                                },
                              ]
                        ).map((s) => (
                          <div key={s.step} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "flex size-5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                                withdrawStep > s.step ? "bg-gold text-vault-base border-gold" : 
                                withdrawStep === s.step ? "border-gold text-gold animate-pulse" : 
                                "border-vault-border text-muted-vault"
                              )}>
                                {withdrawStep > s.step ? "✓" : s.step}
                              </div>
                              {s.step < (isSolsticeLiquidity ? 2 : 3) && (
                                <div className={cn(
                                  "w-px flex-1 my-1",
                                  withdrawStep > s.step ? "bg-gold" : "bg-vault-border"
                                )} />
                              )}
                            </div>
                            <div className="pb-2">
                              <p className={cn(
                                "font-heading text-xs font-semibold",
                                withdrawStep === s.step ? "text-gold" : 
                                withdrawStep > s.step ? "text-text-primary" : "text-muted-vault"
                              )}>
                                {s.label}
                              </p>
                              {withdrawStep === s.step && (
                                <p className="mt-0.5 font-body text-[10px] text-muted-vault leading-relaxed">
                                  {s.desc}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-center font-body text-[10px] text-muted-vault">
                    Asset recovery is a regulated procedure
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
