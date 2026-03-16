/**
 * hooks/api/useSettings.ts
 * ─────────────────────────
 * TanStack Query hooks for institution settings, API keys, connected wallets.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import * as settingsService from "@/services/settings";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.current(),
    queryFn: settingsService.getSettings,
    staleTime: 5 * 60_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.settings.notifications(),
    queryFn: settingsService.getNotificationPreferences,
    staleTime: 5 * 60_000,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.settings.apiKeys(),
    queryFn: settingsService.getApiKeys,
    staleTime: 2 * 60_000,
  });
}

export function useConnectedWallets() {
  return useQuery({
    queryKey: queryKeys.settings.wallets(),
    queryFn: settingsService.getConnectedWallets,
    staleTime: 2 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateSettings,
    // Optimistic update — show changes immediately, server confirms
    onMutate: async (newSettings) => {
      await qc.cancelQueries({ queryKey: queryKeys.settings.current() });
      const previous = qc.getQueryData(queryKeys.settings.current());
      qc.setQueryData(queryKeys.settings.current(), (old: unknown) => ({
        ...(old as object),
        ...newSettings,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(queryKeys.settings.current(), context.previous);
      }
      toast.error("Failed to save settings");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.current() });
      toast.success("Settings saved");
    },
  });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateNotificationPreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.notifications() });
      toast.success("Notification preferences updated");
    },
    onError: () => {
      toast.error("Failed to update notification preferences");
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => settingsService.createApiKey(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.apiKeys() });
      // Note: consumer should store the returned `secret` — shown only once
    },
    onError: () => {
      toast.error("Failed to create API key");
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsService.revokeApiKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.apiKeys() });
      toast.success("API key revoked");
    },
    onError: () => {
      toast.error("Failed to revoke API key");
    },
  });
}

export function useLinkWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ wallet, label }: { wallet: string; label: string }) =>
      settingsService.linkWallet(wallet, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.wallets() });
      toast.success("Wallet linked");
    },
    onError: () => {
      toast.error("Failed to link wallet");
    },
  });
}

export function useUnlinkWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wallet: string) => settingsService.unlinkWallet(wallet),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.wallets() });
      toast.success("Wallet unlinked");
    },
    onError: () => {
      toast.error("Failed to unlink wallet");
    },
  });
}

export function useUpdateRiskLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateRiskLimits,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.current() });
      toast.success("Risk limits updated");
    },
    onError: () => {
      toast.error("Failed to update risk limits");
    },
  });
}
