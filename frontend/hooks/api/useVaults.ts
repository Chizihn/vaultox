import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuthStore } from "../../store";
import { useWalletActions, useWalletConnection } from "@solana/react-hooks";
import { getTransactionDecoder, getTransactionEncoder } from "@solana/transactions";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-handler";

type PendingSignatureResponse = {
  unsignedTransaction: string;
  depositId?: string;
  withdrawId?: string;
  withdrawalId?: string;
  amountRequested?: number;
  amount?: number;
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

const waitForConfirmation = async (signatureText: string) => {
  const timeoutMs = 30_000;
  const intervalMs = 2_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const statusResponse = await api.get<BackendTransactionStatus>(
      "/vaults/transactions/status",
      { params: { signature: signatureText } },
    );

    const txStatus = statusResponse.data;
    if (txStatus.status === "failed") {
      throw new Error(
        `Transaction failed on-chain: ${JSON.stringify(txStatus.error ?? "unknown error")}`,
      );
    }
    if (txStatus.status === "confirmed" || txStatus.status === "finalized") {
      return txStatus;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
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

export const useVaults = () => {
  const queryClient = useQueryClient();
  const walletAddress = useAuthStore((state) => state.walletAddress);
  const { status, wallet } = useWalletConnection();
  const walletActions = useWalletActions();
  const [depositStep, setDepositStep] = useState<number>(0);
  const [depositStatus, setDepositStatus] = useState<string>("");
  const [withdrawStep, setWithdrawStep] = useState<number>(0);
  const [withdrawStatus, setWithdrawStatus] = useState<string>("");

  const submitUnsignedTransaction = async (
    responseData: PendingSignatureResponse,
  ) => {
    if (!responseData?.unsignedTransaction) {
      throw new Error("Backend did not return an unsigned transaction.");
    }

    if (!wallet && typeof (walletActions as any)?.signTransaction !== "function") {
      throw new Error("Connect a Solana wallet to submit this transaction.");
    }

    // Hard guard: the wallet connected in the browser must match the wallet address
    // from the authenticated session (JWT). If they diverge, Solana simulation can
    // fail with confusing "wallet disconnected" / program errors.
    if (walletAddress && wallet?.account?.address) {
      const connectedWalletAddress = wallet.account.address.toString();
      if (connectedWalletAddress !== walletAddress) {
        toast.error(
          "Wallet mismatch: your connected wallet does not match the active session. Please disconnect and reconnect.",
        );
        throw new Error(
          `Wallet mismatch: connected=${connectedWalletAddress} session=${walletAddress}`,
        );
      }
    }

    const txBytes = decodeBase64(responseData.unsignedTransaction);

    // Deserialize using the existing v2 decoder
    const decodedTransaction = getTransactionDecoder().decode(txBytes);

    // User signs locally only — does NOT broadcast
    const signedTx = (wallet as any)?.signTransaction
      ? await (wallet as any).signTransaction(decodedTransaction as any)
      : await (walletActions as any).signTransaction(decodedTransaction as any);

    // Serialize the partially signed transaction back to base64
    const signedTxBytes = getTransactionEncoder().encode(signedTx as any);
    const partiallySignedTxBase64 = Buffer.from(signedTxBytes).toString("base64");

    const txType = responseData.depositId
      ? "deposit"
      : responseData.withdrawId || responseData.withdrawalId
        ? "withdraw"
        : null;

    const attemptedAmount =
      typeof responseData.amountRequested === "number"
        ? responseData.amountRequested
        : typeof responseData.amount === "number"
          ? responseData.amount
          : undefined;

    let signature: string | null = null;
    try {
      // Backend co-signs and submits
      const submitResponse = await api.post("/vaults/transactions/submit", {
        partiallySignedTx: partiallySignedTxBase64,
      });

      signature = submitResponse.data?.signature ?? null;
      if (!signature) {
        throw new Error("Backend did not return a signature.");
      }

      const confirmedStatus = await waitForConfirmation(signature);

      if (txType) {
        try {
          await api.post("/vaults/transactions/record", {
            type: txType,
            signature,
            status: confirmedStatus.status,
            strategyId: responseData.strategyId,
            positionId: responseData.positionId,
            amount: attemptedAmount,
          });
        } catch (error) {
          console.error("Failed to record vault transaction", error);
        }
      }

      return {
        ...responseData,
        signature,
        status: confirmedStatus.status,
        confirmationStatus: confirmedStatus.confirmationStatus,
        slot: confirmedStatus.slot,
        confirmations: confirmedStatus.confirmations,
      };
    } catch (error) {
      // Best-effort audit logging even when simulation/preflight fails.
      if (txType) {
        try {
          await api.post("/vaults/transactions/record", {
            type: txType,
            signature: signature ?? "N/A",
            status: "failed",
            strategyId: responseData.strategyId,
            positionId: responseData.positionId,
            amount: attemptedAmount,
          });
        } catch (recordError) {
          console.error(
            "Failed to record failed vault transaction",
            recordError,
          );
        }
      }

      throw error;
    }
  };

  const waitForConfirmationLegacy = async (signatureText: string) => {
    // This is no longer used, we use the module-level waitForConfirmation
    return waitForConfirmation(signatureText);
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
      try {
        const isSolsticeLiquidity = data.strategyId === "solstice-liquidity";
        setDepositStep(1);
        setDepositStatus("1/3: Requesting Mint (Sign 1/3)...");
        // Step 1: RequestMint + ATA setup
        const step1Response = await api.post("/vaults/deposit", data);
        const step1Result = await submitUnsignedTransaction({
          ...(step1Response.data as PendingSignatureResponse),
          strategyId: data.strategyId,
          amount: data.amount,
        });
        if (
          step1Result.status !== "confirmed" &&
          step1Result.status !== "finalized"
        ) {
          throw new Error("RequestMint did not confirm. Please try again.");
        }

        setDepositStep(2);
        setDepositStatus("2/3: Confirming Mint (Sign 2/3)...");
        // Step 2a: ConfirmMint (oracle processes the mint, USX lands in wallet)
        const step2aResponse = await api.post("/vaults/deposit/confirm-mint");
        const step2aResult = await submitUnsignedTransaction({
          ...(step2aResponse.data as PendingSignatureResponse),
          strategyId: data.strategyId,
          amount: data.amount,
        });
        if (
          step2aResult.status !== "confirmed" &&
          step2aResult.status !== "finalized"
        ) {
          throw new Error("ConfirmMint did not confirm. Please try again.");
        }

        // Solstice Liquidity is designed for instant withdrawal, so we do not
        // lock into the yield vault (skip the Lock instruction).
        if (isSolsticeLiquidity) {
          setDepositStep(3);
          setDepositStatus("3/3: Finalizing Liquidity Position (Instant)...");
          setDepositStatus("Success!");
          return step2aResult;
        }

        setDepositStep(3);
        setDepositStatus("3/3: Locking into Vault (Sign 3/3)...");
        // Step 2b: Lock (USX → eUSX, begin earning yield)
        const step2bResponse = await api.post("/vaults/deposit/lock", {
          amount: data.amount,
        });
        const result = await submitUnsignedTransaction({
          ...(step2bResponse.data as PendingSignatureResponse),
          strategyId: data.strategyId,
          amount: data.amount,
        });
        setDepositStatus("Success!");
        return result;
      } finally {
        // Reset after a delay
        setTimeout(() => {
          setDepositStep(0);
          setDepositStatus("");
        }, 3000);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
      // Dashboard/topnav AUM comes from this query.
      queryClient.invalidateQueries({ queryKey: ["dashboard-portfolio", walletAddress] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({
      positionId,
      strategyId,
      amount,
    }: {
      positionId: string;
      strategyId?: string;
      amount: number;
    }) => {
      setWithdrawStep(0);
      setWithdrawStatus("Preparing withdrawal...");

      const isSolstice = Boolean(strategyId?.includes("solstice"));
      const isSolsticeLiquidity = strategyId === "solstice-liquidity";

      if (isSolstice) {
        // Solstice Liquidity: instant exit => redeem USX -> USDC.
        if (isSolsticeLiquidity) {
          setWithdrawStep(1);
          setWithdrawStatus("Phase 1/2: Requesting redemption (Oracle sync)...");
          const step2Response = await api.post(
            "/vaults/withdraw/request-redeem",
            { amount },
          );
          const step2Payload = step2Response.data as {
            amountRequested?: number;
            cappedToBalance?: boolean;
            message?: string;
          };

          if (step2Payload.cappedToBalance) {
            toast.info(
              step2Payload.message ??
                "Redeem amount was reduced to your full on-chain USX balance.",
            );
          }

          await submitUnsignedTransaction({
            ...step2Response.data,
            positionId,
            strategyId,
            amount,
          });

          setWithdrawStep(2);
          setWithdrawStatus("Phase 2/2: Finalizing asset recovery...");
          // Wait for oracle sync in development
          await new Promise((r) => setTimeout(r, 2000));
          const step3Response = await api.post(
            "/vaults/withdraw/confirm-redeem",
            {},
          );

          const finalResult = await submitUnsignedTransaction({
            ...step3Response.data,
            positionId,
            strategyId,
            amount,
          });

          setWithdrawStatus("Withdrawal completed successfully.");
          return finalResult;
        }

        // Solstice Yield/Compounding: cooldown exit => Unlock & Withdraw (eUSX -> USX),
        // then redeem USX -> USDC.
        setWithdrawStep(1);
        setWithdrawStatus("Phase 1/3: Unlocking assets & claiming yield...");
        const step1Response = await api.post("/vaults/withdraw", { positionId, amount });
        const step1Payload = step1Response.data as {
          amountRequested?: number;
          cappedToBalance?: boolean;
          message?: string;
        };

        // Phase 1 may cap to actual eUSX (deposit USDC -> eUSX is not always 1:1 vs USDC)
        const phaseAmount =
          typeof step1Payload.amountRequested === "number"
            ? step1Payload.amountRequested
            : amount;

        if (step1Payload.cappedToBalance) {
          toast.info(
            step1Payload.message ??
              "Withdrawal amount was set to your full eUSX balance (fees/rounding can make this less than your original USDC deposit).",
          );
        }

        await submitUnsignedTransaction({
          ...step1Response.data,
          positionId,
          strategyId,
          amount: phaseAmount,
        });

        // --- PHASE 2: Request Redeem (must match USX available after phase 1) ---
        setWithdrawStep(2);
        setWithdrawStatus("Phase 2/3: Requesting redemption (Oracle sync)...");
        const step2Response = await api.post("/vaults/withdraw/request-redeem", {
          amount: phaseAmount,
        });
        const step2Payload = step2Response.data as {
          amountRequested?: number;
          cappedToBalance?: boolean;
          message?: string;
        };

        if (step2Payload.cappedToBalance) {
          toast.info(
            step2Payload.message ??
              "Redeem amount was reduced to your full on-chain USX balance.",
          );
        }

        await submitUnsignedTransaction({
          ...step2Response.data,
          positionId,
          strategyId,
          amount: phaseAmount,
        });

        // --- PHASE 3: Confirm Redeem ---
        setWithdrawStep(3);
        setWithdrawStatus("Phase 3/3: Finalizing asset recovery...");
        // Wait for oracle sync in development
        await new Promise((r) => setTimeout(r, 2000));
        const step3Response = await api.post(
          "/vaults/withdraw/confirm-redeem",
          {},
        );

        const finalResult = await submitUnsignedTransaction({
          ...step3Response.data,
          positionId,
          strategyId,
          amount: phaseAmount,
        });

        setWithdrawStatus("Withdrawal completed successfully.");
        return finalResult;
      }

      // Standard withdrawal for other strategies
      const response = await api.post("/vaults/withdraw", { positionId, amount });
      return submitUnsignedTransaction({
        ...response.data,
        positionId,
        strategyId,
        amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["vault-positions"] });
      queryClient.invalidateQueries({ queryKey: ["vault-portfolio"] });
      // Dashboard/topnav AUM comes from this query.
      queryClient.invalidateQueries({ queryKey: ["dashboard-portfolio", walletAddress] });
    },
  });

  const cancelMintMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/vaults/deposit/cancel");
      return submitUnsignedTransaction(
        response.data as PendingSignatureResponse,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["vault-positions"] });
      queryClient.invalidateQueries({ queryKey: ["vault-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-portfolio", walletAddress] });
      toast.success("Cancel mint submitted. Check your wallet if signing was required.");
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, "Cancel mint failed."));
    },
  });

  const cancelRedeemMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/vaults/withdraw/cancel");
      return submitUnsignedTransaction(
        response.data as PendingSignatureResponse,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["vault-positions"] });
      queryClient.invalidateQueries({ queryKey: ["vault-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-portfolio", walletAddress] });
      toast.success("Cancel redeem submitted. Check your wallet if signing was required.");
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, "Cancel redeem failed."));
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
    depositStep,
    depositStatus,
    withdrawStep,
    withdrawStatus,
    withdraw: withdrawMutation.mutateAsync,
    isWithdrawing: withdrawMutation.isPending,
    createStrategy: createStrategyMutation.mutateAsync,
    isCreatingStrategy: createStrategyMutation.isPending,
    cancelMint: cancelMintMutation.mutateAsync,
    isCancellingMint: cancelMintMutation.isPending,
    cancelRedeem: cancelRedeemMutation.mutateAsync,
    isCancellingRedeem: cancelRedeemMutation.isPending,
  };
};
