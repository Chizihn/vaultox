import { Module } from '@nestjs/common';
import { VaultsService } from './vaults.service';
import { VaultsController } from './vaults.controller';
import { SolanaModule } from '../solana/solana.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [SolanaModule, ComplianceModule],
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService]
})
export class VaultsModule {}
