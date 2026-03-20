import type { NavLink, CityNode } from "@/types";

// ─── Navigation ─────────────────────────────────────────────────────────────

export const NAV_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Settlements", href: "/settlements" },
  { label: "Vaults", href: "/vaults" },
  { label: "Compliance", href: "/compliance" },
  { label: "Reports", href: "/reports" },
  { label: "Guide", href: "/guide" },
  // { label: "Admin", href: "/admin" },
];

// ─── Compliance Tiers ───────────────────────────────────────────────────────

export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 Credential",
  2: "Tier 2 Credential",
  3: "Tier 3 Credential",
};

export const TIER_BADGES: Record<number, string> = {
  1: "TIER 1 — VERIFIED",
  2: "TIER 2 — VERIFIED",
  3: "TIER 3 — VERIFIED",
};

// ─── Report Frameworks ──────────────────────────────────────────────────────

export const REPORT_FRAMEWORKS = [
  { value: "FINMA", label: "FINMA (Switzerland)", flag: "🇨🇭" },
  { value: "MiCA", label: "MiCA (EU)", flag: "🇪🇺" },
  { value: "MAS", label: "MAS (Singapore)", flag: "🇸🇬" },
  { value: "Custom", label: "Custom", flag: "📋" },
] as const;

// ─── World Map Cities ───────────────────────────────────────────────────────

// ─── Countries ─────────────────────────────-------──────────────────────────

// ─── Roles -----------───────────────────────────────────────────────────────

// ─── API URL reference examples (unused) ─────────────────────────────────────

// export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// export const API_ENDPOINTS = {
//   auth: {
//     nonce: (wallet: string) => `${API_BASE_URL}/auth/nonce/${wallet}`,
//     verify: `${API_BASE_URL}/auth/verify-wallet`,
//     session: `${API_BASE_URL}/auth/session`,
//   },
//   vaults: {
//     list: `${API_BASE_URL}/vaults`,
//     deposit: `${API_BASE_URL}/vaults/deposit`,
//     withdraw: `${API_BASE_URL}/vaults/withdraw`,
//   },
//   compliance: {
//     credential: (wallet: string) => `${API_BASE_URL}/compliance/credential/${wallet}`,
//     verify: `${API_BASE_URL}/compliance/verify`,
//   },
//   settlements: {
//     initiate: `${API_BASE_URL}/settlements/initiate`,
//     get: (id: string) => `${API_BASE_URL}/settlements/${id}`,
//     history: `${API_BASE_URL}/settlements/history`,
//   },
//   reports: {
//     generate: `${API_BASE_URL}/reports/generate`,
//     history: `${API_BASE_URL}/reports/history`,
//     download: (id: string) => `${API_BASE_URL}/reports/${id}/download`,
//   },
// };
