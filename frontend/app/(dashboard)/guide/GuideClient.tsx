"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Shield,
  ArrowRightLeft,
  Landmark,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Lock,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Section nav items ────────────────────────────────────────────────── */
const SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "tiers", label: "Credential Tiers", icon: Shield },
  { id: "settlement", label: "Cross-Border Settlement", icon: ArrowRightLeft },
  { id: "vaults", label: "Treasury Vaults", icon: Landmark },
  { id: "compliance", label: "Compliance & Reports", icon: FileText },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

/* ── FAQ data ─────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "What is a Vault Passport?",
    a: "A Vault Passport is a non-transferable on-chain credential (stored as a PDA on Solana) that encodes your institution's KYC tier, jurisdiction, and permitted operations. It is issued after your KYC application is approved and acts as your on-chain identity for all VaultOX transactions.",
  },
  {
    q: "Can I upgrade my tier?",
    a: "Yes. Tier upgrades require submitting additional documentation through the Compliance page. An admin reviews the application and, if approved, updates your on-chain credential. Your access level changes immediately.",
  },
  {
    q: "What happens if my counterparty doesn't have a credential?",
    a: "The settlement will be blocked at the protocol level. VaultOX's Transfer Hook checks both the sender and receiver's credentials before any token transfer executes. This ensures every transaction is between verified institutions.",
  },
  {
    q: "How does the SIX FX rate integration work?",
    a: "When you initiate a settlement, VaultOX fetches real-time FX rates from SIX Swiss Exchange via an mTLS-authenticated API connection. The rate is locked at the moment of initiation, so you know the exact conversion rate before signing.",
  },
  {
    q: "What is Travel Rule and why does VaultOX require it?",
    a: "The FATF Travel Rule requires that originator and beneficiary information be attached to transfers above a certain threshold. VaultOX enforces this automatically — you provide the required details during settlement initiation, and they are stored on-chain alongside the transaction.",
  },
  {
    q: "Are the FINMA reports accepted by regulators?",
    a: "VaultOX generates reports following the FINMA regulatory framework structure. The reports are generated from live system data (settlements, credential changes, AML screenings) and are designed to be audit-ready. Consult your compliance team for jurisdiction-specific acceptance.",
  },
  {
    q: "What yields do the vaults offer?",
    a: "Vault yields depend on the strategy risk tier. Low-risk T-Bill strategies offer ~4.2% APY and are accessible to all verified institutions. Medium-risk private credit (~7.8%) requires Tier 2, and high-risk commodity strategies (~11.4%) require Tier 1.",
  },
  {
    q: "Why can withdrawal be delayed after deposit?",
    a: "Solstice strategies differ by how liquidity is released. Solstice Liquidity is designed for instant withdrawal. Solstice Yield Vault follows an unlock/cooldown window (24h) before Withdraw is allowed, so a just-deposited position may not be redeemable immediately. Solstice Compounding uses a longer lock (7 days).",
  },
  {
    q: "How does emergency recovery work?",
    a: "If a Solstice mint or redeem flow gets stuck in a pending state, VaultOX provides protocol recovery exits: CancelMint (revert a pending mint and recover collateral) and CancelRedeem (cancel a pending redeem and restore the USX/eUSX position).",
  },
  {
    q: "Is VaultOX custodial?",
    a: "No. VaultOX is non-custodial. All transactions are signed by your institution's wallet. The platform assembles unsigned transactions server-side, but only your wallet can sign and submit them to the Solana network.",
  },
];

/* ── Tier data ────────────────────────────────────────────────────────── */
const TIERS = [
  {
    tier: 3,
    name: "Standard",
    who: "All verified institutions",
    color: "text-ok",
    borderColor: "border-ok/30",
    bgColor: "bg-ok/5",
    features: [
      "Low-risk vault strategies (T-Bills, ~4.2% APY)",
      "Basic cross-border settlement corridors",
      "View compliance passport & audit trail",
      "Generate FINMA/MiCA/MAS reports",
      "Access settlement history & tracking",
    ],
    locked: [],
  },
  {
    tier: 2,
    name: "Professional",
    who: "Licensed VASPs, registered financial entities",
    color: "text-gold",
    borderColor: "border-gold/30",
    bgColor: "bg-gold/5",
    features: [
      "Everything in Standard, plus:",
      "Medium-risk vault strategies (Private Credit, ~7.8% APY)",
      "Expanded settlement corridors",
      "Priority settlement processing",
      "Advanced compliance analytics",
    ],
    locked: [],
  },
  {
    tier: 1,
    name: "Institutional",
    who: "Tier-1 banks, regulated asset managers, sovereign wealth",
    color: "text-teal",
    borderColor: "border-teal/30",
    bgColor: "bg-teal/5",
    features: [
      "Everything in Professional, plus:",
      "High-risk vault strategies (Commodity, ~11.4% APY)",
      "All global settlement corridors",
      "Custom compliance report frameworks",
      "Dedicated admin controls & API access",
    ],
    locked: [],
  },
];

/* ── Settlement steps ─────────────────────────────────────────────────── */
const SETTLEMENT_STEPS = [
  {
    step: 1,
    title: "Select Counterparty",
    description: "Choose the receiving institution. Both parties must hold a valid Vault Passport credential.",
    icon: Wallet,
  },
  {
    step: 2,
    title: "Enter Settlement Details",
    description: "Specify the amount, corridor (e.g., CHF → USD), and provide Travel Rule data (originator/beneficiary info).",
    icon: FileText,
  },
  {
    step: 3,
    title: "FX Rate Locks",
    description: "VaultOX fetches the real-time FX rate from SIX Swiss Exchange and locks it. You see the exact rate before confirming.",
    icon: Zap,
  },
  {
    step: 4,
    title: "Sign & Submit",
    description: "The platform assembles the transaction. You sign with your wallet, and the transaction is submitted to Solana.",
    icon: CheckCircle,
  },
  {
    step: 5,
    title: "Confirmation",
    description: "Transaction confirms on-chain in ~1.8 seconds. Both institutions can verify the settlement on Solana Explorer.",
    icon: Shield,
  },
];

/* ── FAQ Accordion ────────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-vault-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left transition-colors hover:text-gold"
      >
        <span className="font-heading text-sm font-medium text-text-primary pr-4">
          {q}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-vault transition-transform duration-200",
            open && "rotate-180 text-gold"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 font-body text-sm leading-relaxed text-muted-vault">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */
export function GuideClient() {
  const [activeSection, setActiveSection] = useState("getting-started");

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-heading text-2xl text-gold">Platform Guide</h1>
        <p className="font-body text-xs text-muted-vault">
          Everything you need to know to use VaultOX as an institutional operator
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_1fr]">
        {/* ── Sidebar Nav ── */}
        <nav
          aria-label="Guide sections"
          className="hidden xl:block"
        >
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id);
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left font-body text-xs transition-all",
                    activeSection === s.id
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-vault hover:text-text-primary hover:bg-vault-elevated border border-transparent"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Main Content ── */}
        <div className="space-y-10">
          {/* ── 1. Getting Started ── */}
          <section id="getting-started">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="mb-6 flex items-center gap-2">
                <BookOpen className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Getting Started
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                  VaultOX is a cross-border stablecoin settlement platform for regulated institutions.
                  Here&apos;s how to go from zero to your first settlement:
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    {
                      step: "1",
                      title: "Connect Wallet",
                      desc: "Use a Solana wallet (Phantom, Backpack, etc.) to authenticate. VaultOX uses challenge-response signature auth — no passwords.",
                      accent: "text-teal",
                    },
                    {
                      step: "2",
                      title: "Get Credentialed",
                      desc: "Submit your institution's KYC documents. An admin reviews and issues your Vault Passport — a non-transferable on-chain credential.",
                      accent: "text-gold",
                    },
                    {
                      step: "3",
                      title: "Start Operating",
                      desc: "Once verified, you can initiate settlements, deposit into vaults, view compliance status, and generate regulatory reports.",
                      accent: "text-ok",
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="rounded-sm border border-vault-border bg-vault-elevated p-4"
                    >
                      <span className={cn("font-heading text-2xl", item.accent)}>
                        {item.step}
                      </span>
                      <h3 className="mt-2 font-heading text-sm font-semibold text-text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-1 font-body text-xs leading-relaxed text-muted-vault">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── 2. Credential Tiers ── */}
          <section id="tiers">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="mb-6 flex items-center gap-2">
                <Shield className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Credential Tiers
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                  Your Vault Passport credential determines what you can access on VaultOX.
                  Higher tiers unlock more corridors, riskier yield strategies, and advanced features.
                  Tiers are assigned based on your institution&apos;s regulatory status and documentation.
                </p>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {TIERS.map((t) => (
                    <div
                      key={t.tier}
                      className={cn(
                        "rounded-sm border p-5 transition-all",
                        t.borderColor,
                        t.bgColor
                      )}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <span className={cn("font-heading text-2xl font-bold", t.color)}>
                            Tier {t.tier}
                          </span>
                          <p className={cn("font-heading text-xs font-semibold", t.color)}>
                            {t.name}
                          </p>
                        </div>
                        <Shield className={cn("size-6", t.color)} />
                      </div>

                      <p className="mb-4 font-body text-[11px] text-muted-vault">
                        {t.who}
                      </p>

                      <ul className="space-y-2">
                        {t.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle className={cn("mt-0.5 size-3 shrink-0", t.color)} />
                            <span className="font-body text-xs text-text-primary">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-sm border border-gold/20 bg-gold/5 p-4">
                  <p className="font-body text-xs leading-relaxed text-gold">
                    <strong>How tiers relate to vault access:</strong> Lower tier number = higher access.
                    A Tier 3 user can access any vault strategy that requires Tier 3 (low-risk).
                    A Tier 1 user can access all strategies. Your tier is checked on-chain before every deposit.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── 3. Cross-Border Settlement ── */}
          <section id="settlement">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="mb-6 flex items-center gap-2">
                <ArrowRightLeft className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Cross-Border Settlement
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                  VaultOX settles cross-border USDC transfers in under 2 seconds on Solana.
                  Every settlement includes on-chain credential verification, locked FX rates via SIX,
                  and FATF Travel Rule payloads.
                </p>

                <div className="space-y-4">
                  {SETTLEMENT_STEPS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.step}
                        className="flex items-start gap-4 rounded-sm border border-vault-border bg-vault-elevated p-4"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10">
                          <Icon className="size-4 text-teal" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-code text-[10px] text-muted-vault">
                              STEP {s.step}
                            </span>
                            {i < SETTLEMENT_STEPS.length - 1 && (
                              <ChevronRight className="size-3 text-vault-border" />
                            )}
                          </div>
                          <h3 className="font-heading text-sm font-semibold text-text-primary">
                            {s.title}
                          </h3>
                          <p className="mt-1 font-body text-xs leading-relaxed text-muted-vault">
                            {s.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-sm border border-teal/20 bg-teal/5 p-4">
                  <p className="font-body text-xs leading-relaxed text-teal">
                    <strong>What if the counterparty isn&apos;t credentialed?</strong> The settlement will be
                    blocked at the protocol level. VaultOX&apos;s Transfer Hook on Solana checks both sender
                    and receiver credentials before any transfer executes. This is on-chain enforcement, not
                    just a UI check.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── 4. Treasury Vaults ── */}
          <section id="vaults">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="mb-6 flex items-center gap-2">
                <Landmark className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Treasury Vaults
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                  Between settlements, institutions need somewhere to park idle USDC compliantly.
                  VaultOX vaults provide tier-gated yield strategies so your treasury earns while
                  waiting for the next settlement.
                </p>

                <div className="overflow-hidden rounded-sm border border-vault-border">
                  <table className="min-w-full" aria-label="Vault strategy tiers">
                    <thead>
                      <tr className="border-b border-vault-border bg-vault-elevated">
                        {["Strategy", "Risk Tier", "~APY", "Required Credential", "Description"].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-4 py-3 text-left font-code text-[10px] uppercase tracking-[0.15em] text-muted-vault"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-vault-border/40">
                      {[
                        {
                          name: "T-Bill Yield",
                          risk: "Low",
                          apy: "4.2%",
                          requires: "Tier 3 (Standard)",
                          desc: "Government-backed treasury bill exposure",
                          color: "text-ok",
                        },
                        {
                          name: "Private Credit",
                          risk: "Medium",
                          apy: "7.8%",
                          requires: "Tier 2 (Professional)",
                          desc: "Diversified private credit pool",
                          color: "text-gold",
                        },
                        {
                          name: "Commodity Fund",
                          risk: "High",
                          apy: "11.4%",
                          requires: "Tier 1 (Institutional)",
                          desc: "Gold/Silver commodity-backed strategy",
                          color: "text-teal",
                        },
                      ].map((row) => (
                        <tr key={row.name} className="transition-colors hover:bg-vault-elevated/40">
                          <td className="px-4 py-3 font-heading text-xs font-medium text-text-primary">
                            {row.name}
                          </td>
                          <td className={cn("px-4 py-3 font-code text-[11px]", row.color)}>
                            {row.risk}
                          </td>
                          <td className="px-4 py-3 font-heading text-xs text-text-primary">
                            {row.apy}
                          </td>
                          <td className="px-4 py-3 font-body text-[11px] text-muted-vault">
                            {row.requires}
                          </td>
                          <td className="px-4 py-3 font-body text-[11px] text-muted-vault">
                            {row.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-sm border border-gold/20 bg-gold/5 p-4">
                  <Lock className="mt-0.5 size-4 shrink-0 text-gold" />
                  <p className="font-body text-xs leading-relaxed text-gold">
                    <strong>Tier gating is enforced on-chain.</strong> If your credential tier doesn&apos;t
                    meet the strategy&apos;s minimum requirement, the deposit transaction will be rejected by
                    the Solana program — not just blocked in the UI. This provides hard regulatory safety.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── 5. Compliance & Reports ── */}
          <section id="compliance">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="mb-6 flex items-center gap-2">
                <FileText className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Compliance & Reports
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                  VaultOX generates audit-ready regulatory reports from live data. Every settlement,
                  credential change, and AML screening is persisted to the audit trail and can be
                  exported in FINMA, MiCA, or MAS format.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "Compliance Passport",
                      desc: "View your institution's on-chain credential, tier, jurisdiction, and permission set. Accessible from the Compliance page.",
                      path: "/compliance",
                    },
                    {
                      title: "Audit Trail",
                      desc: "Every critical action — logins, settlements, credential changes, AML screenings — is logged with timestamps and actor details.",
                      path: "/compliance",
                    },
                    {
                      title: "Regulatory Reports",
                      desc: "Generate FINMA, MiCA, or MAS compliance reports for any date range. Reports are generated from live database records.",
                      path: "/reports",
                    },
                    {
                      title: "AML Screening",
                      desc: "Rules-based risk scoring is run on every wallet. Results are persisted and included in compliance reports.",
                      path: "/compliance",
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="rounded-sm border border-vault-border bg-vault-elevated p-4"
                    >
                      <h3 className="font-heading text-sm font-semibold text-text-primary">
                        {card.title}
                      </h3>
                      <p className="mt-1 font-body text-xs leading-relaxed text-muted-vault">
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── 6. FAQ ── */}
          <section id="faq">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="mb-6 flex items-center gap-2">
                <HelpCircle className="size-5 text-gold" />
                <h2 className="font-heading text-lg font-semibold text-text-primary">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="rounded-sm border border-vault-border bg-vault-surface p-6">
                {FAQ_ITEMS.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
}
