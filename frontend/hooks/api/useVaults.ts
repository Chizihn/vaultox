import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuthStore } from '../../store';

export const useVaults = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);

  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await api.get('/vaults/strategies');
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const positionsQuery = useQuery({
    queryKey: ['positions', walletAddress],
    queryFn: async () => {
      const response = await api.get('/vaults/positions');
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const depositMutation = useMutation({
    mutationFn: async (data: { strategyId: string; amount: number }) => {
      const response = await api.post('/vaults/deposit', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', walletAddress] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { positionId: string; amount: number }) => {
      const response = await api.post('/vaults/withdraw', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', walletAddress] });
    },
  });

  return {
    strategies: strategiesQuery.data,
    isLoadingStrategies: strategiesQuery.isLoading,
    positions: positionsQuery.data,
    isLoadingPositions: positionsQuery.isLoading,
    deposit: depositMutation.mutateAsync,
    isDepositing: depositMutation.isPending,
    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,
  };
};
