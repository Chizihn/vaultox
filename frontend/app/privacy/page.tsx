import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · VaultOX",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-vault-base text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10">
        <Link
          href="/"
          className="mb-8 inline-block font-code text-[11px] uppercase tracking-[0.15em] text-muted-vault hover:text-gold"
        >
          ← Back to Home
        </Link>

        <h1 className="font-heading text-3xl text-gold">Privacy Policy</h1>
        <p className="mt-2 font-body text-xs text-muted-vault">
          Last updated: March 2026
        </p>

        <div className="mt-10 space-y-8 font-body text-sm leading-relaxed text-muted-vault">
          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              1. Information We Collect
            </h2>
            <p>
              VaultOX collects information necessary to provide institutional-grade
              treasury services. This includes:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">
                <strong className="text-text-primary">Wallet addresses</strong> — used for
                authentication and on-chain credential binding
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Institutional KYC data</strong> — submitted
                during the credentialing process (institution name, jurisdiction, regulatory status)
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Transaction records</strong> — settlement
                history, vault positions, and Travel Rule payloads as required by FATF
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Audit events</strong> — login events,
                credential changes, and compliance-critical actions
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              2. How We Use Your Information
            </h2>
            <p>
              Collected data is used exclusively for operating the VaultOX platform:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">Authenticating institutional users via wallet signatures</li>
              <li className="list-disc">Issuing and managing on-chain compliance credentials</li>
              <li className="list-disc">Executing and tracking cross-border settlements</li>
              <li className="list-disc">Generating regulatory compliance reports (FINMA, MiCA, MAS)</li>
              <li className="list-disc">Maintaining audit trails as required by applicable regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              3. On-chain Data
            </h2>
            <p>
              Certain data is stored on the Solana blockchain as part of VaultOX&apos;s
              compliance architecture. On-chain data includes credential status, tier
              assignments, and settlement transaction records. Blockchain data is
              publicly visible and cannot be deleted due to the immutable nature of
              distributed ledgers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              4. Data Sharing
            </h2>
            <p>
              VaultOX does not sell or share institutional data with third parties.
              Data may be shared with:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">
                <strong className="text-text-primary">Regulatory bodies</strong> — when required by
                applicable law (FINMA, EBA/ESMA, MAS)
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Settlement counterparties</strong> — Travel
                Rule payloads are shared with receiving institutions as required by FATF
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Market data providers</strong> — SIX Swiss
                Exchange receives API requests for FX rates; no institutional data is transmitted
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              5. Security
            </h2>
            <p>
              VaultOX employs industry-standard security measures including JWT-based
              session management, wallet signature authentication, role-based access
              controls, and encrypted data storage. On-chain operations use Solana&apos;s
              native program security model with Transfer Hook enforcement.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              6. Contact
            </h2>
            <p>
              For privacy-related inquiries, contact the VaultOX compliance team at{" "}
              <span className="text-gold">privacy@vaultox.finance</span>.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-vault-border pt-6">
          <p className="font-code text-[10px] text-muted-vault/40">
            © 2026 VaultOX. This is a demonstration product built for StableHacks 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
