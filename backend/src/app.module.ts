import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { SolanaModule } from "./solana/solana.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { VaultsModule } from "./vaults/vaults.module";
import { SettlementsModule } from "./settlements/settlements.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ThrottlerModule.forRoot([
      { name: "short", ttl: 1_000, limit: 5 }, // 5 req/s per IP (burst)
      { name: "medium", ttl: 60_000, limit: 100 }, // 100 req/min per IP
    ]),
    AuthModule,
    SolanaModule,
    ComplianceModule,
    VaultsModule,
    SettlementsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
