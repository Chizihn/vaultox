"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  className,
  delay = 0.2,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
      case "top":
      default:
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "bottom":
        return "bottom-full left-1/2 -translate-x-1/2 border-b-vault-elevated border-l-transparent border-r-transparent border-t-transparent mb-[-1px]";
      case "left":
        return "left-full top-1/2 -translate-y-1/2 border-l-vault-elevated border-b-transparent border-t-transparent border-r-transparent ml-[-1px]";
      case "right":
        return "right-full top-1/2 -translate-y-1/2 border-r-vault-elevated border-b-transparent border-t-transparent border-l-transparent mr-[-1px]";
      case "top":
      default:
        return "top-full left-1/2 -translate-x-1/2 border-t-vault-elevated border-l-transparent border-r-transparent border-b-transparent mt-[-1px]";
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1, delay }}
            className={cn(
              "pointer-events-none absolute z-[100] w-max max-w-[200px] whitespace-normal rounded-sm border border-gold/20 bg-vault-elevated px-2.5 py-1.5 shadow-xl",
              getPositionClasses(),
              className
            )}
          >
            <div className="relative z-10 font-body text-[10px] leading-tight text-text-primary">
              {content}
            </div>
            {/* Arrow */}
            <div
              className={cn(
                "absolute h-0 w-0 border-[6px]",
                getArrowClasses()
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
