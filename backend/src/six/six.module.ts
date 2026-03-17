import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SixService } from "./six.service";

@Module({
  imports: [ConfigModule],
  providers: [SixService],
  exports: [SixService],
})
export class SixModule {}
