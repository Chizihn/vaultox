import { Module } from "@nestjs/common";
import { EntraAdapterService } from "./entra-adapter.service";

@Module({
  providers: [EntraAdapterService],
  exports: [EntraAdapterService],
})
export class IdentityModule {}
