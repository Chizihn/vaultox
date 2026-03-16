import type { Metadata } from "next";
import { ReportsClient } from "./ReportsClient";

export const metadata: Metadata = {
  title: "Reports · VaultOX",
  description:
    "Generate and download regulatory compliance reports for FINMA, MiCA, MAS, and custom frameworks.",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
