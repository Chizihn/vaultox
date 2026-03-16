import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'VaultOX — Institutional Stablecoin Operating System',
  description:
    'On-chain institutional treasury management for regulated financial institutions. Built on Solana. Compliant by design.',
  keywords: [
    'institutional stablecoin',
    'DeFi compliance',
    'cross-border settlement',
    'Solana treasury',
    'USDC vaults',
    'VaultOX',
    'FINMA MiCA MAS',
  ],
};

export default function HomePage() {
  return <LandingPage />;
}
