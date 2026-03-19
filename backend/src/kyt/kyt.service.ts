import { Inject, Injectable } from "@nestjs/common";
import { KytProvider, KYT_PROVIDER } from "./kyt.provider";
import { KytTransferContext } from "./kyt.types";

@Injectable()
export class KytService {
  constructor(
    @Inject(KYT_PROVIDER) private readonly kytProvider: KytProvider,
  ) {}

  assessTransfer(context: KytTransferContext) {
    return this.kytProvider.assessTransfer(context);
  }
}
