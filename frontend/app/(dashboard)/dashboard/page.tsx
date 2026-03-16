import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard · VaultOX",
  description:
    "Treasury command center — vault positions, live settlements, and compliance metrics.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
