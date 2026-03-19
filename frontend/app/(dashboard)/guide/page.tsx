import type { Metadata } from "next";
import { GuideClient } from "./GuideClient";

export const metadata: Metadata = {
  title: "Platform Guide · VaultOX",
  description:
    "Learn how VaultOX works — credential tiers, cross-border settlement, compliant vaults, and regulatory reporting.",
};

export default function GuidePage() {
  return <GuideClient />;
}
