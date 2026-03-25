"use client";

import { useEffect } from "react";
import type { ComplianceTier } from "@/types";
import { useAuthStore } from "@/store";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, getCredentialStatus } from "@/utils/session";
import {
  decodeJwtPayload,
  isJwtExpired,
  normalizeCredentialStatus,
  normalizeTier,
} from "@/utils/authSession";
import api from "@/services/api";

/** Map jurisdiction name/code → primary city for display. */
const JURISDICTION_CITY: Record<string, string> = {
  CH: "Zurich", Switzerland: "Zurich",
  SG: "Singapore", Singapore: "Singapore",
  US: "New York", "United States": "New York", USA: "New York",
  DE: "Frankfurt", Germany: "Frankfurt",
  GB: "London", "United Kingdom": "London", UK: "London",
  AE: "Dubai", UAE: "Dubai", "United Arab Emirates": "Dubai",
  JP: "Tokyo", Japan: "Tokyo", JAPA: "Tokyo",
  HK: "Hong Kong", "Hong Kong": "Hong Kong",
  FR: "Paris", France: "Paris", FRAN: "Paris",
  NG: "Lagos", Nigeria: "Lagos", NIGER: "Lagos", NIGE: "Lagos",
  KE: "Nairobi", Kenya: "Nairobi",
  BR: "São Paulo", Brazil: "São Paulo",
  IN: "Mumbai", India: "Mumbai",
  CN: "Shanghai", China: "Shanghai",
  AU: "Sydney", Australia: "Sydney",
  CA: "Toronto", Canada: "Toronto",
};

function getCityForJurisdiction(jurisdiction: string | undefined): string {
  if (!jurisdiction) return "N/A";
  return JURISDICTION_CITY[jurisdiction] ?? JURISDICTION_CITY[jurisdiction.toUpperCase()] ?? jurisdiction;
}

/**
 * Runs once after Zustand auth persist rehydrates:
 * - Validates access token (cookie) and JWT expiry
 * - Hydrates Zustand from JWT claims (no dedicated /me endpoint)
 * - For verified users, loads institution profile via GET /compliance/credential
 */
export function AuthBootstrap() {
  const connect = useAuthStore((s) => s.connect);
  const disconnect = useAuthStore((s) => s.disconnect);
  const setTier = useAuthStore((s) => s.setTier);
  const setAuthBootstrap = useAuthStore((s) => s.setAuthBootstrap);
  const isConnected = useAuthStore((s) => s.isConnected);
  const jwt = useAuthStore((s) => s.jwt);
  
  const router = useRouter();
  const pathname = usePathname();

  // Global Redirect Listener:
  // If we are on a protected route but the session is cleared, force redirect to /login.
  // This handles manual disconnects from the extension or session expiry.
  useEffect(() => {
    const protectedPrefixes = [
      "/dashboard",
      "/vaults",
      "/settlements",
      "/reports",
      "/compliance",
      // "/admin",
    ];
    const isProtected = protectedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    if (isProtected && !isConnected && !jwt) {
      router.replace("/login");
    }
  }, [isConnected, jwt, pathname, router]);

  useEffect(() => {
    let cancelled = false;
    let started = false;

    const bootstrap = async () => {
      if (started) return;
      started = true;

      setAuthBootstrap("loading");

      const token = getAccessToken().trim();

      if (!token) {
        disconnect();
        if (!cancelled) setAuthBootstrap("ready");
        return;
      }

      if (isJwtExpired(token)) {
        disconnect();
        if (!cancelled) setAuthBootstrap("ready");
        return;
      }

      const payload = decodeJwtPayload(token);
      if (!payload?.sub) {
        disconnect();
        if (!cancelled) setAuthBootstrap("ready");
        return;
      }

      const cookieStatus = getCredentialStatus();
      const status = normalizeCredentialStatus(
        cookieStatus ?? payload.credentialStatus ?? "unregistered",
      );
      const walletAddress =
        typeof payload.sub === "string" ? payload.sub : null;
      const tierFromJwt = normalizeTier(payload.tier);

      connect(status, null, token, walletAddress);
      if (tierFromJwt) {
        setTier(tierFromJwt);
      }

      if (status !== "verified") {
        if (!cancelled) setAuthBootstrap("ready");
        return;
      }

      try {
        const response = await api.get("/compliance/credential");
        if (cancelled) return;

        const credential = response.data as {
          institutionWallet: string;
          institutionName: string;
          tier: ComplianceTier;
          jurisdiction: string;
          jurisdictionFlag: string;
        };

        connect(
          "verified",
          {
            id: credential.institutionWallet,
            name: credential.institutionName,
            tier: credential.tier,
            jurisdiction: credential.jurisdiction,
            jurisdictionFlag: credential.jurisdictionFlag,
            city: getCityForJurisdiction(credential.jurisdiction),
            walletAddress: credential.institutionWallet,
          },
          token,
          walletAddress,
        );
      } catch {
        // 401 → api interceptor clears session; network errors → leave JWT state
      } finally {
        if (!cancelled) setAuthBootstrap("ready");
      }
    };

    const trigger = () => {
      void bootstrap();
    };

    const unsub = useAuthStore.persist.onFinishHydration(() => {
      trigger();
    });

    if (useAuthStore.persist.hasHydrated()) {
      trigger();
    }

    return () => {
      cancelled = true;
      unsub();
    };
  }, [connect, disconnect, setAuthBootstrap, setTier]);

  return null;
}
