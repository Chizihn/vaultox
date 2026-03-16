import type { Metadata } from "next";
import { Suspense } from "react";
import { VaultsClient } from "./VaultsClient";
import { PageLoader } from "@/components/shared/PageLoader";

export const metadata: Metadata = {
  title: "Vaults · VaultOX",
  description:
    "Compliance-gated yield vaults. Deposit into T-Bill, Private Credit RWA, and Commodity-Backed strategies based on your institution tier.",
};

export default function VaultsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VaultsClient />
    </Suspense>
  );
}
