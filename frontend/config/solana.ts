/**
 * frontend/config/solana.ts
 * ─────────────────────────
 * Centralized Solana network configuration driven by environment variables.
 * Prevents network mismatches across the frontend.
 */

export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta";

export interface SolanaConfig {
  cluster: SolanaCluster;
  rpcEndpoint: string;
  wsEndpoint: string;
  explorerBaseUrl: string;
}

const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ||
  "devnet") as SolanaCluster;

const CONFIG_BY_CLUSTER: Record<SolanaCluster, SolanaConfig> = {
  devnet: {
    cluster: "devnet",
    rpcEndpoint: "https://api.devnet.solana.com",
    wsEndpoint: "wss://api.devnet.solana.com",
    explorerBaseUrl: "https://explorer.solana.com",
  },
  testnet: {
    cluster: "testnet",
    rpcEndpoint: "https://api.testnet.solana.com",
    wsEndpoint: "wss://api.testnet.solana.com",
    explorerBaseUrl: "https://explorer.solana.com",
  },
  "mainnet-beta": {
    cluster: "mainnet-beta",
    rpcEndpoint: "https://api.mainnet-beta.solana.com",
    wsEndpoint: "wss://api.mainnet-beta.solana.com",
    explorerBaseUrl: "https://explorer.solana.com",
  },
};

export const solanaConfig: SolanaConfig =
  CONFIG_BY_CLUSTER[CLUSTER] || CONFIG_BY_CLUSTER.devnet;

/**
 * Build a Solana Explorer URL for a transaction.
 */
export const getSolanaExplorerTxUrl = (txHash: string) => {
  const params = new URLSearchParams();
  if (solanaConfig.cluster !== "mainnet-beta") {
    params.set("cluster", solanaConfig.cluster);
  }
  const query = params.toString();
  return `${solanaConfig.explorerBaseUrl}/tx/${txHash}${query ? "?" + query : ""}`;
};

/**
 * Build a Solana Explorer URL for an address/account.
 */
export const getSolanaExplorerAddressUrl = (address: string) => {
  const params = new URLSearchParams();
  if (solanaConfig.cluster !== "mainnet-beta") {
    params.set("cluster", solanaConfig.cluster);
  }
  const query = params.toString();
  return `${solanaConfig.explorerBaseUrl}/address/${address}${query ? "?" + query : ""}`;
};
