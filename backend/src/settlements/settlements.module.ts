import { Module } from "@nestjs/common";
import { SettlementsService } from "./settlements.service";
import { SettlementsController } from "./settlements.controller";
import { SolanaModule } from "../solana/solana.module";
import { ComplianceModule } from "../compliance/compliance.module";

@Module({
  imports: [SolanaModule, ComplianceModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
