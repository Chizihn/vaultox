import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Headers,
} from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard";

@ApiTags("compliance")
@Controller("compliance")
export class ComplianceController {
  @Post("admin/resync-kyc-from-chain")
  @UseGuards(AdminApiKeyGuard)
  @ApiBearerAuth()
  async resyncKycFromChain(@Body() body: { wallets: string[] }) {
    return this.complianceService.resyncDbFromOnChainCredentials(body.wallets);
  }
  @Post("credential/upgrade-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  submitTierUpgradeRequest(@WalletAddress() wallet: string, @Body() body: any) {
    // body: { upgradeType, upgradeDocsHash, upgradeRequestedTier }
    return this.complianceService.submitTierUpgradeRequest(wallet, body);
  }
  constructor(private readonly complianceService: ComplianceService) {}

  @Get("credential")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getOwnCredential(@WalletAddress() wallet: string) {
    return this.complianceService.getCredential(wallet);
  }

  @Get("credential/:wallet")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getCredentialByWallet(@Param("wallet") wallet: string) {
    // Typically admin restricted
    return this.complianceService.getCredential(wallet);
  }

  @Post("credential/request")
  // No auth required for onboarding request
  requestAccess(@Body() body: any) {
    // Assuming body has walletAddress
    return this.complianceService.submitKycRequest(body.walletAddress, body);
  }

  @Post("credential/approve")
  @UseGuards(AdminApiKeyGuard)
  approveCredential(
    @Body() body: any,
    @Headers("x-admin-override-key") overrideApprovalKey?: string,
  ) {
    return this.complianceService.approveKycRequest(body.walletAddress, {
      reviewerNotes: body.reviewerNotes,
      tier: body.tier,
      kycLevel: body.kycLevel,
      amlCoverage: body.amlCoverage,
      validityDays: body.validityDays,
      attestationHash: body.attestationHash,
      overrideApprovalKey,
    });
  }

  @Post("credential/resync")
  @UseGuards(AdminApiKeyGuard)
  resyncCredential(@Body() body: any) {
    return this.complianceService.resyncApprovedCredential(body.walletAddress, {
      reviewerNotes: body.reviewerNotes,
      tier: body.tier,
      kycLevel: body.kycLevel,
      amlCoverage: body.amlCoverage,
      validityDays: body.validityDays,
      attestationHash: body.attestationHash,
    });
  }

  @Post("credential/reject")
  @UseGuards(AdminApiKeyGuard)
  rejectCredential(@Body() body: any) {
    return this.complianceService.rejectKycRequest(
      body.walletAddress,
      body.reviewerNotes,
    );
  }

  @Get("admin/kyc-requests")
  @UseGuards(AdminApiKeyGuard)
  listKycRequests(
    @Query("status")
    status?: "pending" | "under_review" | "approved" | "rejected",
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    return this.complianceService.listKycRequestsForReview({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("audit-events")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getAuditEvents(
    @WalletAddress() wallet: string,
    @Query("limit") limit: number,
    @Query("offset") offset: number,
  ) {
    return this.complianceService.getAuditEvents(
      wallet,
      limit || 50,
      offset || 0,
    );
  }

  @Get("audit-log")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getAuditLog(
    @WalletAddress() wallet: string,
    @Query("limit") limit: number,
    @Query("offset") offset: number,
  ) {
    return this.complianceService.getAuditEvents(
      wallet,
      limit || 50,
      offset || 0,
    );
  }

  @Get("aml/screening")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getAmlScreening(@WalletAddress() wallet: string) {
    return this.complianceService.getLatestAmlScreening(wallet);
  }

  @Post("aml/screening")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  triggerAmlScreening(@WalletAddress() wallet: string) {
    return this.complianceService.triggerAmlScreening(wallet);
  }

  @Get("counterparties")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getCounterparties(@WalletAddress() wallet: string) {
    return this.complianceService.getCounterparties(wallet);
  }
}
