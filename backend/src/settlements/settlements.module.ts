import { Module } from "@nestjs/common";
import { SettlementsService } from "./settlements.service";
import { SettlementsController } from "./settlements.controller";
import { SolanaModule } from "../solana/solana.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { KytModule } from "../kyt/kyt.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [SolanaModule, ComplianceModule, KytModule, NotificationsModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
