import { Module } from "@nestjs/common";
import { SolsticeService } from "./solstice.service";

@Module({
  providers: [SolsticeService],
  exports: [SolsticeService],
})
export class SolsticeModule {}
