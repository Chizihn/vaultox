import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getSettings(@WalletAddress() walletAddress: string) {
    return this.settingsService.getSettings(walletAddress);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateSettings(
    @WalletAddress() walletAddress: string,
    @Body() data: Record<string, any>,
  ) {
    return this.settingsService.updateSettings(walletAddress, data);
  }

  @Get("notifications")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getNotificationPreferences(@WalletAddress() walletAddress: string) {
    return this.settingsService.getNotificationPreferences(walletAddress);
  }

  @Patch("notifications")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateNotificationPreferences(
    @WalletAddress() walletAddress: string,
    @Body() data: Record<string, any>,
  ) {
    return this.settingsService.updateNotificationPreferences(
      walletAddress,
      data,
    );
  }

  @Get("api-keys")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getApiKeys(@WalletAddress() walletAddress: string) {
    return this.settingsService.getApiKeys(walletAddress);
  }

  @Post("api-keys")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createApiKey(
    @WalletAddress() walletAddress: string,
    @Body() data: { name?: string },
  ) {
    return this.settingsService.createApiKey(
      walletAddress,
      data?.name ?? "VaultOX API Key",
    );
  }

  @Delete("api-keys/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  revokeApiKey(
    @WalletAddress() walletAddress: string,
    @Param("id") id: string,
  ) {
    this.settingsService.revokeApiKey(walletAddress, id);
    return { success: true };
  }

  @Get("connected-wallets")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getConnectedWallets(@WalletAddress() walletAddress: string) {
    return this.settingsService.getConnectedWallets(walletAddress);
  }

  @Post("connected-wallets")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  linkWallet(
    @WalletAddress() walletAddress: string,
    @Body() data: { wallet: string; label: string },
  ) {
    return this.settingsService.linkWallet(walletAddress, data);
  }

  @Delete("connected-wallets/:wallet")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unlinkWallet(
    @WalletAddress() walletAddress: string,
    @Param("wallet") linkedWallet: string,
  ) {
    this.settingsService.unlinkWallet(walletAddress, linkedWallet);
    return { success: true };
  }

  @Patch("risk-limits")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateRiskLimits(
    @WalletAddress() walletAddress: string,
    @Body()
    data: {
      maxSingleSettlementUsd: number;
      dailySettlementLimitUsd?: number;
    },
  ) {
    return this.settingsService.updateRiskLimits(walletAddress, data);
  }
}
