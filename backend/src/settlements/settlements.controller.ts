import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Sse,
} from "@nestjs/common";
import { SettlementsService } from "./settlements.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ActiveCredentialGuard } from "../common/guards/active-credential.guard";
import { WalletAddress } from "../common/decorators/wallet.decorator";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("settlements")
@Controller("settlements")
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getSettlements(
    @WalletAddress() wallet: string,
    @Query("status") status: string,
  ) {
    return this.settlementsService.getSettlements(wallet, status);
  }

  @Get("live-arcs")
  getLiveArcs() {
    return this.settlementsService.getLiveArcs();
  }

  @Sse("live")
  liveSettlements(@Query("token") token?: string) {
    return this.settlementsService.streamLiveSettlements();
  }

  @Get("metrics")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMetrics(@WalletAddress() wallet: string) {
    return this.settlementsService.getMetrics(wallet);
  }

  @Get("travel-rule/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getTravelRule(@WalletAddress() wallet: string, @Param("id") id: string) {
    return this.settlementsService.getTravelRulePayload(wallet, id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getSettlementDetail(@Param("id") id: string) {
    return this.settlementsService.getSettlementDetail(id);
  }

  @Post("initiate")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  initiateSettlement(@WalletAddress() wallet: string, @Body() body: any) {
    return this.settlementsService.initiateSettlement(wallet, body);
  }

  @Post(":id/submitted")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  submitSettlementSignature(
    @WalletAddress() wallet: string,
    @Param("id") id: string,
    @Body() body: { signature?: string },
  ) {
    return this.settlementsService.submitSettlementSignature(
      wallet,
      id,
      body.signature ?? "",
    );
  }

  @Get("transactions/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getTransactionStatus(@Query("signature") signature?: string) {
    return this.settlementsService.getTransactionStatus(signature ?? "");
  }

  @Post("travel-rule/validate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  validateTravelRule(@Body() body: any) {
    return this.settlementsService.validateTravelRule(body);
  }

  @Post(":id/confirm")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  confirmSettlement(
    @WalletAddress() wallet: string,
    @Param("id") id: string,
    @Body() body: { signature?: string },
  ) {
    return this.settlementsService.confirmSettlement(
      wallet,
      id,
      body?.signature,
    );
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard, ActiveCredentialGuard)
  @ApiBearerAuth()
  cancelSettlement(@WalletAddress() wallet: string, @Param("id") id: string) {
    return this.settlementsService.cancelSettlement(wallet, id);
  }
}
