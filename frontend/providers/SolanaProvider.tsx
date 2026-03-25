"use client";

import React, { useEffect, useMemo, useState } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider, useWalletConnection } from "@solana/react-hooks";
import { solanaConfig } from "@/config/solana";
import { useAuthStore } from "@/store";

/**
 * When the browser wallet finishes auto-connect, align auth store with the live address.
 * IMPORTANT: Do not set walletAddress to null when status is not "connected" yet — on a full
 * page refresh, Solana autoConnect is async; clearing here would wipe JWT/bootstrap address
 * and hide TopNav wallet UI while the session is still valid.
 */
function WalletConnectionSync() {
  const { wallet, status } = useWalletConnection();
  const storeWalletAddress = useAuthStore((state) => state.walletAddress);
  const setWalletAddress = useAuthStore((state) => state.setWalletAddress);

  useEffect(() => {
    // Only write on stable wallet states:
    // - "connected": align store with live address
    // - "disconnected": clear store so UI/actions stop assuming a wallet exists
    if (status === "connected" && wallet?.account?.address) {
      const addr = wallet.account.address.toString();
      if (addr !== storeWalletAddress) {
        setWalletAddress(addr);
      }
      return;
    }

    if (status === "disconnected") {
      // Do not clear during transient "autoConnect" states — only on true disconnect.
      if (storeWalletAddress !== null) {
        setWalletAddress(null);
      }
    }
  }, [wallet, status, storeWalletAddress, setWalletAddress]);

  return null;
}

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Run auto-discovery immediately on the client so /login can render connectors
  // without requiring a manual refresh.
  const [walletConnectors, setWalletConnectors] = useState<
    ReturnType<typeof autoDiscover>
  >(() => autoDiscover());

  const client = useMemo(() => {
    return createClient({
      endpoint: solanaConfig.rpcEndpoint,
      websocketEndpoint: solanaConfig.wsEndpoint,
      walletConnectors,
    });
  }, [walletConnectors]);

  return (
    <SolanaProvider
      client={client}
      walletPersistence={{
        autoConnect: true,
      }}
    >
      <WalletConnectionSync />
      {children}
    </SolanaProvider>
  );
}
