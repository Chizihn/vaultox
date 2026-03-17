import { Module } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";
import { MarketDataController } from "./market-data.controller";
import { SixModule } from "../six/six.module";

@Module({
  imports: [SixModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
