import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as bs58 from "bs58";
import * as fs from "node:fs";
import * as path from "node:path";

function unwrapQuoted(value: string): string {
  const trimmed = value.trim();
  const hasDouble = trimmed.startsWith('"') && trimmed.endsWith('"');
  const hasSingle = trimmed.startsWith("'") && trimmed.endsWith("'");
  if (hasDouble || hasSingle) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readEnvVarFromDotEnv(key: string): string | undefined {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;

    const raw = trimmed.slice(key.length + 1);
    return unwrapQuoted(raw);
  }

  return undefined;
}

function parseSecretKey(raw: string): Uint8Array {
  const normalized = unwrapQuoted(raw);

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed) && parsed.every((v) => Number.isInteger(v))) {
      const bytes = Uint8Array.from(parsed as number[]);
      if (bytes.length === 64) return bytes;
      if (bytes.length === 32) return Keypair.fromSeed(bytes).secretKey;
    }
  } catch {
    // Not a JSON array; continue with base58 parsing.
  }

  const decoded = bs58.decode(normalized);
  if (decoded.length === 64) return decoded;
  if (decoded.length === 32) return Keypair.fromSeed(decoded).secretKey;

  throw new Error(
    `Unsupported BACKEND_WALLET_PRIVATE_KEY length ${decoded.length}. Expected 32 or 64 bytes.`,
  );
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function main() {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    readEnvVarFromDotEnv("SOLANA_RPC_URL") ||
    "https://api.devnet.solana.com";

  const secretRaw =
    process.env.BACKEND_WALLET_PRIVATE_KEY ||
    readEnvVarFromDotEnv("BACKEND_WALLET_PRIVATE_KEY");

  if (!secretRaw) {
    throw new Error(
      "BACKEND_WALLET_PRIVATE_KEY not found in env or backend/.env",
    );
  }

  const secretKey = parseSecretKey(secretRaw);
  const keypair = Keypair.fromSecretKey(secretKey);
  const address = keypair.publicKey.toBase58();

  console.log(`Requesting airdrop of SOL to ${address} on ${rpcUrl}...`);
  //   address- 6SepqMNJDj8FdnDi1gyg2ckJJh8ZnLm1EcNu9oLvh3aU

  const addressOnly = process.argv.includes("--address-only");
  if (addressOnly) {
    console.log(`Wallet Address: ${address}`);
    return;
  }

  const solArg = getArgValue("--sol") ?? process.argv[2] ?? "1";
  const sol = Number(solArg);

  if (!Number.isFinite(sol) || sol <= 0) {
    throw new Error(`Invalid SOL amount: ${solArg}`);
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const balanceBefore = await connection.getBalance(keypair.publicKey);

  console.log(`Wallet Address: ${address}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(
    `Balance before: ${(balanceBefore / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
  );

  if (addressOnly) {
    return;
  }

  const signature = await connection.requestAirdrop(
    keypair.publicKey,
    Math.floor(sol * LAMPORTS_PER_SOL),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  const balanceAfter = await connection.getBalance(keypair.publicKey);
  console.log(`Airdrop signature: ${signature}`);
  console.log(
    `Balance after: ${(balanceAfter / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
  );
  console.log(
    `Explorer: https://explorer.solana.com/address/${address}?cluster=devnet`,
  );
}

main().catch((error) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
