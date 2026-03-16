import type { Metadata } from "next";
import { SettlementsClient } from "./SettlementsClient";

export const metadata: Metadata = {
  title: "Settlements · VaultOX",
  description:
    "Cross-border stablecoin settlement rail. Initiate and monitor institutional USDC transfers in real-time.",
};

export default function SettlementsPage() {
  return <SettlementsClient />;
}
