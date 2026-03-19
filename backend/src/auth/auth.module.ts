import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { getJwtConfig } from "../config/jwt.config";
import { ComplianceModule } from "../compliance/compliance.module";
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtConfig().secret,
        signOptions: getJwtConfig().signOptions,
      }),
    }),
    ComplianceModule,
    IdentityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AdminApiKeyGuard],
  exports: [AuthService],
})
export class AuthModule {}
