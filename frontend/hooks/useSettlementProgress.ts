"use client";

import { useState, useCallback } from "react";
import type { SettlementStep } from "@/types";

const SETTLEMENT_STEPS: { label: string; delayMs: number }[] = [
  { label: "KYC Verified", delayMs: 400 },
  { label: "FX Rate Locked", delayMs: 350 },
  { label: "Funds Escrowed", delayMs: 300 },
  { label: "Settling...", delayMs: 600 },
  { label: "Confirmed", delayMs: 350 },
];

/**
 * Drives the 5-step settlement progress UI.
 * Steps correspond to the real phases of a cross-border settlement;
 * timing is cosmetic (the actual work happens in the initiateSettlement call).
 * Returns the current step states and a function to run the animation.
 */
export function useSettlementProgress() {
  const [steps, setSteps] = useState<SettlementStep[]>(
    SETTLEMENT_STEPS.map((s) => ({ label: s.label, status: "pending" })),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalTime, setTotalTime] = useState(0);

  const startSettlement = useCallback(async () => {
    setIsRunning(true);
    setIsComplete(false);
    setTotalTime(0);

    // Reset all to pending
    setSteps(
      SETTLEMENT_STEPS.map((s) => ({ label: s.label, status: "pending" })),
    );

    const startTime = Date.now();

    for (let i = 0; i < SETTLEMENT_STEPS.length; i++) {
      // Set current step to processing
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "processing" } : s)),
      );

      await new Promise((r) => setTimeout(r, SETTLEMENT_STEPS[i].delayMs));

      // Set current step to completed
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "completed" } : s)),
      );
    }

    setTotalTime((Date.now() - startTime) / 1000);
    setIsRunning(false);
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    setSteps(
      SETTLEMENT_STEPS.map((s) => ({ label: s.label, status: "pending" })),
    );
    setIsRunning(false);
    setIsComplete(false);
    setTotalTime(0);
  }, []);

  return { steps, isRunning, isComplete, totalTime, startSettlement, reset };
}
