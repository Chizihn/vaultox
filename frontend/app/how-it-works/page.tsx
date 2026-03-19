import type { Metadata } from "next";
import { HowItWorksPage } from "@/components/landing/HowItWorksPage";

export const metadata: Metadata = {
  title: "How It Works · VaultOX",
  description:
    "Learn how VaultOX enables institutional cross-border stablecoin settlement with on-chain KYC, SIX-verified FX, and compliant yield vaults.",
};

export default function HowItWorks() {
  return <HowItWorksPage />;
}
