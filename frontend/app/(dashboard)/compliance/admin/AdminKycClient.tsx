"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  approveKycRequestAdmin,
  getAdminKycQueue,
  rejectKycRequestAdmin,
  resyncKycDbFromChainAdmin,
  resyncKycCredentialAdmin,
  type AdminKycRequestItem,
} from "@/services/compliance";
// import api from "@/services/api";
import { formatAddress, formatDate } from "@/utils/format";
// import { getErrorMessage } from "@/utils/error-handler";

type StatusFilter = "pending" | "under_review" | "approved" | "rejected";

// type SixDebugResponse = {
//   ready: boolean;
//   reason?: string;
//   request?: {
//     symbols?: string[];
//     valorIds?: string[];
//   };
//   payload?: {
//     rootType?: string;
//     rootKeys?: string[];
//     sampleNodes?: Array<{
//       path: string;
//       keys: string[];
//       idHints: string[];
//       symbolHints: string[];
//       priceHints: number[];
//     }>;
//   };
//   extraction?: {
//     parsedQuoteCount?: number;
//     matchedValorIds?: string[];
//     unmatchedValorIds?: string[];
//     sampleParsedEntries?: Array<{
//       id: string;
//       price: number | null;
//       asOf: string | null;
//       relativeChange: number | null;
//       source: string | null;
//     }>;
//   };
//   error?: string;
// };
import { getSolanaExplorerTxUrl } from "@/config/solana";

export function AdminKycClient() {
  const [adminKey, setAdminKey] = useState("");
  const [resyncWalletsInput, setResyncWalletsInput] = useState<string>("");
  const [debouncedAdminKey, setDebouncedAdminKey] = useState("");
  const [validatedAdminKey, setValidatedAdminKey] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<StatusFilter | "all">("pending");
  const [items, setItems] = useState<AdminKycRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWallet, setBusyWallet] = useState<string | null>(null);
  const [overrideApprovalKey, setOverrideApprovalKey] = useState("");
  const [tierByWallet, setTierByWallet] = useState<Record<string, 1 | 2 | 3>>(
    {},
  );
  const [noteByWallet, setNoteByWallet] = useState<Record<string, string>>({});
  // const [sixDebugSymbols, setSixDebugSymbols] = useState(
  //   "EURUSD,USDCHF,XAUUSD",
  // );
  // const [sixDebugLoading, setSixDebugLoading] = useState(false);
  // const [sixDebugError, setSixDebugError] = useState<string | null>(null);
  // const [sixDebugData, setSixDebugData] = useState<SixDebugResponse | null>(
  //   null,
  // );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedAdminKey(adminKey);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [adminKey]);

  const normalizedInputKey = useMemo(
    () => debouncedAdminKey.trim().replace(/^['\"]|['\"]$/g, ""),
    [debouncedAdminKey],
  );

  const isUnlocked =
    validatedAdminKey !== null && validatedAdminKey === normalizedInputKey;
  const canAttemptUnlock = normalizedInputKey.length > 0;

  useEffect(() => {
    if (
      validatedAdminKey &&
      normalizedInputKey.length > 0 &&
      normalizedInputKey !== validatedAdminKey
    ) {
      setValidatedAdminKey(null);
      setItems([]);
    }

    if (normalizedInputKey.length === 0 && validatedAdminKey !== null) {
      setValidatedAdminKey(null);
      setItems([]);
    }
  }, [normalizedInputKey, validatedAdminKey]);

  const refreshQueue = useCallback(async () => {
    if (!canAttemptUnlock) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getAdminKycQueue({
        adminKey: normalizedInputKey,
        status: status === "all" ? undefined : status,
        limit: 100,
      });
      setItems(response.items);
      setValidatedAdminKey(normalizedInputKey);
      setTierByWallet((prev) => {
        const next = { ...prev };
        for (const item of response.items) {
          if (!next[item.walletAddress]) {
            const resolved = Math.min(
              3,
              Math.max(1, item.recommendedTier || item.tier || 3),
            ) as 1 | 2 | 3;
            next[item.walletAddress] = resolved;
          }
        }
        return next;
      });
    } catch {
      setValidatedAdminKey(null);
      setError("Failed to load KYC queue. Check admin key and backend logs.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canAttemptUnlock, normalizedInputKey, status]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const handleApprove = async (item: AdminKycRequestItem) => {
    if (!isUnlocked) return;
    setBusyWallet(item.walletAddress);
    setError(null);
    try {
      const tier = tierByWallet[item.walletAddress] ?? 3;
      const reviewerNotes = noteByWallet[item.walletAddress]?.trim();
      const needsOverride = tier < item.recommendedTier;

      await approveKycRequestAdmin({
        adminKey: normalizedInputKey,
        overrideApprovalKey: needsOverride
          ? overrideApprovalKey.trim() || undefined
          : undefined,
        walletAddress: item.walletAddress,
        tier,
        kycLevel: tier,
        amlCoverage: 90,
        validityDays: 365,
        reviewerNotes: reviewerNotes || undefined,
      });

      await refreshQueue();
    } catch {
      setError(`Failed to approve ${item.walletAddress}`);
    } finally {
      setBusyWallet(null);
    }
  };

  const handleReject = async (item: AdminKycRequestItem) => {
    if (!isUnlocked) return;
    setBusyWallet(item.walletAddress);
    setError(null);
    try {
      const reviewerNotes = noteByWallet[item.walletAddress]?.trim();
      await rejectKycRequestAdmin({
        adminKey: normalizedInputKey,
        walletAddress: item.walletAddress,
        reviewerNotes: reviewerNotes || undefined,
      });
      await refreshQueue();
    } catch {
      setError(`Failed to reject ${item.walletAddress}`);
    } finally {
      setBusyWallet(null);
    }
  };

  const handleReissue = async (item: AdminKycRequestItem) => {
    if (!isUnlocked) return;
    setBusyWallet(item.walletAddress);
    setError(null);
    try {
      const tier = tierByWallet[item.walletAddress] ?? 3;
      const reviewerNotes = noteByWallet[item.walletAddress]?.trim();

      await resyncKycCredentialAdmin({
        adminKey: normalizedInputKey,
        walletAddress: item.walletAddress,
        tier,
        kycLevel: tier,
        amlCoverage: 90,
        validityDays: 365,
        reviewerNotes: reviewerNotes || undefined,
      });

      await refreshQueue();
    } catch {
      setError(`Failed to reissue ${item.walletAddress}`);
    } finally {
      setBusyWallet(null);
    }
  };

  // const runSixDebug = async () => {
  //   setSixDebugLoading(true);
  //   setSixDebugError(null);
  //   try {
  //     const response = await api.get<SixDebugResponse>(
  //       "/market-data/six/debug",
  //       {
  //         params: { symbols: sixDebugSymbols },
  //       },
  //     );
  //     setSixDebugData(response.data);
  //   } catch (debugError) {
  //     setSixDebugData(null);
  //     setSixDebugError(
  //       getErrorMessage(debugError, "Failed to fetch SIX diagnostics"),
  //     );
  //   } finally {
  //     setSixDebugLoading(false);
  //   }
  // };

  return (
    <div className="space-y-6">
      {isUnlocked && (
        <section className="rounded-sm border border-vault-border bg-vault-surface p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Wallet addresses (comma-separated, optional)"
              className="w-full md:w-96 rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5 font-code text-xs text-text-primary focus:border-gold/40 focus:outline-none"
              value={resyncWalletsInput}
              onChange={(e) => setResyncWalletsInput(e.target.value)}
            />
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const wallets = resyncWalletsInput
                    .split(",")
                    .map((w: string) => w.trim())
                    .filter(Boolean);
                  await resyncKycDbFromChainAdmin(
                    normalizedInputKey,
                    wallets.length > 0 ? wallets : undefined,
                  );
                  await refreshQueue();
                } catch {
                  setError("Failed to resync DB from on-chain credentials.");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="rounded-sm bg-gold px-4 py-2.5 font-heading text-xs text-vault-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Resyncing..." : "Resync DB from On-Chain Credentials"}
            </button>
            <span className="font-body text-xs text-muted-vault">
              Enter wallet addresses for targeted resync, or leave blank for
              full DB resync.
            </span>
          </div>
        </section>
      )}
      <div>
        <h1 className="font-heading text-2xl text-gold">KYC Admin Queue</h1>
        <p className="font-body text-xs text-muted-vault">
          Review pending institutions and issue on-chain credentials.
        </p>
      </div>
      <section className="rounded-sm border border-vault-border bg-vault-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Admin API Key
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="x-admin-key"
              className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5 font-code text-xs text-text-primary focus:border-gold/40 focus:outline-none"
            />
          </div>

          <button
            onClick={() => void refreshQueue()}
            disabled={!canAttemptUnlock || loading}
            className="rounded-sm bg-gold px-4 py-2.5 font-heading text-xs text-vault-base disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "Checking..."
              : isUnlocked
                ? "Refresh Queue"
                : "Unlock Queue"}
          </button>
        </div>

        {isUnlocked && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="mb-1 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
              Status
            </label>
            <div>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as StatusFilter | "all")
                }
                className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5 font-body text-xs text-text-primary focus:border-gold/40 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                Override Approval Key
              </label>
              <input
                type="password"
                value={overrideApprovalKey}
                onChange={(e) => setOverrideApprovalKey(e.target.value)}
                placeholder="Required only for tier below recommendation"
                className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5 font-code text-xs text-text-primary focus:border-gold/40 focus:outline-none"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 font-body text-xs text-warn" role="alert">
            {error}
          </p>
        )}
      </section>
      {/* <section className="rounded-sm border border-vault-border bg-vault-surface p-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-65 flex-1">
            <label className="mb-1 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
              SIX Debug Symbols
            </label>
            <input
              type="text"
              value={sixDebugSymbols}
              onChange={(e) => setSixDebugSymbols(e.target.value)}
              placeholder="EURUSD,USDCHF,XAUUSD"
              className="w-full rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5 font-code text-xs text-text-primary focus:border-gold/40 focus:outline-none"
            />
          </div>
          <button
            onClick={() => void runSixDebug()}
            disabled={sixDebugLoading}
            className="rounded-sm border border-gold/30 bg-gold/10 px-4 py-2.5 font-heading text-xs text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sixDebugLoading ? "Running..." : "Run SIX Debug"}
          </button>
        </div>

        {sixDebugError && (
          <p className="mb-2 font-body text-xs text-warn">{sixDebugError}</p>
        )}

        {sixDebugData && (
          <div className="space-y-2 rounded-sm border border-vault-border bg-vault-elevated p-3">
            <p className="font-body text-xs text-muted-vault">
              Ready: {String(sixDebugData.ready)}
              {sixDebugData.reason ? ` · ${sixDebugData.reason}` : ""}
            </p>
            <p className="font-body text-xs text-muted-vault">
              Requested IDs: {sixDebugData.request?.valorIds?.length ?? 0}
              {" · "}
              Parsed: {sixDebugData.extraction?.parsedQuoteCount ?? 0}
              {" · "}
              Matched: {sixDebugData.extraction?.matchedValorIds?.length ?? 0}
              {" · "}
              Unmatched:{" "}
              {sixDebugData.extraction?.unmatchedValorIds?.length ?? 0}
            </p>
            <p className="font-body text-[11px] text-text-primary break-all">
              Root: {sixDebugData.payload?.rootType ?? "n/a"}
              {" · Keys: "}
              {(sixDebugData.payload?.rootKeys ?? []).slice(0, 8).join(", ") ||
                "n/a"}
            </p>
            {sixDebugData.extraction?.unmatchedValorIds?.length ? (
              <p className="font-code text-[11px] text-warn break-all">
                Unmatched IDs:{" "}
                {sixDebugData.extraction.unmatchedValorIds.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </section> */}
      <section className="space-y-3">
        {!isUnlocked ? (
          <div className="rounded-sm border border-vault-border bg-vault-surface p-5 font-body text-xs text-muted-vault">
            Enter admin key and click Unlock Queue to load requests.
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-sm border border-vault-border bg-vault-surface p-5 font-body text-xs text-muted-vault">
            No requests found for this filter.
          </div>
        ) : (
          sortedItems.map((item, index) => {
            const currentTier = tierByWallet[item.walletAddress] ?? 3;
            const isBusy = busyWallet === item.walletAddress;
            const isPending =
              item.status === "pending" || item.status === "under_review";

            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
                className="rounded-sm border border-vault-border bg-vault-surface p-4"
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-sm text-text-primary">
                        {item.institutionName}
                      </h2>
                      <span className="rounded-sm border border-vault-border bg-vault-elevated px-2 py-0.5 font-code text-[10px] text-muted-vault">
                        {item.status}
                      </span>
                    </div>
                    <p className="font-code text-[11px] text-muted-vault">
                      {formatAddress(item.walletAddress, 8)}
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-body text-[11px] text-muted-vault sm:grid-cols-4">
                      <p>Jurisdiction: {item.jurisdiction ?? "Unknown"}</p>
                      <p>Role: {item.role ?? "Unknown"}</p>
                      <p>Email: {item.email ?? "Unknown"}</p>
                      <p>
                        Submitted: {formatDate(item.createdAt, "MMM dd, HH:mm")}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 font-body text-[11px] text-muted-vault">
                      <p>
                        AML: {item.amlStatus}
                        {item.amlRiskScore !== null
                          ? ` · Risk ${item.amlRiskScore}`
                          : " · Risk unavailable"}
                        {item.amlScreenedAt
                          ? ` · ${formatDate(item.amlScreenedAt, "MMM dd, HH:mm")}`
                          : ""}
                      </p>
                      <p>
                        Recommended Tier: {item.recommendedTier}
                        {item.requiresManualReview ? " · Manual review" : ""}
                      </p>
                      {item.tierRecommendationReasons?.length > 0 && (
                        <p>{item.tierRecommendationReasons.join("; ")}</p>
                      )}
                    </div>

                    {item.latestCredentialTxHash && (
                      <p className="font-body text-[11px] text-muted-vault">
                        Latest credential tx:{" "}
                        <a
                          href={getSolanaExplorerTxUrl(
                            item.latestCredentialTxHash,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {formatAddress(item.latestCredentialTxHash, 8)}
                        </a>
                        {item.latestCredentialTxAt
                          ? ` (${formatDate(item.latestCredentialTxAt, "MMM dd, HH:mm")})`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 lg:w-72">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={currentTier}
                        onChange={(e) =>
                          setTierByWallet((prev) => ({
                            ...prev,
                            [item.walletAddress]: Number(e.target.value) as
                              | 1
                              | 2
                              | 3,
                          }))
                        }
                        className="rounded-sm border border-vault-border bg-vault-elevated px-2.5 py-2 font-body text-xs text-text-primary focus:border-gold/40 focus:outline-none"
                      >
                        <option value={1}>Tier 1</option>
                        <option value={2}>Tier 2</option>
                        <option value={3}>Tier 3</option>
                      </select>

                      <input
                        value={noteByWallet[item.walletAddress] ?? ""}
                        onChange={(e) =>
                          setNoteByWallet((prev) => ({
                            ...prev,
                            [item.walletAddress]: e.target.value,
                          }))
                        }
                        placeholder="Reviewer note"
                        className="rounded-sm border border-vault-border bg-vault-elevated px-2.5 py-2 font-body text-xs text-text-primary placeholder:text-muted-vault/50 focus:border-gold/40 focus:outline-none"
                      />
                    </div>

                    {isPending ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void handleApprove(item)}
                          disabled={isBusy}
                          className="rounded-sm bg-ok/20 px-3 py-2 font-heading text-xs text-ok disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isBusy ? "Working..." : "Approve"}
                        </button>
                        <button
                          onClick={() => void handleReject(item)}
                          disabled={isBusy}
                          className="rounded-sm bg-warn/20 px-3 py-2 font-heading text-xs text-warn disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isBusy ? "Working..." : "Reject"}
                        </button>
                      </div>
                    ) : item.status === "approved" ? (
                      <button
                        onClick={() => void handleReissue(item)}
                        disabled={isBusy}
                        className="w-full rounded-sm bg-gold/20 px-3 py-2 font-heading text-xs text-gold transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isBusy ? "Working..." : "Reissue Credential"}
                      </button>
                    ) : (
                      <div className="rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-muted-vault">
                        No admin action for this status
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </section>
    </div>
  );
}
