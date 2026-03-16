import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";

export const useCompliance = () => {
  const walletAddress = useAuthStore((state) => state.walletAddress);

  const credentialQuery = useQuery({
    queryKey: ["compliance-credential", walletAddress],
    queryFn: async () => {
      const response = await api.get("/compliance/credential");
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const auditEventsQuery = useQuery({
    queryKey: ["audit-events", walletAddress],
    queryFn: async () => {
      const response = await api.get("/compliance/audit-events");
      return response.data.events;
    },
    enabled: !!walletAddress,
  });

  return {
    credential: credentialQuery.data,
    isLoadingCredential: credentialQuery.isLoading,
    auditEvents: auditEventsQuery.data,
    isLoadingAuditEvents: auditEventsQuery.isLoading,
  };
};
