"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, send to error tracking service
    // console.error('[ErrorBoundary]', error, info);
    void error;
    void info;
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <ErrorFallback error={this.state.error} onReset={this.handleReset} />
        )
      );
    }
    return this.props.children;
  }
}

/* ── Inline error fallback ────────────────────────────────────────────── */
interface ErrorFallbackProps {
  error?: Error;
  onReset?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorFallback({
  error,
  onReset,
  className,
  compact,
}: ErrorFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-sm border border-warn/20 bg-warn/5 p-8 text-center",
        compact && "gap-2 p-4",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-warn/10">
        <AlertTriangle className="size-5 text-warn" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-sm font-semibold text-text-primary">
          Something went wrong
        </p>
        {error?.message && (
          <p className="font-body text-xs text-muted-vault">{error.message}</p>
        )}
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-sm border border-vault-border bg-vault-elevated px-3 py-1.5 font-body text-xs text-text-primary transition-colors hover:border-gold/40 hover:text-gold"
        >
          <RefreshCw className="size-3" />
          Try again
        </button>
      )}
    </div>
  );
}

/* ── Full-page error ─────────────────────────────────────────────────── */
export function PageError({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-vault-base px-4">
      <div className="flex size-16 items-center justify-center rounded-full border border-warn/30 bg-warn/10">
        <AlertTriangle className="size-8 text-warn" />
      </div>
      <div className="space-y-2 text-center">
        <h2 className="font-heading text-2xl text-gold">System Error</h2>
        <p className="font-body text-sm text-muted-vault">
          An unexpected error occurred. Please try refreshing the page.
        </p>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-sm border border-gold/30 bg-gold/10 px-5 py-2 font-heading text-sm text-gold transition-colors hover:bg-gold/20"
        >
          <RefreshCw className="size-4" />
          Retry
        </button>
      )}
    </div>
  );
}
