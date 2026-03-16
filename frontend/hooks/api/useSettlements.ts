import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";
import type { Settlement } from "@/types";
import type { InitiateSettlementRequest } from "@/services/settlements";

interface SettlementsResponse {
  settlements: Settlement[];
}

export const useSettlements = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);

  const settlementsQuery = useQuery({
    queryKey: ["settlements", walletAddress],
    queryFn: async () => {
      const response = await api.get<SettlementsResponse>("/settlements");
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const initiateMutation = useMutation({
    mutationFn: async (data: InitiateSettlementRequest) => {
      const response = await api.post("/settlements/initiate", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["settlements", walletAddress],
      });
    },
  });

  return {
    settlements: settlementsQuery.data,
    isLoading: settlementsQuery.isLoading,
    initiateSettlement: initiateMutation.mutateAsync,
    isInitiating: initiateMutation.isPending,
  };
};
