import { Module } from "@nestjs/common";
import { VaultsService } from "./vaults.service";
import { VaultsController } from "./vaults.controller";
import { SolanaModule } from "../solana/solana.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { SolsticeModule } from "../solstice/solstice.module";

@Module({
  imports: [SolanaModule, ComplianceModule, SolsticeModule],
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}
