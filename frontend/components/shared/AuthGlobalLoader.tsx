"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store";

const AUTH_SHELL_PREFIXES = [
  "/dashboard",
  "/vaults",
  "/settlements",
  "/reports",
  "/compliance",
  // "/admin",
  "/access-pending",
];

function shouldShowAuthLoader(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Full-screen overlay while JWT + credential bootstrap runs on app routes.
 * Login, marketing, and legal pages stay interactive (no overlay).
 */
export function AuthGlobalLoader() {
  const pathname = usePathname();
  const authBootstrap = useAuthStore((s) => s.authBootstrap);

  if (!shouldShowAuthLoader(pathname) || authBootstrap === "ready") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-vault-base/90 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Loading session"
    >
      <div className="relative">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-gold/25 bg-vault-elevated">
          <Loader2 className="size-7 animate-spin text-gold" />
        </div>
        <div className="pointer-events-none absolute inset-0 animate-ping rounded-full border border-gold/10" />
      </div>
      <div className="text-center">
        <p className="font-heading text-sm text-text-primary">
          Restoring your session
        </p>
        <p className="mt-1 font-body text-xs text-muted-vault">
          Validating credentials…
        </p>
      </div>
    </div>
  );
}
