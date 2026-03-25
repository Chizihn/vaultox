import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Query,
} from "@nestjs/common";
import { VaultsService } from "./vaults.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard";
import { ActiveCredentialGuard } from "../common/guards/active-credential.guard";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("vaults")
@Controller("vaults")
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Get("strategies")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStrategies(@WalletAddress() wallet: string) {
    return this.vaultsService.getStrategies(wallet);
  }

  @Post("strategies")
  @UseGuards(JwtAuthGuard, AdminApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin only: Create a new yield strategy" })
  createStrategy(@Body() body: any) {
    return this.vaultsService.createStrategy(body);
  }

  @Get("strategies/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStrategyById(@WalletAddress() wallet: string, @Param("id") id: string) {
    return this.vaultsService.getStrategyById(wallet, id);
  }

  @Get("positions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPositions(@WalletAddress() wallet: string) {
    return this.vaultsService.getPositions(wallet);
  }

  @Get("positions/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPositionById(@WalletAddress() wallet: string, @Param("id") id: string) {
    return this.vaultsService.getPositionById(wallet, id);
  }

  @Get("portfolio/summary")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPortfolioSummary(@WalletAddress() wallet: string) {
    return this.vaultsService.getPortfolioSummary(wallet);
  }

  @Get("portfolio/allocation")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPortfolioAllocation(@WalletAddress() wallet: string) {
    return this.vaultsService.getPortfolioAllocation(wallet);
  }

  @Get("yield/history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getYieldHistory(
    @WalletAddress() wallet: string,
    @Query("strategyId") strategyId?: string,
  ) {
    return this.vaultsService.getYieldHistory(wallet, strategyId);
  }

  @Post("deposit")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Initiate deposit - returns unsigned tx" })
  deposit(@WalletAddress() wallet: string, @Body() body: any) {
    return this.vaultsService.deposit(wallet, body.strategyId, body.amount);
  }

  @Post("withdraw")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  withdraw(@WalletAddress() wallet: string, @Body() body: any) {
    return this.vaultsService.withdraw(wallet, body.positionId, body.amount);
  }

  @Post("test-solstice")
  @UseGuards(JwtAuthGuard, AdminApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Admin only: Test Solstice API connectivity and instruction building",
  })
  testSolstice(
    @WalletAddress() wallet: string,
    @Body() body: { amount?: number; walletAddress?: string },
  ) {
    return this.vaultsService.testSolsticeIntegration(
      wallet,
      body.amount || 1000,
      body.walletAddress,
    );
  }

  @Get("transactions/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get on-chain status for a submitted signature" })
  getTransactionStatus(@Query("signature") signature?: string) {
    return this.vaultsService.getTransactionStatus(signature ?? "");
  }

  @Post("transactions/record")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Record completed vault transaction for audit/history",
  })
  recordTransaction(@WalletAddress() wallet: string, @Body() body: any) {
    return this.vaultsService.recordTransaction(wallet, body);
  }

  @Post("deposit/confirm-mint")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initiate step 2a of Solstice deposit (ConfirmMint)",
  })
  confirmMint(@WalletAddress() wallet: string) {
    return this.vaultsService.depositStep2a(wallet);
  }

  @Post("deposit/lock")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initiate step 2b of Solstice deposit (Lock)",
  })
  lockVault(@WalletAddress() wallet: string, @Body() body: any) {
    return this.vaultsService.depositStep2b(wallet, body.amount);
  }

  @Post("deposit/cancel")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Solstice recovery: CancelMint — revert pending mint (collateral recovery)",
  })
  cancelMint(
    @WalletAddress() wallet: string,
    @Body() body?: { collateral?: "usdc" | "usdt" },
  ) {
    return this.vaultsService.cancelMint(wallet, body?.collateral ?? "usdc");
  }

  @Post("withdraw/request-redeem")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initiate step 2 of Solstice withdraw (RequestRedeem)",
  })
  requestRedeem(@WalletAddress() wallet: string, @Body() body: any) {
    return this.vaultsService.withdrawStep2(wallet, body.amount);
  }

  @Post("withdraw/confirm-redeem")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initiate step 3 of Solstice withdraw (ConfirmRedeem)",
  })
  confirmRedeem(@WalletAddress() wallet: string) {
    return this.vaultsService.withdrawStep3(wallet);
  }

  @Post("withdraw/cancel")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Solstice recovery: CancelRedeem — cancel pending redeem (USX position restored)",
  })
  cancelRedeem(
    @WalletAddress() wallet: string,
    @Body() body?: { collateral?: "usdc" | "usdt" },
  ) {
    return this.vaultsService.cancelRedeem(wallet, body?.collateral ?? "usdc");
  }

  @Post("transactions/submit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Co-sign and submit a partially signed transaction",
  })
  submitSignedTransaction(
    @WalletAddress() wallet: string,
    @Body() body: { partiallySignedTx: string },
  ) {
    return this.vaultsService.coSignAndSubmit(wallet, body.partiallySignedTx);
  }
}
