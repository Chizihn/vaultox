/**
 * services/auth.ts
 * ─────────────────
 * Authentication service — wallet-based nonce/signature flow.
 */

import api from "./api";
import type { CredentialStatus } from "@/types";
import {
  setAccessToken,
  setCredentialStatus,
  clearAuthSession,
} from "@/utils/session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChallengeResponse {
  nonce: string;
  expiresAt: string;
}

export interface VerifyResponse {
  accessToken: string;
  credentialStatus: CredentialStatus;
  institution?: {
    id: string;
    name: string;
    tier: 1 | 2 | 3;
    jurisdiction: string;
    jurisdictionFlag: string;
    city: string;
    walletAddress: string;
  };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Step 1 — Request a nonce for the given wallet to sign.
 */
export async function requestChallenge(
  walletAddress: string,
): Promise<ChallengeResponse> {
  const { data } = await api.post<ChallengeResponse>("/auth/challenge", {
    walletAddress,
  });
  return data;
}

/**
 * Step 2 — Submit the signed nonce; receive JWT + credentialStatus.
 */
export async function verifySignature(payload: {
  walletAddress: string;
  signature: string;
  nonce: string;
}): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>("/auth/verify", payload);

  if (typeof window !== "undefined") {
    setAccessToken(data.accessToken);
    setCredentialStatus(data.credentialStatus);
  }

  return data;
}

/**
 * Invalidate the server-side session and clear local tokens.
 */
export async function signOut(): Promise<void> {
  try {
    await api.delete("/auth/session");
  } finally {
    if (typeof window !== "undefined") {
      clearAuthSession();
    }
  }
}
