import { create } from "zustand";
import type { Institution, ComplianceTier, CredentialStatus } from "@/types";
import { clearAuthSession } from "@/utils/session";

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

export const useAuthStore = create<AuthState>((set) => ({
  isConnected: false,
  institution: null,
  walletAddress: null,
  tier: null,
  credentialStatus: "unregistered",
  jwt: null,

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
        isConnected: false,
        institution: null,
        walletAddress: null,
        tier: null,
        credentialStatus: "unregistered",
        jwt: null,
      };
    }),

  setTier: (tier) => set({ tier }),
}));
