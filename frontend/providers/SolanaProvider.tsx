"use client";

import React, { useEffect, useMemo, useState } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [walletConnectors, setWalletConnectors] = useState<
    ReturnType<typeof autoDiscover>
  >([]);

  useEffect(() => {
    setWalletConnectors(autoDiscover());
  }, []);

  const client = useMemo(() => {
    return createClient({
      endpoint: "https://api.devnet.solana.com",
      websocketEndpoint: "wss://api.devnet.solana.com",
      walletConnectors,
    });
  }, [walletConnectors]);

  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
