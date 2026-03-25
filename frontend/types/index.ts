// ─── VaultOX Type Definitions ───────────────────────────────────────────────

export type ComplianceTier = 1 | 2 | 3;

export interface Institution {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionFlag: string;
  tier: ComplianceTier;
  city: string;
  walletAddress: string;
  status?: "verified" | "pending" | "revoked";
}

export interface ComplianceCredential {
  institutionWallet: string;
  tier: ComplianceTier;
  jurisdiction: string;
  jurisdictionFlag: string;
  issuedAt: string;
  expiresAt: string;
  kycProvider: string;
  kycProviderVerifiedAt: string;
  attestationHash: string;
  isActive: boolean;
  credentialAddress: string;
  permissions: Permission[];
  complianceScores: ComplianceScores;
}

export interface Permission {
  label: string;
  value: string;
  enabled: boolean;
}

export interface ComplianceScores {
  kycDepth: number;
  amlCoverage: number;
  jurisdictionReach: number;
  reportingQuality: number;
  transactionLimits: number;
}

export type RiskRating = "Low" | "Medium" | "High";

export interface VaultStrategy {
  id: string;
  name: string;
  description: string;
  apy: number;
  tvl: number;
  riskRating: RiskRating;
  minTier: ComplianceTier;
  jurisdictions: string[];
  maturity: string;
  allocation?: StrategyAllocation[];
  sparklineData: number[];
  category: "tbill" | "private_credit" | "commodity" | "rwa";
}

export interface StrategyAllocation {
  label: string;
  percentage: number;
  color: string;
}

export interface VaultPosition {
  id: string;
  strategyId: string;
  strategyName: string;
  depositedAmount: number;
  currentValue: number;
  accruedYield: number;
  apy: number;
  depositedAt: string;
  shares: number;
}

export type SettlementStatus = "pending" | "settling" | "completed" | "failed";

export interface Settlement {
  id: string;
  fromInstitution: Institution;
  toInstitution: Institution;
  amount: number;
  currency: string;
  status: SettlementStatus;
  initiatedAt: string;
  completedAt?: string;
  txHash: string;
  fxRate?: number;
  settlementTime?: number; // in seconds
  corridor: string;
}

export interface SettlementStep {
  label: string;
  status: "pending" | "processing" | "completed";
}

export type AuditEventType =
  | "deposit"
  | "withdrawal"
  | "settlement"
  | "credential_update"
  | "report_generated";

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  amount?: number;
  txHash: string;
  jurisdiction: string;
  status: "success" | "failed";
  description: string;
}

export type ReportFramework = "FINMA" | "MiCA" | "MAS" | "Custom";

export interface Report {
  id: string;
  framework: ReportFramework;
  dateRange: { start: string; end: string };
  generatedAt: string;
  status: "ready" | "generating" | "failed";
  downloadUrl?: string;
  fileName: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "settlement" | "compliance" | "vault" | "system";
}

export interface CityNode {
  name: string;
  lat: number;
  lng: number;
  x: number; // SVG x coordinate
  y: number; // SVG y coordinate
}

export interface SettlementArc {
  from: CityNode;
  to: CityNode;
  amount: number;
  status: SettlementStatus;
}

// ─── Credential Status ──────────────────────────────────────────────────────
// Derived from on-chain ComplianceCredential lookup.
// verified    → fully onboarded institution, access granted
// pending_kyc → application submitted, awaiting regulator review
// unregistered → wallet not yet registered with VaultOX

export type CredentialStatus = "verified" | "pending_kyc" | "unregistered";

// ─── App Settings ────────────────────────────────────────────────────────────

export interface AppSettings {
  notifications: {
    settlements: boolean;
    compliance: boolean;
    vault: boolean;
    system: boolean;
  };
  displayCurrency: "USD" | "EUR" | "CHF";
  timezone: string;
  twoFactorEnabled: boolean;
}

// ─── Navigation ─────────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href: string;
  icon?: string;
}
