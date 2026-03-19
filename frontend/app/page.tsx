import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'VaultOX — Cross-Border Stablecoin Settlement on Solana',
  description:
    'Institutional cross-border USDC settlement with on-chain KYC, Travel Rule compliance, and SIX-verified FX rates. Built on Solana.',
  keywords: [
    'cross-border settlement',
    'institutional stablecoin',
    'DeFi compliance',
    'Solana treasury',
    'USDC vaults',
    'VaultOX',
    'FINMA MiCA MAS',
    'Travel Rule',
    'SIX market data',
  ],
};

export default function HomePage() {
  return <LandingPage />;
}
