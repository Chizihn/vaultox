import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";
import type { ReportFramework, Report } from "../../types";

export const useReports = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);

  const reportsQuery = useQuery({
    queryKey: ["reports", walletAddress],
    queryFn: async () => {
      const response = await api.get("/reports");
      return response.data as Report[];
    },
    enabled: !!walletAddress,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: {
      framework: ReportFramework;
      startDate: string;
      endDate: string;
    }) => {
      const response = await api.post<Report>("/reports/generate", {
        framework: data.framework,
        period: { from: data.startDate, to: data.endDate },
      });
      // Normalise backend `period` → `dateRange` to match the shared Report type
      const raw = response.data as Report & {
        period?: { from: string; to: string };
      };
      return {
        ...raw,
        dateRange: raw.dateRange ?? {
          start: raw.period?.from ?? data.startDate,
          end: raw.period?.to ?? data.endDate,
        },
        fileName:
          raw.fileName ??
          `${data.framework}_${data.startDate}_${data.endDate}.pdf`,
      } as Report;
    },
    onSuccess: (newReport) => {
      queryClient.setQueryData(
        ["reports", walletAddress],
        (old: Report[] | undefined) => {
          return [newReport, ...(old || [])];
        },
      );
    },
  });

  return {
    reports: reportsQuery.data,
    isLoading: reportsQuery.isLoading,
    generateReport: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
  };
};
