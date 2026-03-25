import type { ComplianceTier, CredentialStatus } from "@/types";

export interface JwtPayload {
  sub?: string;
  tier?: number | null;
  credentialStatus?: string;
  exp?: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
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

export function isJwtExpired(token: string, skewMs = 10_000): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now() + skewMs;
}

export function normalizeCredentialStatus(value: unknown): CredentialStatus {
  if (value === "verified" || value === "pending_kyc") {
    return value;
  }
  return "unregistered";
}

export function normalizeTier(value: unknown): ComplianceTier | null {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  return null;
}
