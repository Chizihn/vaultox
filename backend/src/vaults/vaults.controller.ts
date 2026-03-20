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
}
