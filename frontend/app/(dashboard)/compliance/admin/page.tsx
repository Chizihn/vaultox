import type { Metadata } from "next";
import { AdminKycClient } from "./AdminKycClient";

export const metadata: Metadata = {
  title: "Compliance Admin · VaultOX",
  description:
    "Operational KYC review queue for approving and rejecting institutions.",
};

export default function ComplianceAdminPage() {
  return <AdminKycClient />;
}
