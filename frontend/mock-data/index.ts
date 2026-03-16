import type {
  Institution,
  ComplianceCredential,
  VaultStrategy,
  VaultPosition,
  Settlement,
  AuditEvent,
  Report,
  NotificationItem,
  SettlementArc,
  AppSettings,
} from "@/types";
import { CITY_NODES } from "@/utils/constants";

// ─── Institutions ───────────────────────────────────────────────────────────

export const MOCK_CURRENT_INSTITUTION: Institution = {
  id: "inst-001",
  name: "AMINA Bank AG",
  jurisdiction: "Switzerland",
  jurisdictionFlag: "🇨🇭",
  tier: 1,
  city: "Zurich",
  walletAddress: "BKx3mYz7Rp4TvWnJ8sQf2LcDhN6gAb9mWq",
};

export const MOCK_INSTITUTIONS: Institution[] = [
  MOCK_CURRENT_INSTITUTION,
  {
    id: "inst-002",
    name: "DBS Institutional",
    jurisdiction: "Singapore",
    jurisdictionFlag: "🇸🇬",
    tier: 1,
    city: "Singapore",
    walletAddress: "7Kx2nPz8Wp5RuXmL9tSg3McEiO7hBd4kNr",
  },
  {
    id: "inst-003",
    name: "Deutsche Digital Assets",
    jurisdiction: "Germany",
    jurisdictionFlag: "🇩🇪",
    tier: 2,
    city: "Frankfurt",
    walletAddress: "4Jw9mNy6Tp3QsVkH8rUf5LbDgA2iCe7jXp",
  },
  {
    id: "inst-004",
    name: "Emirates NBD Digital",
    jurisdiction: "UAE",
    jurisdictionFlag: "🇦🇪",
    tier: 2,
    city: "Dubai",
    walletAddress: "9Fx5lKw3Sn8PtYhG7qRe4MaDfC1jBg6iWo",
  },
  {
    id: "inst-005",
    name: "JPM Onyx Settlement",
    jurisdiction: "United States",
    jurisdictionFlag: "🇺🇸",
    tier: 1,
    city: "New York",
    walletAddress: "2Hw6oLx4Um9QvZiJ8sTg5NbEhD3kCf7lYq",
  },
  {
    id: "inst-006",
    name: "Nomura Digital",
    jurisdiction: "Japan",
    jurisdictionFlag: "🇯🇵",
    tier: 2,
    city: "Tokyo",
    walletAddress: "5Gw3nMv7Ro2PuXkH6sQd4LcFiB8jAe9mTp",
  },
];

// ─── Compliance Credential ──────────────────────────────────────────────────

export const MOCK_CREDENTIAL: ComplianceCredential = {
  institutionWallet: MOCK_CURRENT_INSTITUTION.walletAddress,
  tier: 1,
  jurisdiction: "Switzerland",
  jurisdictionFlag: "🇨🇭",
  issuedAt: "2026-01-15T00:00:00Z",
  expiresAt: "2027-01-15T00:00:00Z",
  kycProvider: "Fireblocks Compliance",
  kycProviderVerifiedAt: "2026-01-14T10:30:00Z",
  attestationHash: "Cx3mYz7Rp4TvWnJ8sQf2LcDhN6gAb9wKp",
  isActive: true,
  credentialAddress: "Cx3mYz7Rp4TvWnJ8sQf2LcDhN6gAb9wKp",
  permissions: [
    { label: "USDC Transfers", value: "Unlimited", enabled: true },
    { label: "Cross-Border Settlements", value: "Enabled", enabled: true },
    { label: "RWA Vault Access", value: "Tier 1 Full", enabled: true },
    { label: "Confidential Transfers", value: "Enabled", enabled: true },
    { label: "Jurisdictions", value: "CH, EU, SG, AE", enabled: true },
  ],
  complianceScores: {
    kycDepth: 96,
    amlCoverage: 94,
    jurisdictionReach: 88,
    reportingQuality: 98,
    transactionLimits: 92,
  },
};

// ─── Vault Strategies ───────────────────────────────────────────────────────

export const MOCK_STRATEGIES: VaultStrategy[] = [
  {
    id: "strat-001",
    name: "T-Bill Vault",
    description:
      "US Treasury-backed short-duration yield strategy. Lowest risk profile with consistent returns backed by US government securities.",
    apy: 5.2,
    tvl: 82_400_000,
    riskRating: "Low",
    minTier: 3,
    jurisdictions: ["🇨🇭", "🇸🇬", "🇩🇪", "🇦🇪", "🇺🇸", "🇯🇵"],
    maturity: "Rolling 7d",
    allocation: [
      { label: "3M T-Bills", percentage: 45, color: "#4FC3C3" },
      { label: "6M T-Bills", percentage: 35, color: "#C9A84C" },
      { label: "1Y T-Notes", percentage: 20, color: "#3DDC84" },
    ],
    sparklineData: [4.8, 5.0, 5.1, 5.0, 5.2, 5.1, 5.2],
    category: "tbill",
  },
  {
    id: "strat-002",
    name: "Private Credit RWA",
    description:
      "Tokenized private credit positions sourced from institutional-grade originators. Medium risk with enhanced yield from real-world asset collateral.",
    apy: 7.8,
    tvl: 45_200_000,
    riskRating: "Medium",
    minTier: 2,
    jurisdictions: ["🇨🇭", "🇸🇬", "🇩🇪"],
    maturity: "Rolling 30d",
    allocation: [
      { label: "Senior Debt", percentage: 60, color: "#4FC3C3" },
      { label: "Mezzanine", percentage: 30, color: "#C9A84C" },
      { label: "Equity Tranche", percentage: 10, color: "#FF5A5A" },
    ],
    sparklineData: [7.2, 7.5, 7.6, 7.9, 7.8, 7.7, 7.8],
    category: "private_credit",
  },
  {
    id: "strat-003",
    name: "Commodity-Backed Vault",
    description:
      "Institutional LP positions backed by tokenized commodities and commodity futures. Highest yield tier requiring full Tier 1 compliance clearance.",
    apy: 11.4,
    tvl: 28_900_000,
    riskRating: "High",
    minTier: 1,
    jurisdictions: ["🇨🇭", "🇸🇬"],
    maturity: "Rolling 90d",
    allocation: [
      { label: "Gold-Backed", percentage: 40, color: "#C9A84C" },
      { label: "Oil Futures", percentage: 35, color: "#4FC3C3" },
      { label: "Institutional LP", percentage: 25, color: "#3DDC84" },
    ],
    sparklineData: [10.8, 11.0, 11.2, 11.1, 11.5, 11.3, 11.4],
    category: "commodity",
  },
];

// ─── Vault Positions ────────────────────────────────────────────────────────

export const MOCK_POSITIONS: VaultPosition[] = [
  {
    id: "pos-001",
    strategyId: "strat-001",
    strategyName: "T-Bill Vault",
    depositedAmount: 50_000_000,
    currentValue: 51_240_000,
    accruedYield: 1_240_000,
    apy: 5.2,
    depositedAt: "2025-11-01T00:00:00Z",
    shares: 50_000_000,
  },
  {
    id: "pos-002",
    strategyId: "strat-002",
    strategyName: "Private Credit RWA",
    depositedAmount: 25_000_000,
    currentValue: 26_082_000,
    accruedYield: 1_082_000,
    apy: 7.8,
    depositedAt: "2025-12-15T00:00:00Z",
    shares: 25_000_000,
  },
  {
    id: "pos-003",
    strategyId: "strat-003",
    strategyName: "Commodity-Backed Vault",
    depositedAmount: 15_000_000,
    currentValue: 16_260_300,
    accruedYield: 1_260_300,
    apy: 11.4,
    depositedAt: "2026-01-10T00:00:00Z",
    shares: 15_000_000,
  },
];

// ─── Settlements ────────────────────────────────────────────────────────────

export const MOCK_SETTLEMENTS: Settlement[] = [
  {
    id: "stl-001",
    fromInstitution: MOCK_INSTITUTIONS[0],
    toInstitution: MOCK_INSTITUTIONS[1],
    amount: 500_000,
    currency: "USDC",
    status: "completed",
    initiatedAt: "2026-03-10T14:22:00Z",
    completedAt: "2026-03-10T14:22:02Z",
    txHash: "5Gw3nMv7Ro2PuXkH6sQd4LcFiB8jAe9mTpYzWnJ8sQf",
    fxRate: 0.9201,
    settlementTime: 1.8,
    corridor: "CH → SG",
  },
  {
    id: "stl-002",
    fromInstitution: MOCK_INSTITUTIONS[4],
    toInstitution: MOCK_INSTITUTIONS[0],
    amount: 1_200_000,
    currency: "USDC",
    status: "completed",
    initiatedAt: "2026-03-10T12:05:00Z",
    completedAt: "2026-03-10T12:05:02Z",
    txHash: "7Kx2nPz8Wp5RuXmL9tSg3McEiO7hBd4kNrYzWnJ8sQf",
    fxRate: 1.0,
    settlementTime: 2.1,
    corridor: "US → CH",
  },
  {
    id: "stl-003",
    fromInstitution: MOCK_INSTITUTIONS[0],
    toInstitution: MOCK_INSTITUTIONS[3],
    amount: 750_000,
    currency: "USDC",
    status: "pending",
    initiatedAt: "2026-03-10T16:45:00Z",
    txHash: "4Jw9mNy6Tp3QsVkH8rUf5LbDgA2iCe7jXpYzWnJ8sQf",
    corridor: "CH → AE",
  },
  {
    id: "stl-004",
    fromInstitution: MOCK_INSTITUTIONS[1],
    toInstitution: MOCK_INSTITUTIONS[5],
    amount: 2_000_000,
    currency: "USDC",
    status: "settling",
    initiatedAt: "2026-03-10T17:10:00Z",
    txHash: "9Fx5lKw3Sn8PtYhG7qRe4MaDfC1jBg6iWoYzWnJ8sQf",
    fxRate: 0.0067,
    corridor: "SG → JP",
  },
  {
    id: "stl-005",
    fromInstitution: MOCK_INSTITUTIONS[2],
    toInstitution: MOCK_INSTITUTIONS[0],
    amount: 300_000,
    currency: "USDC",
    status: "failed",
    initiatedAt: "2026-03-09T09:30:00Z",
    txHash: "2Hw6oLx4Um9QvZiJ8sTg5NbEhD3kCf7lYqYzWnJ8sQf",
    corridor: "DE → CH",
  },
];

// ─── Settlement Arcs for World Map ──────────────────────────────────────────

const c = (name: string) => CITY_NODES.find((n) => n.name === name)!;

export const MOCK_SETTLEMENT_ARCS: SettlementArc[] = [
  {
    from: c("Zurich"),
    to: c("Singapore"),
    amount: 500_000,
    status: "settling",
  },
  {
    from: c("New York"),
    to: c("Zurich"),
    amount: 1_200_000,
    status: "completed",
  },
  { from: c("Zurich"), to: c("Dubai"), amount: 750_000, status: "pending" },
  {
    from: c("Singapore"),
    to: c("Tokyo"),
    amount: 2_000_000,
    status: "completed",
  },
  {
    from: c("London"),
    to: c("Hong Kong"),
    amount: 450_000,
    status: "completed",
  },
];

// ─── Audit Events ───────────────────────────────────────────────────────────

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    timestamp: "2026-03-10T17:10:00Z",
    eventType: "settlement",
    amount: 500_000,
    txHash: "5Gw3...mTp",
    jurisdiction: "CH → SG",
    status: "success",
    description: "Cross-border settlement AMINA → DBS",
  },
  {
    id: "evt-002",
    timestamp: "2026-03-10T14:22:00Z",
    eventType: "deposit",
    amount: 2_000_000,
    txHash: "7Kx2...kNr",
    jurisdiction: "CH",
    status: "success",
    description: "Deposit to T-Bill Vault",
  },
  {
    id: "evt-003",
    timestamp: "2026-03-10T11:00:00Z",
    eventType: "withdrawal",
    amount: 500_000,
    txHash: "4Jw9...jXp",
    jurisdiction: "CH",
    status: "success",
    description: "Withdrawal from Private Credit RWA",
  },
  {
    id: "evt-004",
    timestamp: "2026-03-09T16:30:00Z",
    eventType: "credential_update",
    txHash: "9Fx5...iWo",
    jurisdiction: "CH",
    status: "success",
    description: "Tier upgrade: Tier 2 → Tier 1",
  },
  {
    id: "evt-005",
    timestamp: "2026-03-09T09:30:00Z",
    eventType: "settlement",
    amount: 300_000,
    txHash: "2Hw6...lYq",
    jurisdiction: "DE → CH",
    status: "failed",
    description: "Settlement from Deutsche Digital — credential expired",
  },
  {
    id: "evt-006",
    timestamp: "2026-03-08T14:15:00Z",
    eventType: "report_generated",
    txHash: "N/A",
    jurisdiction: "CH",
    status: "success",
    description: "FINMA Q1 2026 compliance report generated",
  },
  {
    id: "evt-007",
    timestamp: "2026-03-07T10:00:00Z",
    eventType: "deposit",
    amount: 5_000_000,
    txHash: "3Ix8...pRn",
    jurisdiction: "CH",
    status: "success",
    description: "Deposit to Commodity-Backed Vault",
  },
  {
    id: "evt-008",
    timestamp: "2026-03-06T08:45:00Z",
    eventType: "settlement",
    amount: 1_500_000,
    txHash: "6Hy1...tLm",
    jurisdiction: "US → CH",
    status: "success",
    description: "Cross-border settlement JPM Onyx → AMINA",
  },
];

// ─── Reports ────────────────────────────────────────────────────────────────

export const MOCK_REPORTS: Report[] = [
  {
    id: "rpt-001",
    framework: "FINMA",
    dateRange: { start: "2026-01-01", end: "2026-03-10" },
    generatedAt: "2026-03-10T15:00:00Z",
    status: "ready",
    downloadUrl: "#",
    fileName: "FINMA_Q1_2026_AMINA.pdf",
  },
  {
    id: "rpt-002",
    framework: "MiCA",
    dateRange: { start: "2026-01-01", end: "2026-02-28" },
    generatedAt: "2026-03-01T10:00:00Z",
    status: "ready",
    downloadUrl: "#",
    fileName: "MiCA_Feb2026_AMINA.pdf",
  },
  {
    id: "rpt-003",
    framework: "MAS",
    dateRange: { start: "2025-10-01", end: "2025-12-31" },
    generatedAt: "2026-01-05T09:00:00Z",
    status: "ready",
    downloadUrl: "#",
    fileName: "MAS_Q4_2025_AMINA.pdf",
  },
];

// ─── Notifications ──────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-001",
    title: "Settlement Complete",
    message: "$500,000 USDC settled to DBS Singapore in 1.8s",
    timestamp: "2026-03-10T14:22:02Z",
    read: false,
    type: "settlement",
  },
  {
    id: "notif-002",
    title: "Yield Accrued",
    message: "$14,293.44 yield accrued across all vaults today",
    timestamp: "2026-03-10T00:00:00Z",
    read: false,
    type: "vault",
  },
  {
    id: "notif-003",
    title: "Compliance Renewed",
    message: "Your Tier 1 credential has been renewed for 12 months",
    timestamp: "2026-01-15T00:00:00Z",
    read: true,
    type: "compliance",
  },
];

// ─── Dashboard Summary ──────────────────────────────────────────────────────

export const MOCK_DASHBOARD_METRICS = {
  totalAUM: 124_582_300,
  aumDelta: 2.3,
  yieldToday: 14_293.44,
  activeSettlements: 3,
  pendingSettlements: 2,
  complianceScore: 98,
};

// ─── App Settings ────────────────────────────────────────────────────────────

export const MOCK_APP_SETTINGS: AppSettings = {
  notifications: {
    settlements: true,
    compliance: true,
    vault: true,
    system: false,
  },
  displayCurrency: "USD",
  timezone: "Europe/Zurich (UTC+1)",
  twoFactorEnabled: true,
};
