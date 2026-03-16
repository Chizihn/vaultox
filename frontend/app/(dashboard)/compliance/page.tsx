import type { Metadata } from "next";
import { ComplianceClient } from "./ComplianceClient";

export const metadata: Metadata = {
  title: "Compliance · VaultOX",
  description:
    "Institution credential management, KYC attestations, and on-chain audit trail for regulatory reporting.",
};

export default function CompliancePage() {
  return <ComplianceClient />;
}
