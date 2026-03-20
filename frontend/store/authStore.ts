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

const initialAuthState = {
  isConnected: false,
  institution: null,
  walletAddress: null,
  tier: null,
  credentialStatus: "unregistered" as CredentialStatus,
  jwt: null,
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
    ...initialAuthState,
  };
}

export interface AuthState {
  isConnected: boolean;
  institution: Institution | null;
  walletAddress: string | null;
  tier: ComplianceTier | null;
  credentialStatus: CredentialStatus;
  jwt: string | null;
  connect: (
    status: CredentialStatus,
    institution?: Institution | null,
    jwt?: string | null,
    walletAddress?: string | null,
  ) => void;
  disconnect: () => void;
  setTier: (tier: ComplianceTier) => void;
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
          return getResetAuthState();
        }),

      setTier: (tier) => set({ tier }),
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
    },
  ),
);

export function resetAuthState() {
  useAuthStore.getState().disconnect();
}
