import type { Metadata } from "next";
import { LoginBrand } from "@/components/login/LoginBrand";
import { LoginForm } from "@/components/login/LoginForm";

export const metadata: Metadata = {
  title: "Login · VaultOX",
  description:
    "Institutional access to VaultOX. Connect your wallet and verify your on-chain compliance credential.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-vault-base">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[40%_60%]">
        {/* Brand panel — hidden on mobile */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 h-screen">
            <LoginBrand />
          </div>
        </aside>

        {/* Form panel */}
        <section className="flex min-h-screen items-center border-l border-vault-border bg-vault-surface">
          <div className="w-full">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
