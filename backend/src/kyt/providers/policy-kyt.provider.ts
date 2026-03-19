import { Injectable } from "@nestjs/common";
import { KytProvider } from "../kyt.provider";
import { KytAssessment, KytTransferContext } from "../kyt.types";

@Injectable()
export class PolicyKytProvider implements KytProvider {
  async assessTransfer(context: KytTransferContext): Promise<KytAssessment> {
    const blockedWallets = this.readCsvEnv("KYT_BLOCKED_WALLETS");
    const reviewWallets = this.readCsvEnv("KYT_REVIEW_WALLETS");
    const provider =
      process.env.KYT_PROVIDER_NAME?.trim() || "PolicyKytProvider";

    const fromWallet = context.fromWallet.trim().toLowerCase();
    const toWallet = context.toWallet.trim().toLowerCase();
    const amount = Number(context.amount);
    const reviewThreshold = Number(
      process.env.KYT_REVIEW_THRESHOLD_USDC ?? "500000",
    );
    const blockThreshold = Number(
      process.env.KYT_BLOCK_THRESHOLD_USDC ?? "5000000",
    );

    if (
      blockedWallets.includes(fromWallet) ||
      blockedWallets.includes(toWallet)
    ) {
      return {
        status: "blocked",
        riskScore: 95,
        provider,
        reason: "wallet_blocked_list",
        flags: [
          {
            code: "WALLET_BLOCKLIST_MATCH",
            severity: "critical",
            message: "One or more wallets matched KYT blocked list",
          },
        ],
      };
    }

    if (amount >= blockThreshold && Number.isFinite(blockThreshold)) {
      return {
        status: "blocked",
        riskScore: 92,
        provider,
        reason: "amount_block_threshold",
        flags: [
          {
            code: "AMOUNT_BLOCK_THRESHOLD",
            severity: "high",
            message: `Transfer amount exceeded block threshold (${blockThreshold})`,
          },
        ],
      };
    }

    if (
      reviewWallets.includes(fromWallet) ||
      reviewWallets.includes(toWallet) ||
      (amount >= reviewThreshold && Number.isFinite(reviewThreshold))
    ) {
      return {
        status: "review",
        riskScore: 72,
        provider,
        reason:
          reviewWallets.includes(fromWallet) || reviewWallets.includes(toWallet)
            ? "wallet_review_list"
            : "amount_review_threshold",
        flags: [
          {
            code: "MANUAL_REVIEW_REQUIRED",
            severity: "medium",
            message: "Transfer requires KYT manual review",
          },
        ],
      };
    }

    return {
      status: "cleared",
      riskScore: 18,
      provider,
      reason: "policy_cleared",
      flags: [],
    };
  }

  private readCsvEnv(name: string): string[] {
    const value = (process.env[name] ?? "").trim();
    if (!value) {
      return [];
    }

    return value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
}
