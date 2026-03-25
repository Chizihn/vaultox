import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";

type ComplianceScores = {
  kycDepth: number;
  amlCoverage: number;
  jurisdictionReach: number;
  reportingQuality: number;
  transactionLimits: number;
};

function deriveComplianceScore(scores?: ComplianceScores): number {
  if (!scores) return 0;
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

export const useDashboard = () => {
  const walletAddress = useAuthStore((state) => state.walletAddress);

  const credentialQuery = useQuery({
    queryKey: ["dashboard-compliance-credential", walletAddress],
    queryFn: async () => {
      const response = await api.get("/compliance/credential");
      return response.data as { complianceScores?: ComplianceScores };
    },
    enabled: !!walletAddress,
  });

  const portfolioQuery = useQuery({
    queryKey: ["dashboard-portfolio", walletAddress],
    queryFn: async () => {
      const response = await api.get("/vaults/portfolio/summary");
      return response.data as {
        totalCurrentValue: number;
        totalAccruedYield: number;
        unrealizedGainPct: number;
      };
    },
    enabled: !!walletAddress,
  });

  const settlementsQuery = useQuery({
    queryKey: ["dashboard-settlements", walletAddress],
    queryFn: async () => {
      const response = await api.get("/settlements");
      const list: Array<{ status: string }> = response.data?.settlements ?? [];
      return {
        activeSettlements: list.filter((s) => s.status === "settling").length,
        pendingSettlements: list.filter((s) => s.status === "pending").length,
        totalSettlements: list.length,
      };
    },
    enabled: !!walletAddress,
  });

  const portfolio = portfolioQuery.data;
  const settlementCounts = settlementsQuery.data;
  const credential = credentialQuery.data;
  const complianceScore = deriveComplianceScore(credential?.complianceScores);

  const metrics =
    portfolio || settlementCounts
      ? {
          totalAUM: portfolio?.totalCurrentValue ?? 0,
          aumDelta: portfolio?.unrealizedGainPct ?? 0,
          yieldToday: portfolio?.totalAccruedYield ?? 0,
          activeSettlements: settlementCounts?.activeSettlements ?? 0,
          pendingSettlements: settlementCounts?.pendingSettlements ?? 0,
          totalSettlements: settlementCounts?.totalSettlements ?? 0,
          complianceScore,
        }
      : undefined;

  return {
    metrics,
    isLoading:
      portfolioQuery.isLoading ||
      settlementsQuery.isLoading ||
      credentialQuery.isLoading,
  };
};
