export type KytTransferContext = {
  fromWallet: string;
  toWallet: string;
  amount: number;
  asset: string;
  corridor?: string;
};

export type KytAssessment = {
  status: "cleared" | "review" | "blocked";
  riskScore: number;
  provider: string;
  reason?: string;
  flags: Array<{
    code: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }>;
};
