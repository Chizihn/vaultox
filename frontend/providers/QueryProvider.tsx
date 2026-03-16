/**
 * providers/QueryProvider.tsx
 * ────────────────────────────
 * Wraps the app with TanStack QueryClientProvider.
 *
 * Configuration:
 *   staleTime      30s  — data considered fresh for 30 seconds
 *   gcTime          5m  — inactive query cache kept for 5 minutes
 *   retry           2   — retry failed queries twice before error state
 *   refetchOnWindowFocus false — don't refetch on tab focus (institutional UX)
 *
 * Also listens for the "vaultox:auth:expired" event fired by the axios
 * interceptor — clears the entire query cache and redirects to /login.
 */

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";

// ---------------------------------------------------------------------------
// QueryClient factory — called once per client session
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Singleton for client — avoids creating a new QueryClient on every render
// while still being safe to call during SSR (returns a fresh instance each time).
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // SSR: always create a new QueryClient
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const router = useRouter();
  const disconnect = useAuthStore((s) => s.disconnect);
  const listenerAttached = useRef(false);

  useEffect(() => {
    if (listenerAttached.current) return;
    listenerAttached.current = true;

    const handleAuthExpired = () => {
      // 1. Sign out of Zustand store
      disconnect();
      // 2. Clear ALL cached queries — no stale data for next user
      queryClient.clear();
      // 3. Redirect to login
      router.replace("/login");
    };

    window.addEventListener("vaultox:auth:expired", handleAuthExpired);
    return () => {
      window.removeEventListener("vaultox:auth:expired", handleAuthExpired);
    };
  }, [disconnect, queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
