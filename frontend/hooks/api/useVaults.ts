import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";
import { useWalletActions, useWalletConnection } from "@solana/react-hooks";
import { getTransactionDecoder } from "@solana/transactions";

type PendingSignatureResponse = {
  unsignedTransaction: string;
  depositId?: string;
  withdrawId?: string;
  withdrawalId?: string;
  strategyId?: string;
  positionId?: string;
  status?: string;
};

type BackendTransactionStatus = {
  signature: string;
  status: "submitted" | "confirmed" | "finalized" | "failed" | "unknown";
  confirmationStatus: string;
  slot: number | null;
  confirmations: number | null;
  error: unknown;
};

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Empty unsigned transaction payload.");
  }

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(normalized, "base64"));
}

export const useVaults = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);
  const { status, wallet } = useWalletConnection();
  const walletActions = useWalletActions();

  const submitUnsignedTransaction = async (
    responseData: PendingSignatureResponse,
  ) => {
    if (!responseData?.unsignedTransaction) {
      throw new Error("Backend did not return an unsigned transaction.");
    }

    // HACKATHON FALLBACK: We removed `status !== 'connected'` check here because 
    // the wallet adapter status closure occasionally goes stale in React Query mutations.
    // As long as `walletActions.sendTransaction` is available, the wallet is actually connected.
    if (!wallet && typeof walletActions?.sendTransaction !== "function") {
      throw new Error("Connect a Solana wallet to submit this transaction.");
    }

    const txBytes = decodeBase64(responseData.unsignedTransaction);
    const transaction = getTransactionDecoder().decode(txBytes);
    const sendableTransaction = transaction as Parameters<
      typeof walletActions.sendTransaction
    >[0];

    const signature = wallet?.sendTransaction
      ? await wallet.sendTransaction(sendableTransaction, {
          commitment: "confirmed",
        })
      : await walletActions.sendTransaction(sendableTransaction, "confirmed");

    const signatureText = signature.toString();

    const waitForConfirmation = async () => {
      const timeoutMs = 30_000;
      const intervalMs = 2_000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        const statusResponse = await api.get<BackendTransactionStatus>(
          "/vaults/transactions/status",
          {
            params: { signature: signatureText },
          },
        );

        const txStatus = statusResponse.data;
        if (txStatus.status === "failed") {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(txStatus.error ?? "unknown error")}`,
          );
        }

        if (
          txStatus.status === "confirmed" ||
          txStatus.status === "finalized"
        ) {
          return txStatus;
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, intervalMs);
        });
      }

      return {
        signature: signatureText,
        status: "submitted" as const,
        confirmationStatus: "processed",
        slot: null,
        confirmations: null,
        error: null,
      };
    };

    const confirmedStatus = await waitForConfirmation();

    const txType = responseData.depositId
      ? "deposit"
      : responseData.withdrawId || responseData.withdrawalId
        ? "withdraw"
        : null;

    if (txType) {
      try {
        await api.post("/vaults/transactions/record", {
          type: txType,
          signature: signatureText,
          status: confirmedStatus.status,
          strategyId: responseData.strategyId,
          positionId: responseData.positionId,
        });
      } catch (error) {
        console.error("Failed to record vault transaction", error);
      }
    }

    return {
      ...responseData,
      signature: signatureText,
      status: confirmedStatus.status,
      confirmationStatus: confirmedStatus.confirmationStatus,
      slot: confirmedStatus.slot,
      confirmations: confirmedStatus.confirmations,
    };
  };

  const strategiesQuery = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const response = await api.get("/vaults/strategies");
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const positionsQuery = useQuery({
    queryKey: ["positions", walletAddress],
    queryFn: async () => {
      const response = await api.get("/vaults/positions");
      return response.data;
    },
    enabled: !!walletAddress,
  });

  const depositMutation = useMutation({
    mutationFn: async (data: { strategyId: string; amount: number }) => {
      const response = await api.post("/vaults/deposit", data);
      return submitUnsignedTransaction(
        response.data as PendingSignatureResponse,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { positionId: string; amount: number }) => {
      const response = await api.post("/vaults/withdraw", data);
      return submitUnsignedTransaction(
        response.data as PendingSignatureResponse,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
    },
  });

  const createStrategyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/vaults/strategies", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
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
    createStrategy: createStrategyMutation.mutateAsync,
    isCreatingStrategy: createStrategyMutation.isPending,
  };
};
