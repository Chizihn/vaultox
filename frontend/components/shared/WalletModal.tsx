"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  ExternalLink,
  LogOut,
  Settings,
  FileCheck,
  AlertTriangle,
  X,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/store";
import { TierBadge } from "@/components/shared/TierBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";

import { cn } from "@/lib/utils";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function WalletModal({
  open,
  onClose,
  onOpenSettings,
}: WalletModalProps) {
  const router = useRouter();
  const { walletAddress, institution, tier, disconnect } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleCopy = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    disconnect();
    onClose();
    router.push("/login");
  };

  const handleCompliance = () => {
    onClose();
    router.push("/compliance");
  };

  const handleSettings = () => {
    onClose();
    onOpenSettings();
  };

  const displayName = institution?.name ?? "Unknown Institution";
  const role = institution
    ? `${institution.jurisdiction} · Tier ${institution.tier}`
    : "Credential pending";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Wallet details"
          >
            <div className="overflow-hidden rounded-sm border border-vault-border bg-vault-surface shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-vault-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-ok animate-pulse" />
                  <span className="font-heading text-sm font-semibold text-text-primary">
                    Connected Wallet
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="flex size-7 items-center justify-center rounded-sm text-muted-vault transition-colors hover:bg-vault-elevated hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!confirmDisconnect ? (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    {/* User identity row */}
                    <div className="flex items-center gap-3 border-b border-vault-border px-5 py-4">
                      <UserAvatar name={displayName} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm font-semibold text-text-primary truncate">
                          {displayName}
                        </p>
                        <p className="font-body text-[11px] text-muted-vault truncate">
                          {role}
                        </p>
                      </div>
                      {tier && <TierBadge tier={tier} size="sm" />}
                    </div>

                    {/* Institution */}
                    {institution && (
                      <div className="border-b border-vault-border px-5 py-3">
                        <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault mb-1.5">
                          Institution
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {institution.jurisdictionFlag}
                          </span>
                          <div>
                            <p className="font-heading text-xs font-medium text-text-primary">
                              {institution.name}
                            </p>
                            <p className="font-body text-[10px] text-muted-vault">
                              {institution.city} · {institution.jurisdiction}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Wallet address */}
                    <div className="border-b border-vault-border px-5 py-3">
                      <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault mb-1.5">
                        Wallet Address
                      </p>
                      <div className="flex items-center gap-2 rounded-sm bg-vault-elevated px-3 py-2">
                        <Shield className="size-3.5 shrink-0 text-teal" />
                        <span className="flex-1 font-code text-[11px] text-muted-vault truncate">
                          {walletAddress}
                        </span>
                        <button
                          onClick={handleCopy}
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-sm transition-all",
                            copied
                              ? "text-ok"
                              : "text-muted-vault hover:text-text-primary",
                          )}
                          title="Copy full address"
                        >
                          {copied ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                        <button
                          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-vault transition-colors hover:text-text-primary"
                          title="View on explorer"
                          onClick={() =>
                            window.open(
                              `https://explorer.solana.com/address/${walletAddress}`,
                              "_blank",
                            )
                          }
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                      </div>
                      {copied && (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-1.5 font-body text-[10px] text-ok"
                        >
                          Address copied to clipboard
                        </motion.p>
                      )}
                    </div>

                    {/* Menu items */}
                    <div className="border-b border-vault-border py-1">
                      <button
                        onClick={handleCompliance}
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-vault-elevated"
                      >
                        <FileCheck className="size-4 text-muted-vault" />
                        <span className="flex-1 font-body text-sm text-text-primary">
                          View Credential
                        </span>
                        <ChevronRight className="size-3.5 text-muted-vault" />
                      </button>
                      <button
                        onClick={handleSettings}
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-vault-elevated"
                      >
                        <Settings className="size-4 text-muted-vault" />
                        <span className="flex-1 font-body text-sm text-text-primary">
                          Settings
                        </span>
                        <ChevronRight className="size-3.5 text-muted-vault" />
                      </button>
                    </div>

                    {/* Disconnect */}
                    <div className="px-5 py-3">
                      <button
                        onClick={handleDisconnect}
                        className="flex w-full items-center justify-center gap-2 rounded-sm border border-warn/20 bg-warn/5 py-2.5 font-heading text-sm font-medium text-warn transition-all hover:border-warn/40 hover:bg-warn/10"
                      >
                        <LogOut className="size-4" />
                        Disconnect Wallet
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-5 py-6"
                  >
                    <div className="mb-4 flex flex-col items-center gap-3 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-warn/10 ring-1 ring-warn/30">
                        <AlertTriangle className="size-6 text-warn" />
                      </div>
                      <div>
                        <p className="font-heading text-sm font-semibold text-text-primary">
                          Disconnect Wallet?
                        </p>
                        <p className="mt-1 font-body text-xs text-muted-vault">
                          You will be signed out and redirected to the login
                          screen. Any unsaved changes will be lost.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDisconnect(false)}
                        className="flex-1 rounded-sm border border-vault-border bg-vault-elevated py-2.5 font-heading text-sm text-text-primary transition-colors hover:border-gold/30"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="flex-1 rounded-sm bg-warn py-2.5 font-heading text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        Yes, Disconnect
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
