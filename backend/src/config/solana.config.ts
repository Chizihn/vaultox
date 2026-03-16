export const getSolanaConfig = () => ({
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  complianceProgramId:
    process.env.COMPLIANCE_REGISTRY_PROGRAM_ID ||
    "5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG",
  vaultProgramId:
    process.env.VAULT_PROGRAM_ID ||
    "5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG",
  settlementProgramId:
    process.env.SETTLEMENT_ENGINE_PROGRAM_ID ||
    "5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG",
  usdcMintAddress:
    process.env.USDC_MINT_ADDRESS ||
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  backendWalletKey: process.env.BACKEND_WALLET_PRIVATE_KEY || "",
});
