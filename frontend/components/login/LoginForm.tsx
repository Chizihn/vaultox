"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  CheckCircle,
  Loader2,
  AlertCircle,
  X,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/api/useAuth";
import bs58 from "bs58";
import { getErrorMessage } from "@/utils/error-handler";
import { useWalletConnection } from "@solana/react-hooks";

export function LoginForm() {
  const router = useRouter();
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();
  const { getChallenge, verifySignature, isGettingChallenge, isVerifying } =
    useAuth();

  const [step, setStep] = useState<"select" | "connecting" | "done">("select");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingConnectorId, setConnectingConnectorId] = useState<
    string | null
  >(null);

  // Filter out non-Solana wallets like MetaMask and Slush
  const supportedConnectors = connectors.filter((c) => {
    const name = c.name.toLowerCase();
    return !name.includes("metamask") && !name.includes("slush");
  });

  const handleConnectAndSign = async (connectorId: string) => {
    if (connectingConnectorId) return; // Prevent double clicks

    try {
      setAuthError(null);
      setConnectingConnectorId(connectorId);

      // Always connect the chosen connector (connectorId is wallet-standard id, not a pubkey).
      await connect(connectorId);

      setIsModalOpen(false);
    } catch (error: unknown) {
      console.error("Connection failed:", error);
      setAuthError(getErrorMessage(error, "Failed to connect wallet"));
    } finally {
      setConnectingConnectorId(null);
    }
  };

  const handleVerify = async () => {
    if (status !== "connected" || !wallet) {
      setAuthError("No Solana wallet connected.");
      return;
    }

    if (typeof wallet.signMessage !== "function") {
      setAuthError("Connected wallet does not support message signing.");
      return;
    }

    try {
      setStep("connecting");
      setAuthError(null);

      const walletAddress = wallet.account.address.toString();

      // 1. Get nonce challenge
      const { nonce } = await getChallenge(walletAddress);

      // 2. Sign message
      const messageBytes = new TextEncoder().encode(nonce);
      const signatureBytes = await wallet.signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // 3. Verify signature with backend
      const { credentialStatus } = await verifySignature({
        walletAddress,
        signature,
        nonce,
      });

      setStep("done");

      await new Promise((r) => setTimeout(r, 800));

      router.push(
        credentialStatus === "verified"
          ? "/dashboard"
          : `/access-pending?status=${credentialStatus}`,
      );
    } catch (error: unknown) {
      console.error("Auth failed:", error);
      setAuthError(getErrorMessage(error, "Failed to verify wallet signature"));
      setStep("select");
    }
  };

  return (
    <div className="flex h-full flex-col justify-center px-10 py-12 lg:px-16 relative">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto w-full max-w-sm"
      >
        {/* Heading */}
        <div className="mb-8">
          <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
            Institutional Access
          </p>
          <h2 className="mt-1 font-heading text-3xl text-text-primary">
            Connect Solana Wallet
          </h2>
          <p className="mt-1.5 font-body text-xs text-muted-vault">
            Connect and verify using a Solana wallet to access VaultOX.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="rounded-sm border border-vault-border bg-vault-elevated px-4 py-3">
                <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Supported Wallets
                </p>
                <p className="mt-1 font-body text-xs text-text-primary">
                  Phantom · Solflare · Backpack
                </p>
              </div>

              {authError && (
                <div className="flex items-center gap-2 rounded-sm bg-warn/10 p-3 text-warn mt-2 border border-warn/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="font-body text-xs">{authError}</p>
                </div>
              )}

              {/* Connect / Verify Area */}
              {status === "connected" && wallet ? (
                <div className="space-y-3">
                  <p className="text-sm text-center text-text-primary">
                    Connected: {wallet.account.address.toString().slice(0, 4)}
                    ...{wallet.account.address.toString().slice(-4)}
                  </p>
                  <button
                    onClick={handleVerify}
                    disabled={isVerifying || isGettingChallenge}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-sm bg-gold py-3 font-heading text-sm font-semibold text-vault-base transition-opacity",
                      isVerifying || isGettingChallenge
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-90",
                    )}
                  >
                    Verify
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      disconnect();
                      setAuthError(null);
                    }}
                    className="w-full text-center text-xs text-muted-vault hover:text-text-primary mt-2"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-sm bg-gold py-3 font-heading text-sm font-semibold text-vault-base transition-opacity hover:opacity-90"
                  >
                    <Wallet className="size-4" />
                    Connect Wallet
                  </button>
                </div>
              )}

              <p className="text-center font-body text-[10px] text-muted-vault/50">
                This action opens a Solana wallet connection (if needed) and
                then signs a challenge for verification.
              </p>
            </motion.div>
          )}

          {step === "connecting" && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <div className="relative">
                <div className="size-14 rounded-full border-2 border-gold/20 bg-vault-elevated flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-gold" />
                </div>
                <div className="absolute inset-0 animate-ping rounded-full border border-gold/10" />
              </div>
              <p className="font-heading text-sm text-text-primary">
                Verifying credential…
              </p>
              <p className="font-body text-xs text-muted-vault">
                Querying on-chain Vault Passport
              </p>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <div className="size-14 rounded-full border-2 border-ok/40 bg-ok/10 flex items-center justify-center">
                <CheckCircle className="size-7 text-ok" />
              </div>
              <p className="font-heading text-lg text-ok">Verified</p>
              <p className="font-body text-xs text-muted-vault text-center">
                Welcome back. Redirecting to dashboard…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Wallet Selection Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-vault-base/80 backdrop-blur-sm"
              onClick={() => !connectingConnectorId && setIsModalOpen(false)}
            />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ pointerEvents: "none" }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full max-w-sm rounded-sm border border-vault-border bg-vault-surface shadow-2xl overflow-hidden"
                style={{ pointerEvents: "auto" }}
              >
                <div className="flex items-center justify-between border-b border-vault-border px-5 py-4">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    Select Wallet
                  </h3>
                  <button
                    onClick={() =>
                      !connectingConnectorId && setIsModalOpen(false)
                    }
                    disabled={!!connectingConnectorId}
                    className="flex size-8 items-center justify-center rounded-sm hover:bg-vault-elevated disabled:opacity-50"
                  >
                    <X className="size-4 text-muted-vault" />
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                  {supportedConnectors.map((connector) => {
                    const isConnecting = connectingConnectorId === connector.id;
                    return (
                      <button
                        key={connector.id}
                        onClick={() => handleConnectAndSign(connector.id)}
                        disabled={!!connectingConnectorId}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm border border-vault-border bg-vault-elevated px-4 py-3 transition-colors",
                          connectingConnectorId
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:border-gold/50 hover:bg-vault-highlight",
                        )}
                      >
                        <span className="font-heading text-sm font-medium text-text-primary">
                          {connector.name}
                        </span>
                        {isConnecting ? (
                          <Loader2 className="size-4 animate-spin text-gold" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-vault" />
                        )}
                      </button>
                    );
                  })}
                  {supportedConnectors.length === 0 && (
                    <div className="py-6 text-center">
                      <Wallet className="size-8 text-muted-vault/40 mx-auto mb-3" />
                      <p className="font-body text-xs text-muted-vault">
                        No Solana wallets detected.
                        <br />
                        Please install Phantom or Solflare.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
