'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that animates a number from 0 to the target value.
 * Used for hero metrics and dashboard counters.
 */
export function useCountUp(
  target: number,
  options?: {
    duration?: number;
    decimals?: number;
    delay?: number;
    enabled?: boolean;
  }
) {
  const { duration = 800, decimals = 0, delay = 0, enabled = true } = options ?? {};
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const easeOut = useCallback((t: number) => 1 - Math.pow(1 - t, 3), []);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOut(progress);

        const factor = Math.pow(10, decimals);
        setValue(Math.round(target * easedProgress * factor) / factor);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      startTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals, delay, enabled, easeOut]);

  return value;
}
