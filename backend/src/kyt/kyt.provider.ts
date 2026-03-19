import { KytAssessment, KytTransferContext } from "./kyt.types";

export const KYT_PROVIDER = "KYT_PROVIDER";

export interface KytProvider {
  assessTransfer(context: KytTransferContext): Promise<KytAssessment>;
}
