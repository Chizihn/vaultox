import { Controller, Get, Post, UseGuards, Param, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list(@WalletAddress() walletAddress: string, @Query("limit") limit?: string) {
    return this.notificationsService.list(
      walletAddress,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post("mark-read/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  markRead(
    @WalletAddress() walletAddress: string,
    @Param("id") notificationId: string,
  ) {
    return this.notificationsService.markRead(walletAddress, notificationId);
  }

  @Post("mark-all-read")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  markAllRead(@WalletAddress() walletAddress: string) {
    return this.notificationsService.markAllRead(walletAddress);
  }
}
