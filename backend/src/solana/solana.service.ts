import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { Program, AnchorProvider, Idl, Wallet, BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getSolanaConfig } from "../config/solana.config";
import * as bs58 from "bs58";
import { createHash } from "crypto";

const FALLBACK_PROGRAM_ID = "5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG";
const MAX_U64 = (1n << 64n) - 1n;
const vaultoxIdl = require("./idl/vaultox.json") as Record<string, unknown>;

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function discriminator(namespace: string, name: string): number[] {
  const hash = createHash("sha256").update(`${namespace}:${name}`).digest();
  return Array.from(hash.subarray(0, 8));
}

function normalizeIdlType(typeValue: unknown): unknown {
  if (typeof typeValue === "string") {
    return typeValue === "publicKey" ? "pubkey" : typeValue;
  }

  if (!typeValue || typeof typeValue !== "object" || Array.isArray(typeValue)) {
    return typeValue;
  }

  const raw = typeValue as Record<string, unknown>;

  if ("defined" in raw) {
    const defined = raw.defined;
    if (typeof defined === "string") {
      return { defined: { name: defined } };
    }

    if (defined && typeof defined === "object" && !Array.isArray(defined)) {
      const value = defined as Record<string, unknown>;
      if (typeof value.name === "string") {
        return { defined: value };
      }
    }
  }

  if ("option" in raw) {
    return { option: normalizeIdlType(raw.option) };
  }

  if ("coption" in raw) {
    return { coption: normalizeIdlType(raw.coption) };
  }

  if ("vec" in raw) {
    return { vec: normalizeIdlType(raw.vec) };
  }

  if ("array" in raw && Array.isArray(raw.array) && raw.array.length === 2) {
    return {
      array: [normalizeIdlType(raw.array[0]), raw.array[1]],
    };
  }

  return raw;
}

function normalizeDefinedFields(fields: unknown): unknown {
  if (!Array.isArray(fields)) {
    return fields;
  }

  if (fields.length === 0) {
    return [];
  }

  const first = fields[0];
  const isNamedField =
    first &&
    typeof first === "object" &&
    !Array.isArray(first) &&
    "name" in first &&
    "type" in first;

  if (isNamedField) {
    return fields.map((field) => {
      const value = field as Record<string, unknown>;
      return {
        ...value,
        type: normalizeIdlType(value.type),
      };
    });
  }

  return fields.map((field) => normalizeIdlType(field));
}

function normalizeTypeDef(typeDef: Record<string, unknown>) {
  const type = typeDef.type as Record<string, unknown>;
  const kind = type?.kind;

  if (kind === "struct") {
    return {
      ...typeDef,
      type: {
        ...type,
        fields: normalizeDefinedFields(type.fields),
      },
    };
  }

  if (kind === "enum" && Array.isArray(type.variants)) {
    return {
      ...typeDef,
      type: {
        ...type,
        variants: type.variants.map((variant) => {
          const value = variant as Record<string, unknown>;
          return {
            ...value,
            fields: normalizeDefinedFields(value.fields),
          };
        }),
      },
    };
  }

  if (kind === "type") {
    return {
      ...typeDef,
      type: {
        ...type,
        alias: normalizeIdlType(type.alias),
      },
    };
  }

  return typeDef;
}

function normalizeInstructionAccount(accountValue: unknown): unknown {
  if (
    !accountValue ||
    typeof accountValue !== "object" ||
    Array.isArray(accountValue)
  ) {
    return accountValue;
  }

  const account = accountValue as Record<string, unknown>;
  const nestedAccounts = Array.isArray(account.accounts)
    ? account.accounts.map((nested) => normalizeInstructionAccount(nested))
    : undefined;

  if (nestedAccounts) {
    return {
      name: account.name,
      accounts: nestedAccounts,
    };
  }

  return {
    name: account.name,
    writable: Boolean(account.writable ?? account.isMut),
    signer: Boolean(account.signer ?? account.isSigner),
    optional: Boolean(account.optional),
  };
}

function normalizeLegacyInstruction(instruction: Record<string, unknown>) {
  const name = typeof instruction.name === "string" ? instruction.name : "";
  const args = Array.isArray(instruction.args)
    ? instruction.args.map((arg) => {
        const value = arg as Record<string, unknown>;
        return {
          ...value,
          type: normalizeIdlType(value.type),
        };
      })
    : [];
  const accounts = Array.isArray(instruction.accounts)
    ? instruction.accounts.map((acc) => normalizeInstructionAccount(acc))
    : [];

  return {
    name,
    discriminator: discriminator("global", toSnakeCase(name)),
    accounts,
    args,
  };
}

function normalizeLegacyIdl(
  legacyIdl: Record<string, unknown>,
  address: string,
): Idl {
  const legacyInstructions = Array.isArray(legacyIdl.instructions)
    ? (legacyIdl.instructions as Record<string, unknown>[])
    : [];
  const legacyAccounts = Array.isArray(legacyIdl.accounts)
    ? (legacyIdl.accounts as Record<string, unknown>[])
    : [];
  const legacyTypes = Array.isArray(legacyIdl.types)
    ? (legacyIdl.types as Record<string, unknown>[])
    : [];

  const accountTypeDefs = legacyAccounts
    .filter((account) => {
      return (
        typeof account.name === "string" &&
        !!account.type &&
        typeof account.type === "object"
      );
    })
    .map((account) => ({
      name: account.name,
      type: normalizeTypeDef({ type: account.type }).type,
    }));

  const mergedTypes = new Map<string, Record<string, unknown>>();
  for (const typeDef of [...legacyTypes, ...accountTypeDefs]) {
    if (typeof typeDef.name !== "string") {
      continue;
    }
    mergedTypes.set(typeDef.name, normalizeTypeDef(typeDef));
  }

  const normalizedAccounts = legacyAccounts
    .filter((account) => typeof account.name === "string")
    .map((account) => ({
      name: account.name,
      discriminator: discriminator("account", String(account.name)),
    }));

  const normalizedInstructions = legacyInstructions
    .map((instruction) => normalizeLegacyInstruction(instruction))
    .filter((instruction) => {
      return (
        typeof instruction.name === "string" && instruction.name.length > 0
      );
    });

  return {
    address,
    metadata: {
      name: typeof legacyIdl.name === "string" ? legacyIdl.name : "vaultox",
      version:
        typeof legacyIdl.version === "string" ? legacyIdl.version : "0.1.0",
      spec: "0.1.0",
    },
    instructions: normalizedInstructions as Idl["instructions"],
    accounts: normalizedAccounts as Idl["accounts"],
    types: Array.from(mergedTypes.values()) as Idl["types"],
    errors: Array.isArray(legacyIdl.errors)
      ? (legacyIdl.errors as Idl["errors"])
      : undefined,
  } as Idl;
}

interface AnchorNumeric {
  toNumber(): number;
}

interface AnchorProgramAccount<TAccount> {
  publicKey: PublicKey;
  account: TAccount;
}

interface ComplianceCredentialAccount {
  wallet: PublicKey;
  institutionName: number[];
  jurisdiction: number[];
  tier: number;
  kycLevel: number;
  amlCoverage: number;
  issuedAt: AnchorNumeric;
  expiresAt: AnchorNumeric;
  attestationHash: number[];
  status: number;
  bump: number;
}

interface VaultStrategyAccount {
  id: number[];
  name: number[];
  apyBps: AnchorNumeric;
  minDeposit: AnchorNumeric;
  maxCapacity: AnchorNumeric;
  currentTvl: AnchorNumeric;
  riskTier: number;
  lockupDays: number;
  isActive: boolean;
  vaultTokenAccount: PublicKey;
  bump: number;
}

interface VaultPositionAccount {
  wallet: PublicKey;
  strategy: PublicKey;
  depositedAmount: AnchorNumeric;
  currentValue: AnchorNumeric;
  accruedYield: AnchorNumeric;
  openedAt: AnchorNumeric;
  bump: number;
  status: number;
}

interface VaultoxProgramAccounts {
  complianceCredential: {
    fetch: (address: PublicKey) => Promise<ComplianceCredentialAccount>;
  };
  vaultStrategy: {
    all: () => Promise<AnchorProgramAccount<VaultStrategyAccount>[]>;
    fetch: (address: PublicKey) => Promise<VaultStrategyAccount>;
  };
  vaultPosition: {
    all: () => Promise<AnchorProgramAccount<VaultPositionAccount>[]>;
    fetch: (address: PublicKey) => Promise<VaultPositionAccount>;
  };
}

interface SettlementTravelRuleInput {
  originatorName: string;
  originatorAddress: string;
  originatorAccountId: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryAccountId: string;
  purposeCode: string;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  public connection: Connection;
  public program: Program;
  public provider: AnchorProvider;
  public backendWallet: Keypair;
  public usdcMint: PublicKey;

  private get accounts(): VaultoxProgramAccounts {
    return this.program.account as unknown as VaultoxProgramAccounts;
  }

  private resolveProgramId(config: ReturnType<typeof getSolanaConfig>): string {
    const idlAddress =
      typeof vaultoxIdl.address === "string" ? vaultoxIdl.address : undefined;
    const candidates = [
      idlAddress,
      config.vaultProgramId,
      config.complianceProgramId,
      config.settlementProgramId,
      FALLBACK_PROGRAM_ID,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        return new PublicKey(candidate).toBase58();
      } catch {
        this.logger.warn(
          `Skipping invalid Solana program ID candidate: ${candidate}`,
        );
      }
    }

    throw new Error(
      "Unable to resolve a valid Solana program ID. Set VAULT_PROGRAM_ID to a valid base58 public key.",
    );
  }

  private unwrapQuotedEnvValue(value: string): string {
    const trimmed = value.trim();
    const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
    const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");

    if (hasDoubleQuotes || hasSingleQuotes) {
      return trimmed.slice(1, -1).trim();
    }

    return trimmed;
  }

  private parseSecretKeyArray(value: string): Uint8Array | null {
    const candidates = [value];

    if (!value.startsWith("[") && !value.endsWith("]") && value.includes(",")) {
      candidates.push(`[${value}]`);
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (!Array.isArray(parsed)) {
          continue;
        }

        const isByteArray = parsed.every(
          (entry) =>
            Number.isInteger(entry) &&
            Number(entry) >= 0 &&
            Number(entry) <= 255,
        );
        if (!isByteArray) {
          continue;
        }

        const keyBytes = Uint8Array.from(parsed as number[]);
        if (keyBytes.length === 64) {
          return keyBytes;
        }

        if (keyBytes.length === 32) {
          return Keypair.fromSeed(keyBytes).secretKey;
        }
      } catch {
        // Ignore invalid JSON and continue checking other formats.
      }
    }

    return null;
  }

  private parseBackendWalletSecretKey(rawKey: string): Uint8Array {
    const normalized = this.unwrapQuotedEnvValue(rawKey);

    const arrayKey = this.parseSecretKeyArray(normalized);
    if (arrayKey) {
      return arrayKey;
    }

    const decoded = bs58.decode(normalized);
    if (decoded.length === 64) {
      return decoded;
    }

    if (decoded.length === 32) {
      return Keypair.fromSeed(decoded).secretKey;
    }

    throw new Error(
      `Unsupported secret key length ${decoded.length}. Expected 32 or 64 bytes.`,
    );
  }

  private parseU64(
    value: string | number,
    fieldName: string,
    allowZero = false,
  ): BN {
    const normalized =
      typeof value === "number"
        ? Number.isFinite(value)
          ? Math.trunc(value).toString()
          : ""
        : value.trim();

    if (!/^\d+$/.test(normalized)) {
      throw new Error(`${fieldName} must be a positive integer.`);
    }

    const amount = BigInt(normalized);
    if ((allowZero && amount < 0n) || (!allowZero && amount <= 0n)) {
      throw new Error(`${fieldName} must be greater than zero.`);
    }

    if (amount > MAX_U64) {
      throw new Error(`${fieldName} exceeds u64 max value.`);
    }

    return new BN(amount.toString());
  }

  private toFixedUtf8Bytes(value: string, size: number): number[] {
    const buffer = Buffer.alloc(size);
    const encoded = Buffer.from(value ?? "", "utf8");
    encoded.copy(buffer, 0, 0, Math.min(encoded.length, size));
    return Array.from(buffer);
  }

  private toHash32Bytes(value: string): number[] {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Array.from(Buffer.from(trimmed, "hex"));
    }

    return Array.from(createHash("sha256").update(trimmed).digest());
  }

  private getPositionPda(
    walletAddress: PublicKey,
    strategyAddress: PublicKey,
  ): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        walletAddress.toBuffer(),
        strategyAddress.toBuffer(),
      ],
      this.program.programId,
    );
    return pda;
  }

  private getSettlementPda(seed: Buffer): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement"), seed],
      this.program.programId,
    );
    return pda;
  }

  private getEscrowPda(seed: Buffer): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), seed],
      this.program.programId,
    );
    return pda;
  }

  private async getStrategyMint(strategy: VaultStrategyAccount) {
    const vaultTokenAccount = await getAccount(
      this.connection,
      strategy.vaultTokenAccount,
      "confirmed",
    );
    return vaultTokenAccount.mint;
  }

  constructor() {
    const config = getSolanaConfig();
    this.connection = new Connection(config.rpcUrl, "confirmed");

    if (!config.backendWalletKey) {
      throw new Error(
        "BACKEND_WALLET_PRIVATE_KEY must be set for live transaction assembly.",
      );
    }

    let secretKey: Uint8Array;
    try {
      secretKey = this.parseBackendWalletSecretKey(config.backendWalletKey);
    } catch {
      throw new Error(
        "Invalid BACKEND_WALLET_PRIVATE_KEY format. Supported: base58 string or [n,n,...] byte array.",
      );
    }

    this.backendWallet = Keypair.fromSecretKey(secretKey);

    try {
      this.usdcMint = new PublicKey(config.usdcMintAddress);
    } catch {
      throw new Error(
        "USDC_MINT_ADDRESS is invalid. Set a valid base58 mint address.",
      );
    }

    const anchorWallet = new Wallet(this.backendWallet);
    this.provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: "confirmed",
    });

    const programId = this.resolveProgramId(config);
    const normalizedIdl = normalizeLegacyIdl(vaultoxIdl, programId);
    this.program = new Program(normalizedIdl, this.provider);
    this.logger.log(
      `Initialized SolanaService with Program ID: ${this.program.programId.toBase58()}`,
    );
  }

  getCredentialPda(walletAddress: string): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), new PublicKey(walletAddress).toBuffer()],
      this.program.programId,
    );
    return pda;
  }

  getPositionAddress(walletAddress: string, strategyAddress: string): string {
    const wallet = new PublicKey(walletAddress);
    const strategy = new PublicKey(strategyAddress);
    return this.getPositionPda(wallet, strategy).toBase58();
  }

  async getComplianceCredential(walletAddress: string): Promise<any> {
    const pda = this.getCredentialPda(walletAddress);
    try {
      const account = await this.accounts.complianceCredential.fetch(pda);
      return account;
    } catch {
      if (process.env.DEMO_MODE === "true") {
        this.logger.debug(
          `Credential not found for ${walletAddress} (demo mode fallback active)`,
        );
      } else {
        this.logger.warn(`Credential not found for ${walletAddress}`);
      }
      return null;
    }
  }

  async getVaultStrategy(
    strategyAddress: string,
  ): Promise<VaultStrategyAccount> {
    return this.accounts.vaultStrategy.fetch(new PublicKey(strategyAddress));
  }

  async getVaultPosition(
    positionAddress: string,
  ): Promise<VaultPositionAccount> {
    return this.accounts.vaultPosition.fetch(new PublicKey(positionAddress));
  }

  async getVaultStrategies() {
    return this.accounts.vaultStrategy.all();
  }

  async getVaultPositions() {
    return this.accounts.vaultPosition.all();
  }

  async buildDepositTransaction(
    walletAddress: string,
    strategyId: string,
    amount: string | number,
  ): Promise<Transaction> {
    const wallet = new PublicKey(walletAddress);
    const strategy = new PublicKey(strategyId);
    const strategyAccount = await this.accounts.vaultStrategy.fetch(strategy);
    const amountBn = this.parseU64(amount, "deposit amount");
    const position = this.getPositionPda(wallet, strategy);
    const investorCredential = this.getCredentialPda(walletAddress);
    const mint = await this.getStrategyMint(strategyAccount);
    const institutionTokenAccount = getAssociatedTokenAddressSync(mint, wallet);

    const instruction = await (this.program as any).methods
      .deposit(amountBn)
      .accounts({
        strategy,
        position,
        institutionTokenAccount,
        vaultTokenAccount: strategyAccount.vaultTokenAccount,
        institutionWallet: wallet,
        investorCredential,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(instruction);
    tx.feePayer = wallet;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    return tx;
  }

  async buildWithdrawTransaction(
    walletAddress: string,
    positionId: string,
    amount: string | number,
  ): Promise<Transaction> {
    const wallet = new PublicKey(walletAddress);
    const position = new PublicKey(positionId);
    const amountBn = this.parseU64(amount, "withdraw amount");
    const positionAccount = await this.accounts.vaultPosition.fetch(position);

    if (!positionAccount.wallet.equals(wallet)) {
      throw new Error("Position does not belong to wallet.");
    }

    const strategy = positionAccount.strategy;
    const strategyAccount = await this.accounts.vaultStrategy.fetch(strategy);
    const mint = await this.getStrategyMint(strategyAccount);
    const institutionTokenAccount = getAssociatedTokenAddressSync(mint, wallet);

    const instruction = await (this.program as any).methods
      .withdraw(amountBn)
      .accounts({
        strategy,
        position,
        institutionTokenAccount,
        vaultTokenAccount: strategyAccount.vaultTokenAccount,
        institutionWallet: wallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(instruction);
    tx.feePayer = wallet;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    return tx;
  }

  async buildInitiateSettlementTransaction(payload: {
    initiatorWallet: string;
    receiverWallet: string;
    amount: string | number;
    feeAmount?: string | number;
    settlementReference: string;
    complianceHash: string;
    travelRule: SettlementTravelRuleInput;
  }): Promise<{
    tx: Transaction;
    settlementSeedHex: string;
    feeAmount: string;
  }> {
    const initiator = new PublicKey(payload.initiatorWallet);
    const receiver = new PublicKey(payload.receiverWallet);
    const amount = this.parseU64(payload.amount, "settlement amount");
    const fee = this.parseU64(payload.feeAmount ?? "0", "settlement fee", true);

    const settlementSeed = createHash("sha256")
      .update(payload.settlementReference)
      .digest()
      .subarray(0, 32);
    const settlement = this.getSettlementPda(settlementSeed);
    const escrowTokenAccount = this.getEscrowPda(settlementSeed);
    const initiatorTokenAccount = getAssociatedTokenAddressSync(
      this.usdcMint,
      initiator,
    );
    const initiatorCredential = this.getCredentialPda(payload.initiatorWallet);
    const receiverCredential = this.getCredentialPda(payload.receiverWallet);

    const params = {
      id: Array.from(settlementSeed),
      receiver,
      amount,
      fee,
      originatorName: this.toFixedUtf8Bytes(
        payload.travelRule.originatorName,
        64,
      ),
      originatorAccount: this.toFixedUtf8Bytes(
        payload.travelRule.originatorAccountId,
        34,
      ),
      originatorAddress: this.toFixedUtf8Bytes(
        payload.travelRule.originatorAddress,
        128,
      ),
      beneficiaryName: this.toFixedUtf8Bytes(
        payload.travelRule.beneficiaryName,
        64,
      ),
      beneficiaryAccount: this.toFixedUtf8Bytes(
        payload.travelRule.beneficiaryAccountId,
        34,
      ),
      purposeCode: this.toFixedUtf8Bytes(payload.travelRule.purposeCode, 4),
      complianceHash: this.toHash32Bytes(payload.complianceHash),
    };

    const instruction = await (this.program as any).methods
      .initiateSettlement(params)
      .accounts({
        settlement,
        escrowTokenAccount,
        usdcMint: this.usdcMint,
        initiatorTokenAccount,
        initiator,
        initiatorCredential,
        receiverCredential,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const tx = new Transaction().add(instruction);
    tx.feePayer = initiator;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    return {
      tx,
      settlementSeedHex: Buffer.from(settlementSeed).toString("hex"),
      feeAmount: fee.toString(),
    };
  }
}
