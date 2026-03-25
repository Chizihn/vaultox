import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Institution, ComplianceTier, CredentialStatus } from "@/types";
import { clearAuthSession } from "@/utils/session";

const AUTH_STORE_KEY = "vaultos-auth-store";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export type AuthBootstrapPhase = "idle" | "loading" | "ready";

const initialAuthState = {
  isConnected: false,
  institution: null,
  walletAddress: null,
  tier: null,
  credentialStatus: "unregistered" as CredentialStatus,
  jwt: null,
  /** Not persisted: token/credential bootstrap for global loader + API sync */
  authBootstrap: "idle" as AuthBootstrapPhase,
};

type PersistedAuthSlice = Pick<
  AuthState,
  | "isConnected"
  | "institution"
  | "walletAddress"
  | "tier"
  | "credentialStatus"
  | "jwt"
>;

function getResetAuthState(): PersistedAuthSlice {
  return {
    isConnected: false,
    institution: null,
    walletAddress: null,
    tier: null,
    credentialStatus: "unregistered",
    jwt: null,
  };
}

export interface AuthState {
  isConnected: boolean;
  institution: Institution | null;
  walletAddress: string | null;
  tier: ComplianceTier | null;
  credentialStatus: CredentialStatus;
  jwt: string | null;
  authBootstrap: AuthBootstrapPhase;
  connect: (
    status: CredentialStatus,
    institution?: Institution | null,
    jwt?: string | null,
    walletAddress?: string | null,
  ) => void;
  disconnect: () => void;
  setTier: (tier: ComplianceTier) => void;
  setWalletAddress: (walletAddress: string | null) => void;
  setAuthBootstrap: (phase: AuthBootstrapPhase) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialAuthState,

      connect: (status, institution, jwt, walletAddress) =>
        set({
          isConnected: true,
          credentialStatus: status,
          institution: institution ?? null,
          walletAddress: institution?.walletAddress ?? walletAddress ?? null,
          tier: institution?.tier ?? null,
          jwt: jwt ?? null,
        }),

      disconnect: () =>
        set(() => {
          clearAuthSession();
          return {
            ...getResetAuthState(),
            authBootstrap: "ready" as AuthBootstrapPhase,
          };
        }),

      setTier: (tier) => set({ tier }),
      setWalletAddress: (walletAddress) => set({ walletAddress }),

      setAuthBootstrap: (phase) => set({ authBootstrap: phase }),
    }),
    {
      name: AUTH_STORE_KEY,
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<PersistedAuthSlice> | null;
        return {
          ...initialAuthState,
          ...(state ?? {}),
        };
      },
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage,
      ),
      partialize: (state) => ({
        isConnected: state.isConnected,
        institution: state.institution,
        walletAddress: state.walletAddress,
        tier: state.tier,
        credentialStatus: state.credentialStatus,
        jwt: state.jwt,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        authBootstrap: current.authBootstrap,
      }),
    },
  ),
);

export function resetAuthState() {
  useAuthStore.getState().disconnect();
}
