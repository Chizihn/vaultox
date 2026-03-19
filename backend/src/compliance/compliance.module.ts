import { Module } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { ComplianceController } from "./compliance.controller";
import { SolanaModule } from "../solana/solana.module";
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [SolanaModule, NotificationsModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, AdminApiKeyGuard],
  exports: [ComplianceService],
})
export class ComplianceModule {}
