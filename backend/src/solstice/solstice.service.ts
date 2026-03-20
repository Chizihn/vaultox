/**
 * backend/src/solstice/solstice.service.ts
 * ──────────────────────────────────────────
 * Solstice USX API integration service.
 * Calls Solstice HTTP API to build mint/redeem/yield instructions.
 */

import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PublicKey, AccountMeta } from "@solana/web3.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface SolanaInstruction {
  programId: PublicKey;
  keys: AccountMeta[];
  data: Buffer;
}

interface SolsticeInstructionRequest {
  type:
    | "RequestMint"
    | "ConfirmMint"
    | "CancelMint"
    | "RequestRedeem"
    | "ConfirmRedeem"
    | "CancelRedeem"
    | "Lock"
    | "Unlock"
    | "Withdraw";
  data: Record<string, unknown>;
}

interface SolsticeInstructionResponse {
  instruction: {
    program_id: number[];
    accounts: Array<{
      pubkey: number[];
      is_signer: boolean;
      is_writable: boolean;
    }>;
    data: number[];
  };
}

type CollateralKind = "usdc" | "usdt";

@Injectable()
export class SolsticeService {
  private readonly logger = new Logger(SolsticeService.name);
  private readonly apiKey = process.env.SOLSTICE_API_KEY || "";
  private readonly apiUrl =
    process.env.SOLSTICE_API_URL || "https://instructions.solstice.finance";

  // Devnet mint addresses
  readonly mints = {
    usdc: "8iBux2LRja1PhVZph8Rw4Hi45pgkaufNEiaZma5nTD5g",
    usdt: "5dXXpWyZCCPhBHxmp79Du81t7t9oh7HacUW864ARFyft",
    usx: "7QC4zjrKA6XygpXPQCKSS9BmAsEFDJR6awiHSdgLcDvS",
    eusx: "Gkt9h4QWpPBDtbaF5HvYKCc87H5WCRTUtMf77HdTGHBt",
  };

  constructor() {
    if (!this.apiKey) {
      this.logger.warn(
        "SOLSTICE_API_KEY not set; Solstice API calls will fail",
      );
    }
    this.logger.log(`Solstice service initialized. API URL: ${this.apiUrl}`);
  }

  /**
   * Request a mint instruction: USDC/USDT → USX
   * Returns serialized instruction to add to transaction.
   */
  async buildMintInstruction(
    user: string,
    amount: number,
    collateral: CollateralKind = "usdc",
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildMintInstruction] user=${user}, amount=${amount}, collateral=${collateral}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "RequestMint",
      data: {
        user,
        amount,
        collateral,
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Confirm a mint: finalize the USX minting.
   */
  async buildConfirmMintInstruction(
    user: string,
    collateral: CollateralKind = "usdc",
    usxAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildConfirmMintInstruction] user=${user}, collateral=${collateral}, usxAccount=${usxAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "ConfirmMint",
      data: {
        user,
        collateral,
        ...(usxAccount && { usx_account: usxAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Cancel a mint: revert pending mint request.
   */
  async buildCancelMintInstruction(
    user: string,
    collateral: CollateralKind = "usdc",
    collateralAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildCancelMintInstruction] user=${user}, collateral=${collateral}, collateralAccount=${collateralAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "CancelMint",
      data: {
        user,
        collateral,
        ...(collateralAccount && { collateral_account: collateralAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Request a redeem: USX → USDC/USDT
   */
  async buildRedeemInstruction(
    user: string,
    amount: number,
    collateral: CollateralKind = "usdc",
    usxAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildRedeemInstruction] user=${user}, amount=${amount}, collateral=${collateral}, usxAccount=${usxAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "RequestRedeem",
      data: {
        user,
        amount,
        collateral,
        ...(usxAccount && { usx_account: usxAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Confirm a redeem: finalize USX → collateral swap.
   */
  async buildConfirmRedeemInstruction(
    user: string,
    collateral: CollateralKind = "usdc",
    collateralAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildConfirmRedeemInstruction] user=${user}, collateral=${collateral}, collateralAccount=${collateralAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "ConfirmRedeem",
      data: {
        user,
        collateral,
        ...(collateralAccount && { collateral_account: collateralAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Lock USX into YieldVault: USX → eUSX (begins earning yield)
   */
  async buildLockInstruction(
    user: string,
    amount: number,
    usxAccount?: string,
    eusxAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildLockInstruction] user=${user}, amount=${amount}, usxAccount=${usxAccount}, eusxAccount=${eusxAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "Lock",
      data: {
        user,
        amount,
        ...(usxAccount && { usx_account: usxAccount }),
        ...(eusxAccount && { eusx_account: eusxAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Unlock eUSX from YieldVault: eUSX → USX (stop earning, prepare to redeem)
   */
  async buildUnlockInstruction(
    user: string,
    amount: number,
    eusxAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildUnlockInstruction] user=${user}, amount=${amount}, eusxAccount=${eusxAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "Unlock",
      data: {
        user,
        amount,
        ...(eusxAccount && { eusx_account: eusxAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Withdraw eUSX from YieldVault: claim earned yield and principal.
   */
  async buildWithdrawInstruction(
    user: string,
    amount: number,
    eusxAccount?: string,
    usxAccount?: string,
    payerWallet?: string,
  ): Promise<Buffer> {
    this.logger.debug(
      `[buildWithdrawInstruction] user=${user}, amount=${amount}, eusxAccount=${eusxAccount}, usxAccount=${usxAccount}, payer=${payerWallet}`,
    );
    const request: SolsticeInstructionRequest = {
      type: "Withdraw",
      data: {
        user,
        amount,
        ...(eusxAccount && { eusx_account: eusxAccount }),
        ...(usxAccount && { usx_account: usxAccount }),
        ...(payerWallet && { payer: payerWallet }),
      },
    };

    return this.buildInstruction(request);
  }

  /**
   * Generic build instruction: calls Solstice API and returns serialized instruction.
   */
  private async buildInstruction(
    request: SolsticeInstructionRequest,
  ): Promise<Buffer> {
    try {
      this.logger.debug(
        `[buildInstruction] Calling Solstice API for type=${request.type}, data=${JSON.stringify(request.data)}`,
      );

      const response = await fetch(`${this.apiUrl}/v1/instructions`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[buildInstruction] API returned ${response.status}: ${errorText}`,
        );
        throw new Error(`Solstice API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as SolsticeInstructionResponse;
      const { instruction } = data;
      this.logger.debug(
        `[buildInstruction] Successfully received instruction for type=${request.type}`,
      );

      // Convert instruction to Solana Instruction format
      // (Solstice returns raw byte arrays; we reconstruct the Instruction)
      const serialized = this.reconstructInstruction(instruction);
      this.logger.debug(
        `[buildInstruction] Reconstructed instruction, size=${serialized.length} bytes`,
      );
      return serialized;
    } catch (error) {
      this.logger.error(
        `Solstice API error (${request.type}):`,
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        `Failed to build Solstice instruction: ${request.type}`,
      );
    }
  }

  /**
   * Reconstruct a Solana Instruction from Solstice API response.
   * The API returns accounts, data, and program_id as byte arrays.
   */
  private reconstructInstruction(
    instructionData: SolsticeInstructionResponse["instruction"],
  ): Buffer {
    // Convert accounts and data to Solana Instruction format
    // This is a simplified reconstruction; adjust based on exact format needed
    this.logger.debug(
      `[reconstructInstruction] Reconstructing instruction with ${instructionData.accounts.length} accounts`,
    );

    const programId = Buffer.from(instructionData.program_id);
    this.logger.debug(
      `[reconstructInstruction] Program ID: ${programId.toString("hex").substring(0, 16)}...`,
    );

    const accountsData = Buffer.concat(
      instructionData.accounts.map((acc, idx) => {
        const pubkey = Buffer.from(acc.pubkey);
        const isSigner = Buffer.from([acc.is_signer ? 1 : 0]);
        const isWritable = Buffer.from([acc.is_writable ? 1 : 0]);
        this.logger.debug(
          `[reconstructInstruction] Account ${idx}: pubkey=${pubkey.toString("hex").substring(0, 16)}..., signer=${acc.is_signer}, writable=${acc.is_writable}`,
        );
        return Buffer.concat([pubkey, isSigner, isWritable]);
      }),
    );
    const data = Buffer.from(instructionData.data);
    this.logger.debug(
      `[reconstructInstruction] Instruction data size: ${data.length} bytes`,
    );

    // Pack: 32 bytes program_id + accounts + data
    return Buffer.concat([programId, accountsData, data]);
  }

  /**
   * Convert Solstice API instruction response to a proper Solana Instruction object.
   * Ready to add to a Transaction.
   */
  private toSolanaInstruction(
    instructionData: SolsticeInstructionResponse["instruction"],
  ): SolanaInstruction {
    this.logger.debug(
      `[toSolanaInstruction] Converting API response to Solana Instruction`,
    );

    const programId = new PublicKey(instructionData.program_id);
    const keys: AccountMeta[] = instructionData.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.is_signer,
      isWritable: acc.is_writable,
    }));
    const data = Buffer.from(instructionData.data);

    this.logger.debug(
      `[toSolanaInstruction] Created Instruction with ${keys.length} account metas, data size: ${data.length} bytes`,
    );
    return {
      programId,
      keys,
      data,
    };
  }

  /**
   * Convenience: Build a full deposit flow (USDC → USX → eUSX)
   * Returns array of instructions to add to transaction.
   */
  async buildDepositFlow(
    userWallet: string,
    amount: number,
    backendSigner: string,
  ): Promise<Buffer[]> {
    const instructions: Buffer[] = [];

    try {
      this.logger.log(
        `[buildDepositFlow] Starting deposit flow for user=${userWallet}, amount=${amount}`,
      );

      // Step 1: Request mint (USDC → USX)
      this.logger.log(
        `[buildDepositFlow] Step 1/3: Building RequestMint instruction...`,
      );
      const mintInst = await this.buildMintInstruction(
        userWallet,
        amount,
        "usdc",
        backendSigner,
      );
      instructions.push(mintInst);
      this.logger.log(
        `[buildDepositFlow] Step 1 complete: RequestMint instruction added`,
      );

      // Step 2: Confirm mint
      this.logger.log(
        `[buildDepositFlow] Step 2/3: Building ConfirmMint instruction...`,
      );
      const confirmInst = await this.buildConfirmMintInstruction(
        userWallet,
        "usdc",
        undefined,
        backendSigner,
      );
      instructions.push(confirmInst);
      this.logger.log(
        `[buildDepositFlow] Step 2 complete: ConfirmMint instruction added`,
      );

      // Step 3: Lock into yield vault (USX → eUSX)
      this.logger.log(
        `[buildDepositFlow] Step 3/3: Building Lock instruction...`,
      );
      const lockInst = await this.buildLockInstruction(
        userWallet,
        amount,
        undefined,
        undefined,
        backendSigner,
      );
      instructions.push(lockInst);
      this.logger.log(
        `[buildDepositFlow] Step 3 complete: Lock instruction added`,
      );

      this.logger.log(
        `[buildDepositFlow] Deposit flow complete. Total instructions: ${instructions.length}`,
      );
      return instructions;
    } catch (error) {
      this.logger.error(
        "Failed to build deposit flow:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Convenience: Build a full withdrawal flow (eUSX → USX → USDC)
   */
  async buildWithdrawalFlow(
    userWallet: string,
    amount: number,
    backendSigner: string,
  ): Promise<Buffer[]> {
    const instructions: Buffer[] = [];

    try {
      this.logger.log(
        `[buildWithdrawalFlow] Starting withdrawal flow for user=${userWallet}, amount=${amount}`,
      );

      // Step 1: Unlock from yield vault (eUSX → USX)
      this.logger.log(
        `[buildWithdrawalFlow] Step 1/4: Building Unlock instruction...`,
      );
      const unlockInst = await this.buildUnlockInstruction(
        userWallet,
        amount,
        undefined,
        backendSigner,
      );
      instructions.push(unlockInst);
      this.logger.log(
        `[buildWithdrawalFlow] Step 1 complete: Unlock instruction added`,
      );

      // Step 2: Withdraw earned yield
      this.logger.log(
        `[buildWithdrawalFlow] Step 2/4: Building Withdraw instruction...`,
      );
      const withdrawInst = await this.buildWithdrawInstruction(
        userWallet,
        amount,
        undefined,
        undefined,
        backendSigner,
      );
      instructions.push(withdrawInst);
      this.logger.log(
        `[buildWithdrawalFlow] Step 2 complete: Withdraw instruction added`,
      );

      // Step 3: Redeem USX back to USDC
      this.logger.log(
        `[buildWithdrawalFlow] Step 3/4: Building RequestRedeem instruction...`,
      );
      const redeemInst = await this.buildRedeemInstruction(
        userWallet,
        amount,
        "usdc",
        undefined,
        backendSigner,
      );
      instructions.push(redeemInst);
      this.logger.log(
        `[buildWithdrawalFlow] Step 3 complete: RequestRedeem instruction added`,
      );

      // Step 4: Confirm redeem
      this.logger.log(
        `[buildWithdrawalFlow] Step 4/4: Building ConfirmRedeem instruction...`,
      );
      const confirmInst = await this.buildConfirmRedeemInstruction(
        userWallet,
        "usdc",
        undefined,
        backendSigner,
      );
      instructions.push(confirmInst);
      this.logger.log(
        `[buildWithdrawalFlow] Step 4 complete: ConfirmRedeem instruction added`,
      );

      this.logger.log(
        `[buildWithdrawalFlow] Withdrawal flow complete. Total instructions: ${instructions.length}`,
      );
      return instructions;
    } catch (error) {
      this.logger.error(
        "Failed to build withdrawal flow:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Build deposit flow and return array of Solana Instruction objects (ready to add to Transaction).
   * Orchestrates: RequestMint → ConfirmMint → Lock
   */
  async buildDepositFlowInstructions(
    userWallet: string,
    amount: number,
    payerWallet?: string,
  ): Promise<SolanaInstruction[]> {
    this.logger.log(
      `[buildDepositFlowInstructions] Building deposit flow instructions for user=${userWallet}, amount=${amount}`,
    );
    const instructions: SolanaInstruction[] = [];

    try {
      // Step 1: Request mint (USDC → USX)
      this.logger.log(
        `[buildDepositFlowInstructions] Step 1/3: Building RequestMint instruction...`,
      );
      const mintRequest: SolsticeInstructionRequest = {
        type: "RequestMint",
        data: {
          user: userWallet,
          amount,
          collateral: "usdc",
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const mintResponse = await this.fetchInstructionFromApi(mintRequest);
      instructions.push(this.toSolanaInstruction(mintResponse.instruction));
      this.logger.log(
        `[buildDepositFlowInstructions] Step 1 complete: RequestMint instruction added`,
      );

      // Step 2: Confirm mint
      this.logger.log(
        `[buildDepositFlowInstructions] Step 2/3: Building ConfirmMint instruction...`,
      );
      const confirmRequest: SolsticeInstructionRequest = {
        type: "ConfirmMint",
        data: {
          user: userWallet,
          collateral: "usdc",
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const confirmResponse =
        await this.fetchInstructionFromApi(confirmRequest);
      instructions.push(this.toSolanaInstruction(confirmResponse.instruction));
      this.logger.log(
        `[buildDepositFlowInstructions] Step 2 complete: ConfirmMint instruction added`,
      );

      // Step 3: Lock into yield vault (USX → eUSX)
      this.logger.log(
        `[buildDepositFlowInstructions] Step 3/3: Building Lock instruction...`,
      );
      const lockRequest: SolsticeInstructionRequest = {
        type: "Lock",
        data: {
          user: userWallet,
          amount,
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const lockResponse = await this.fetchInstructionFromApi(lockRequest);
      instructions.push(this.toSolanaInstruction(lockResponse.instruction));
      this.logger.log(
        `[buildDepositFlowInstructions] Step 3 complete: Lock instruction added`,
      );

      this.logger.log(
        `[buildDepositFlowInstructions] Complete. Total Solana instructions: ${instructions.length}`,
      );
      return instructions;
    } catch (error) {
      this.logger.error(
        "Failed to build deposit flow instructions:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Build withdrawal flow and return array of Solana Instruction objects (ready to add to Transaction).
   * Orchestrates: Unlock → Withdraw → RequestRedeem → ConfirmRedeem
   */
  async buildWithdrawalFlowInstructions(
    userWallet: string,
    amount: number,
    payerWallet?: string,
  ): Promise<SolanaInstruction[]> {
    this.logger.log(
      `[buildWithdrawalFlowInstructions] Building withdrawal flow instructions for user=${userWallet}, amount=${amount}`,
    );
    const instructions: SolanaInstruction[] = [];

    try {
      // Step 1: Unlock from yield vault (eUSX → USX)
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 1/4: Building Unlock instruction...`,
      );
      const unlockRequest: SolsticeInstructionRequest = {
        type: "Unlock",
        data: {
          user: userWallet,
          amount,
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const unlockResponse = await this.fetchInstructionFromApi(unlockRequest);
      instructions.push(this.toSolanaInstruction(unlockResponse.instruction));
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 1 complete: Unlock instruction added`,
      );

      // Step 2: Withdraw earned yield
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 2/4: Building Withdraw instruction...`,
      );
      const withdrawRequest: SolsticeInstructionRequest = {
        type: "Withdraw",
        data: {
          user: userWallet,
          amount,
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const withdrawResponse =
        await this.fetchInstructionFromApi(withdrawRequest);
      instructions.push(this.toSolanaInstruction(withdrawResponse.instruction));
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 2 complete: Withdraw instruction added`,
      );

      // Step 3: Redeem USX back to USDC
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 3/4: Building RequestRedeem instruction...`,
      );
      const redeemRequest: SolsticeInstructionRequest = {
        type: "RequestRedeem",
        data: {
          user: userWallet,
          amount,
          collateral: "usdc",
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const redeemResponse = await this.fetchInstructionFromApi(redeemRequest);
      instructions.push(this.toSolanaInstruction(redeemResponse.instruction));
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 3 complete: RequestRedeem instruction added`,
      );

      // Step 4: Confirm redeem
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 4/4: Building ConfirmRedeem instruction...`,
      );
      const confirmRequest: SolsticeInstructionRequest = {
        type: "ConfirmRedeem",
        data: {
          user: userWallet,
          collateral: "usdc",
          ...(payerWallet && { payer: payerWallet }),
        },
      };
      const confirmResponse =
        await this.fetchInstructionFromApi(confirmRequest);
      instructions.push(this.toSolanaInstruction(confirmResponse.instruction));
      this.logger.log(
        `[buildWithdrawalFlowInstructions] Step 4 complete: ConfirmRedeem instruction added`,
      );

      this.logger.log(
        `[buildWithdrawalFlowInstructions] Complete. Total Solana instructions: ${instructions.length}`,
      );
      return instructions;
    } catch (error) {
      this.logger.error(
        "Failed to build withdrawal flow instructions:",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Helper: Fetch raw instruction response from Solstice API without conversion.
   */
  private async fetchInstructionFromApi(
    request: SolsticeInstructionRequest,
  ): Promise<SolsticeInstructionResponse> {
    try {
      this.logger.debug(
        `[fetchInstructionFromApi] Calling Solstice API for type=${request.type}`,
      );

      const response = await fetch(`${this.apiUrl}/v1/instructions`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[fetchInstructionFromApi] API returned ${response.status}: ${errorText}`,
        );
        throw new BadRequestException({
          message: `Failed to fetch Solstice instruction: ${request.type}`,
          requestType: request.type,
          upstreamStatus: response.status,
          upstreamError: errorText,
        });
      }

      const data = (await response.json()) as SolsticeInstructionResponse;
      this.logger.debug(
        `[fetchInstructionFromApi] Successfully received instruction for type=${request.type}`,
      );
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isNetworkFetchFailure =
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("EAI_AGAIN");

      if (isNetworkFetchFailure) {
        this.logger.warn(
          `[fetchInstructionFromApi] fetch transport failed for type=${request.type}. Falling back to curl transport. Error=${errorMessage}`,
        );
        return this.fetchInstructionFromApiViaCurl(request);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Solstice API error (${request.type}):`,
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException({
        message: `Failed to fetch Solstice instruction: ${request.type}`,
        requestType: request.type,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fallback transport for environments where Node fetch cannot reach Solstice,
   * but system curl can (seen on some local/dev machines).
   */
  private async fetchInstructionFromApiViaCurl(
    request: SolsticeInstructionRequest,
  ): Promise<SolsticeInstructionResponse> {
    try {
      const endpoint = `${this.apiUrl}/v1/instructions`;
      const args = [
        "-sS",
        "--max-time",
        "25",
        "-X",
        "POST",
        endpoint,
        "-H",
        `x-api-key: ${this.apiKey}`,
        "-H",
        "Content-Type: application/json",
        "-d",
        JSON.stringify(request),
        "-w",
        "\n%{http_code}",
      ];

      const { stdout } = await execFileAsync("curl", args, {
        maxBuffer: 1024 * 1024,
      });

      const trimmed = stdout.trimEnd();
      const newlineIndex = trimmed.lastIndexOf("\n");
      const body = newlineIndex >= 0 ? trimmed.slice(0, newlineIndex) : "";
      const statusText =
        newlineIndex >= 0 ? trimmed.slice(newlineIndex + 1) : trimmed;
      const status = Number(statusText);

      if (!Number.isFinite(status)) {
        throw new Error(`Unable to parse curl HTTP status: ${statusText}`);
      }

      if (status < 200 || status >= 300) {
        throw new BadRequestException({
          message: `Failed to fetch Solstice instruction: ${request.type}`,
          requestType: request.type,
          upstreamStatus: status,
          upstreamError: body,
          transport: "curl",
        });
      }

      const parsed = JSON.parse(body) as SolsticeInstructionResponse;
      this.logger.debug(
        `[fetchInstructionFromApiViaCurl] Successfully received instruction for type=${request.type}`,
      );
      return parsed;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        message: `Failed to fetch Solstice instruction: ${request.type}`,
        requestType: request.type,
        cause: error instanceof Error ? error.message : String(error),
        transport: "curl",
      });
    }
  }
}
