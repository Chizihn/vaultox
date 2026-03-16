"use client";

import { useEffect } from "react";
import type { CredentialStatus, ComplianceTier } from "@/types";
import { useAuthStore } from "@/store";
import { getAccessToken, getCredentialStatus } from "@/utils/session";

interface JwtPayload {
  sub?: string;
  tier?: number | null;
  credentialStatus?: string;
  exp?: number;
}

function normalizeStatus(value: unknown): CredentialStatus {
  if (value === "verified" || value === "pending_kyc") {
    return value;
  }
  return "unregistered";
}

function normalizeTier(value: unknown): ComplianceTier | null {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  return null;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function AuthStoreHydrator() {
  const { connect, disconnect, setTier } = useAuthStore();

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      disconnect();
      return;
    }

    const payload = decodeJwtPayload(token);
    const cookieStatus = getCredentialStatus();
    const status = normalizeStatus(
      cookieStatus ?? payload?.credentialStatus ?? "unregistered",
    );
    const walletAddress = typeof payload?.sub === "string" ? payload.sub : null;
    const tier = normalizeTier(payload?.tier);

    connect(status, null, token, walletAddress);
    if (tier) {
      setTier(tier);
    }
  }, [connect, disconnect, setTier]);

  return null;
}
