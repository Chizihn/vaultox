import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/QueryProvider";
import { SolanaWalletProvider } from "@/providers/SolanaProvider";
import { AuthStoreHydrator } from "@/providers/AuthStoreHydrator";

/* ── Google Fonts (self-hosted via next/font) ──────────────────────────── */
const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-syne",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-dm-mono",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/* ── SEO Metadata ─────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default: "VaultOX — Institutional Stablecoin Operating System",
    template: "%s · VaultOX",
  },
  description:
    "The institutional-grade treasury OS for regulated banks and asset managers. Compliance-gated yield vaults, cross-border settlements, and real-time audit trails — built on Solana.",
  keywords: [
    "institutional stablecoin",
    "treasury management",
    "compliance vault",
    "cross-border settlement",
    "Solana",
    "USDC",
    "RWA",
    "DeFi",
  ],
  authors: [{ name: "VaultOX", url: "https://vaultox.finance" }],
  creator: "VaultOX",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vaultox.finance",
    siteName: "VaultOX",
    title: "VaultOX — Institutional Stablecoin Operating System",
    description:
      "Compliance-gated yield vaults and cross-border settlements for regulated institutions, built on Solana.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaultOX — Institutional Stablecoin Operating System",
    description:
      "The institutional-grade treasury OS for regulated banks and asset managers, built on Solana.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/* ── Root Layout ─────────────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(syne.variable, dmMono.variable, jetbrains.variable)}
    >
      <body className="bg-vault-base text-text-primary font-heading antialiased min-h-screen">
        <SolanaWalletProvider>
          <QueryProvider>
            <AuthStoreHydrator />
            {children}
          </QueryProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
