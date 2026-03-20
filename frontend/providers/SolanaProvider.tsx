"use client";

import React, { useEffect, useMemo, useState } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import { solanaConfig } from "@/config/solana";

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
      endpoint: solanaConfig.rpcEndpoint,
      websocketEndpoint: solanaConfig.wsEndpoint,
      walletConnectors,
    });
  }, [walletConnectors]);

  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
