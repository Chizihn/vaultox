import type { NavLink, CityNode } from '@/types';

// ─── Navigation ─────────────────────────────────────────────────────────────

export const NAV_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Vaults', href: '/vaults' },
  { label: 'Settlements', href: '/settlements' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Reports', href: '/reports' },
];

// ─── Compliance Tiers ───────────────────────────────────────────────────────

export const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 Bank',
  2: 'Regulated Fintech',
  3: 'Asset Manager',
};

export const TIER_BADGES: Record<number, string> = {
  1: 'TIER 1 — MiCA COMPLIANT',
  2: 'TIER 2 — REGULATED FINTECH',
  3: 'TIER 3 — ASSET MANAGER',
};

// ─── Report Frameworks ──────────────────────────────────────────────────────

export const REPORT_FRAMEWORKS = [
  { value: 'FINMA', label: 'FINMA (Switzerland)', flag: '🇨🇭' },
  { value: 'MiCA', label: 'MiCA (EU)', flag: '🇪🇺' },
  { value: 'MAS', label: 'MAS (Singapore)', flag: '🇸🇬' },
  { value: 'Custom', label: 'Custom', flag: '📋' },
] as const;

// ─── World Map Cities ───────────────────────────────────────────────────────

export const CITY_NODES: CityNode[] = [
  { name: 'Zurich', lat: 47.37, lng: 8.54, x: 510, y: 145 },
  { name: 'Singapore', lat: 1.35, lng: 103.82, x: 735, y: 290 },
  { name: 'Dubai', lat: 25.2, lng: 55.27, x: 625, y: 235 },
  { name: 'New York', lat: 40.71, lng: -74.01, x: 260, y: 175 },
  { name: 'Frankfurt', lat: 50.11, lng: 8.68, x: 508, y: 140 },
  { name: 'Hong Kong', lat: 22.32, lng: 114.17, x: 760, y: 240 },
  { name: 'London', lat: 51.51, lng: -0.13, x: 488, y: 135 },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, x: 820, y: 190 },
];

// ─── API URLs (commented out for now, using mock data) ──────────────────────

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
