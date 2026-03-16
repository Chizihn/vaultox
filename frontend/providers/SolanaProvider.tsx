"use client";

import React from "react";
import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

const client = createClient({
  endpoint: "https://api.devnet.solana.com",
  websocketEndpoint: "wss://api.devnet.solana.com",
  walletConnectors: autoDiscover(),
});

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
