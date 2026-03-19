import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · VaultOX",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-vault-base text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-24 lg:px-10">
        <Link
          href="/"
          className="mb-8 inline-block font-code text-[11px] uppercase tracking-[0.15em] text-muted-vault hover:text-gold"
        >
          ← Back to Home
        </Link>

        <h1 className="font-heading text-3xl text-gold">Terms of Service</h1>
        <p className="mt-2 font-body text-xs text-muted-vault">
          Last updated: March 2026
        </p>

        <div className="mt-10 space-y-8 font-body text-sm leading-relaxed text-muted-vault">
          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing VaultOX, you confirm that you represent a regulated
              financial institution and agree to these Terms of Service. VaultOX is
              designed exclusively for institutional use by entities with active VASP,
              banking, or equivalent regulatory licensing in supported jurisdictions.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              2. Eligibility
            </h2>
            <p>
              VaultOX is available to institutions that:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">Hold active regulatory licensing (FINMA, EBA/ESMA, MAS, FSRA, or equivalent)</li>
              <li className="list-disc">Complete the VaultOX credentialing process (KYC verification)</li>
              <li className="list-disc">Maintain a valid Solana wallet for transaction signing</li>
              <li className="list-disc">Agree to Travel Rule data requirements on qualifying transfers</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              3. Credential Tiers
            </h2>
            <p>
              Access to VaultOX features is governed by your credential tier:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">
                <strong className="text-text-primary">Tier 3 (Standard)</strong> — access to
                low-risk vault strategies and basic settlement corridors
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Tier 2 (Professional)</strong> — expanded
                vault strategies and settlement corridors
              </li>
              <li className="list-disc">
                <strong className="text-text-primary">Tier 1 (Institutional)</strong> — full
                platform access including high-risk strategies and all corridors
              </li>
            </ul>
            <p className="mt-3">
              Tier assignments are determined by the VaultOX admin team based on
              submitted documentation and regulatory status. Tier enforcement is
              applied on-chain via Solana program checks.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              4. Settlement Operations
            </h2>
            <p>
              Cross-border settlements on VaultOX are executed on the Solana blockchain.
              By initiating a settlement, you acknowledge:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li className="list-disc">Transactions are irreversible once confirmed on-chain</li>
              <li className="list-disc">FX rates are locked at initiation and may differ from rates at confirmation</li>
              <li className="list-disc">Travel Rule data (originator/beneficiary information) will be stored on-chain</li>
              <li className="list-disc">Both counterparties must hold valid credentials for settlement to execute</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              5. Vault Operations
            </h2>
            <p>
              Vault deposits and withdrawals are subject to your credential tier.
              Yield rates are indicative and may vary. VaultOX vaults are non-custodial —
              all deposits and withdrawals require your wallet signature. Past
              performance does not guarantee future results.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              6. Compliance Obligations
            </h2>
            <p>
              You are responsible for ensuring that your use of VaultOX complies with
              all applicable laws and regulations in your jurisdiction. VaultOX provides
              compliance tools (audit trails, regulatory reports) but does not provide
              legal or regulatory advice.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              7. Non-custodial Nature
            </h2>
            <p>
              VaultOX is a non-custodial platform. The platform assembles unsigned
              transactions server-side, but all transactions must be signed by your
              institution&apos;s wallet. VaultOX does not hold, custody, or have access to
              your funds at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              8. Limitation of Liability
            </h2>
            <p>
              VaultOX is provided &quot;as is&quot; without warranty of any kind. To the maximum
              extent permitted by applicable law, VaultOX shall not be liable for any
              indirect, incidental, or consequential damages arising from your use of
              the platform, including but not limited to losses from settlement
              operations, yield fluctuations, or regulatory actions.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              9. Governing Law
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of
              Switzerland. Any disputes arising from or relating to these Terms shall be
              subject to the exclusive jurisdiction of the courts of Zurich, Switzerland.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-lg text-text-primary">
              10. Contact
            </h2>
            <p>
              For questions about these Terms, contact{" "}
              <span className="text-gold">legal@vaultox.finance</span>.
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
