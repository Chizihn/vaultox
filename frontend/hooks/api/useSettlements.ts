import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";
import type { Settlement } from "@/types";
import type { InitiateSettlementRequest } from "@/services/settlements";
import { useWalletActions, useWalletConnection } from "@solana/react-hooks";
import { getTransactionDecoder } from "@solana/transactions";

interface SettlementsResponse {
  settlements: Settlement[];
}

type PendingSignatureSettlementResponse = {
  settlementId: string;
  unsignedTransaction: string;
  estimatedFee: string;
  status: "pending_signature";
  debug?: {
    phase?: string;
    settlementSeedHex?: string;
    recentBlockhash?: string;
    cluster?: string;
  };
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

export const useSettlements = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);
  const { status, wallet } = useWalletConnection();
  const walletActions = useWalletActions();

  const submitUnsignedSettlementTransaction = async (
    responseData: PendingSignatureSettlementResponse,
  ) => {
    try {
      if (!responseData?.unsignedTransaction) {
        throw new Error(
          "Backend did not return an unsigned settlement transaction.",
        );
      }

      console.info("[settlements] unsigned tx metadata", {
        settlementId: responseData.settlementId,
        estimatedFee: responseData.estimatedFee,
        debug: responseData.debug,
      });

      if (!wallet && typeof walletActions?.sendTransaction !== "function") {
        throw new Error("Connect a Solana wallet to submit this settlement.");
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

      await api.post(`/settlements/${responseData.settlementId}/submitted`, {
        signature: signatureText,
      });

      const waitForConfirmation = async () => {
        const timeoutMs = 60_000;
        const intervalMs = 2_500;
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
          const statusResponse = await api.get<BackendTransactionStatus>(
            "/settlements/transactions/status",
            {
              params: { signature: signatureText },
            },
          );

          const txStatus = statusResponse.data;
          if (txStatus.status === "failed") {
            throw new Error(
              `Settlement transaction failed on-chain: ${JSON.stringify(txStatus.error ?? "unknown error")}`,
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

      if (
        confirmedStatus.status === "confirmed" ||
        confirmedStatus.status === "finalized"
      ) {
        await api.post(`/settlements/${responseData.settlementId}/submitted`, {
          signature: signatureText,
        });
      }

      return {
        ...responseData,
        signature: signatureText,
        status: confirmedStatus.status,
        confirmationStatus: confirmedStatus.confirmationStatus,
        slot: confirmedStatus.slot,
        confirmations: confirmedStatus.confirmations,
      };
    } catch (error) {
      const candidate = error as {
        getLogs?: () => Promise<string[]>;
        message?: string;
      };

      if (typeof candidate?.getLogs === "function") {
        try {
          const logs = await candidate.getLogs();
          console.error("[settlements] Solana simulation logs", {
            settlementId: responseData?.settlementId,
            logs,
          });
        } catch (logError) {
          console.error("[settlements] Failed to fetch simulation logs", {
            settlementId: responseData?.settlementId,
            logError,
          });
        }
      }

      console.error(
        "[settlements] submitUnsignedSettlementTransaction failed",
        {
          settlementId: responseData?.settlementId,
          hasUnsignedTx: Boolean(responseData?.unsignedTransaction),
          error,
        },
      );
      throw error;
    }
  };

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
      const response = await api.post<PendingSignatureSettlementResponse>(
        "/settlements/initiate",
        data,
      );
      return submitUnsignedSettlementTransaction(response.data);
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
    initiateMutation,
  };
};
