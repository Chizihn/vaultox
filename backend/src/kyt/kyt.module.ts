import { Module } from "@nestjs/common";
import { KytService } from "./kyt.service";
import { KYT_PROVIDER } from "./kyt.provider";
import { PolicyKytProvider } from "./providers/policy-kyt.provider";

@Module({
  providers: [
    KytService,
    PolicyKytProvider,
    {
      provide: KYT_PROVIDER,
      useExisting: PolicyKytProvider,
    },
  ],
  exports: [KytService, KYT_PROVIDER],
})
export class KytModule {}
