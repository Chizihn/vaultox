/**
 * hooks/api/queryKeys.ts
 * ──────────────────────
 * Centralised query key factory for TanStack Query.
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.vaults.positions() })
 *   useQuery({ queryKey: queryKeys.settlements.detail(id), ... })
 */

export const queryKeys = {
  // ── Compliance ────────────────────────────────────────────────────────────
  compliance: {
    all: ["compliance"] as const,
    credential: () => ["compliance", "credential"] as const,
    credentialByWallet: (wallet: string) =>
      ["compliance", "credential", wallet] as const,
    amlScreening: () => ["compliance", "aml"] as const,
    auditLog: (filters?: Record<string, unknown>) =>
      ["compliance", "audit-log", filters] as const,
    counterparties: () => ["compliance", "counterparties"] as const,
  },

  // ── Vaults ────────────────────────────────────────────────────────────────
  vaults: {
    all: ["vaults"] as const,
    strategies: () => ["vaults", "strategies"] as const,
    strategy: (id: string) => ["vaults", "strategies", id] as const,
    positions: () => ["vaults", "positions"] as const,
    position: (id: string) => ["vaults", "positions", id] as const,
    portfolio: () => ["vaults", "portfolio"] as const,
    allocation: () => ["vaults", "allocation"] as const,
    yieldHistory: (params?: Record<string, unknown>) =>
      ["vaults", "yield-history", params] as const,
  },

  // ── Settlements ───────────────────────────────────────────────────────────
  settlements: {
    all: ["settlements"] as const,
    list: (params?: Record<string, unknown>) =>
      ["settlements", "list", params] as const,
    detail: (id: string) => ["settlements", id] as const,
    metrics: () => ["settlements", "metrics"] as const,
    travelRule: (id: string) => ["settlements", "travel-rule", id] as const,
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  reports: {
    all: ["reports"] as const,
    list: (params?: Record<string, unknown>) =>
      ["reports", "list", params] as const,
    complianceSummary: () => ["reports", "compliance-summary"] as const,
    auditTrail: (params?: Record<string, unknown>) =>
      ["reports", "audit-trail", params] as const,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    all: ["settings"] as const,
    current: () => ["settings", "current"] as const,
    notifications: () => ["settings", "notifications"] as const,
    apiKeys: () => ["settings", "api-keys"] as const,
    wallets: () => ["settings", "wallets"] as const,
  },
} as const;
