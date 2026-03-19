import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ChallengeDto } from "./dto/challenge.dto";
import { VerifySignatureDto } from "./dto/verify-signature.dto";
import { VerifyEntraAdapterDto } from "./dto/verify-entra-adapter.dto";
import { RevokeEntraBindingDto } from "./dto/entra-binding.dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("challenge")
  @HttpCode(200)
  @ApiOperation({ summary: "Issue a nonce for wallet to sign" })
  @ApiResponse({ status: 200, description: "Nonce generated" })
  getChallenge(@Body() dto: ChallengeDto) {
    return this.authService.generateChallenge(dto.walletAddress);
  }

  @Get("nonce/:wallet")
  @HttpCode(200)
  getNonce(@Param("wallet") wallet: string) {
    return this.authService.generateChallenge(wallet);
  }

  @Post("verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify signed nonce and return JWT" })
  @ApiResponse({ status: 200, description: "JWT token issued" })
  @ApiResponse({ status: 401, description: "Invalid signature" })
  verifySignature(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(
      dto.walletAddress,
      dto.signature,
      dto.nonce,
    );
  }

  @Post("verify-wallet")
  @HttpCode(200)
  verifyWallet(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(
      dto.walletAddress,
      dto.signature,
      dto.nonce,
    );
  }

  @Post("verify-entra-adapter")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Validate Entra token via JWKS signature verification and claim checks",
  })
  verifyEntraAdapter(@Body() dto: VerifyEntraAdapterDto) {
    return this.authService.verifyEntraAdapter(
      dto.token,
      dto.requestedWalletAddress,
    );
  }

  @Get("entra-binding/status/:subjectId/:walletAddress")
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(200)
  getEntraBindingStatus(
    @Param("subjectId") subjectId: string,
    @Param("walletAddress") walletAddress: string,
  ) {
    return this.authService.getEntraBindingStatus(subjectId, walletAddress);
  }

  @Post("entra-binding/revoke")
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(200)
  revokeEntraBinding(@Body() dto: RevokeEntraBindingDto) {
    return this.authService.revokeEntraBinding(dto);
  }

  @Post("request-access")
  requestAccess(@Body() body: any) {
    return this.authService.requestAccess(body);
  }

  @Get("request-access/:wallet")
  @HttpCode(200)
  getRequestAccessStatus(@Param("wallet") wallet: string) {
    return this.authService.getRequestAccessStatus(wallet);
  }

  @Post("approve-access")
  @HttpCode(200)
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({
    summary: "Approve KYC request and issue/renew on-chain credential",
  })
  approveAccess(@Body() body: any) {
    return this.authService.approveAccess(body.walletAddress, body);
  }

  @Delete("session")
  @HttpCode(200)
  signOut() {
    return { success: true };
  }
}
