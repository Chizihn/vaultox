import { useMutation } from "@tanstack/react-query";
import api from "../../services/api";
import { resetAuthState, useAuthStore } from "../../store";
import type { Institution } from "@/types";
import { setAccessToken, setCredentialStatus } from "@/utils/session";

interface AuthResponse {
  accessToken: string;
  credentialStatus: "verified" | "pending_kyc" | "unregistered";
  institution?: Institution | null;
}

export const useAuth = () => {
  const { connect } = useAuthStore();

  const getChallengeMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const response = await api.post("/auth/challenge", { walletAddress });
      return response.data; // { nonce, expiresAt }
    },
  });

  const verifySignatureMutation = useMutation({
    mutationFn: async (data: {
      walletAddress: string;
      signature: string;
      nonce: string;
    }) => {
      const response = await api.post<AuthResponse>("/auth/verify", data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      setAccessToken(data.accessToken);
      setCredentialStatus(data.credentialStatus);
      connect(
        data.credentialStatus,
        data.institution,
        data.accessToken,
        variables.walletAddress,
      );
    },
  });

  return {
    getChallenge: getChallengeMutation.mutateAsync,
    isGettingChallenge: getChallengeMutation.isPending,
    verifySignature: verifySignatureMutation.mutateAsync,
    isVerifying: verifySignatureMutation.isPending,
    logout: () => {
      resetAuthState();
    },
  };
};
