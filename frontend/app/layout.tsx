import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/QueryProvider";
import { SolanaWalletProvider } from "@/providers/SolanaProvider";
import { AuthGlobalLoader } from "@/components/shared/AuthGlobalLoader";
import { Toaster } from "@/components/ui/sonner";
import { AuthBootstrap } from "@/providers/AuthBootstrap";

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
    default: "VaultOX — Cross-Border Stablecoin Settlement on Solana",
    template: "%s · VaultOX",
  },
  description:
    "Institutional cross-border USDC settlement with on-chain KYC, Travel Rule compliance, and SIX-verified FX rates. Built on Solana.",
  keywords: [
    "cross-border settlement",
    "institutional stablecoin",
    "Travel Rule",
    "compliance vault",
    "Solana",
    "USDC",
    "SIX market data",
    "FINMA",
  ],
  authors: [{ name: "VaultOX", url: "https://vaultox.finance" }],
  creator: "VaultOX",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vaultox.finance",
    siteName: "VaultOX",
    title: "VaultOX — Cross-Border Stablecoin Settlement on Solana",
    description:
      "Institutional cross-border USDC settlement with on-chain KYC, Travel Rule compliance, and SIX-verified FX rates.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaultOX — Cross-Border Stablecoin Settlement on Solana",
    description:
      "Institutional cross-border USDC settlement with on-chain KYC, Travel Rule compliance, and SIX-verified FX rates.",
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
            <AuthBootstrap />
            <AuthGlobalLoader />
            {children}
            <Toaster richColors position="top-right" closeButton />
          </QueryProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
