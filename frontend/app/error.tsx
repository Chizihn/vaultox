"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/utils/error-handler";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-vault-base px-6 py-12">
      <div className="w-full max-w-md rounded-sm border border-vault-border bg-vault-surface p-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warn/10 ring-1 ring-warn/30">
          <AlertTriangle className="size-6 text-warn" />
        </div>

        <h2 className="font-heading text-xl text-text-primary">
          Something went wrong
        </h2>
        <p className="mt-2 font-body text-sm text-muted-vault">
          {getErrorMessage(error, "An unexpected error occurred.")}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-sm bg-gold px-4 py-2 font-heading text-sm font-semibold text-vault-base transition-opacity hover:opacity-90"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-sm border border-vault-border bg-vault-elevated px-4 py-2 font-heading text-sm text-text-primary transition-colors hover:border-gold/30"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
