import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("compliance")
@Controller("compliance")
export class ComplianceController {
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
