import type { Metadata } from "next";
import { TopNav } from "@/components/shared/TopNav";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-vault-base">
      <TopNav />
      <main id="main-content" className="mx-auto max-w-360 px-4 py-6 lg:px-6">
        {children}
      </main>
    </div>
  );
}
