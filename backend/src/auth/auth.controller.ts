import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Param,
  Delete,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ChallengeDto } from "./dto/challenge.dto";
import { VerifySignatureDto } from "./dto/verify-signature.dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

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

  @Post("request-access")
  requestAccess(@Body() body: any) {
    return this.authService.requestAccess(body);
  }

  @Delete("session")
  @HttpCode(200)
  signOut() {
    return { success: true };
  }
}
