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
}
