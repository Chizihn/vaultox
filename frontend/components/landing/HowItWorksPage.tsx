"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowUpRight,
  Shield,
  ArrowRightLeft,
  Landmark,
  CheckCircle,
  Globe,
  FileText,
  Lock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-vault-base text-text-primary">
      {/* ── Nav ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-vault-border bg-vault-base/95 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="font-heading text-xl leading-none text-gold">
            <Image src="/vaultox-logo.png" width={150} height={60} alt="VaultOX Logo" />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="font-code text-[11px] uppercase tracking-[0.15em] text-muted-vault hover:text-text-primary">
              Home
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-sm border border-gold/30 px-4 py-2 font-heading text-xs font-semibold text-gold transition-all hover:bg-gold/10"
            >
              Access Terminal <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      <main className="pt-24">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="mb-4 font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
              How VaultOX Works
            </p>
            <h1 className="font-heading text-[clamp(32px,6vw,64px)] leading-[0.95] tracking-tight">
              Cross-border settlement,{" "}
              <span className="text-gold">made institutional.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-body text-sm leading-relaxed text-muted-vault">
              VaultOX turns fragmented treasury operations into a single workflow.
              Credential → Settle → Earn. Every step is compliant, auditable, and
              enforced on-chain.
            </p>
          </motion.div>
        </section>

        {/* ── Three Steps ── */}
        <section className="mx-auto max-w-7xl border-y border-vault-border px-6 py-20 lg:px-10">
          <Reveal>
            <p className="mb-2 font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
              The Flow
            </p>
            <h2 className="font-heading text-3xl text-text-primary">Three steps. One platform.</h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-0 border border-vault-border md:grid-cols-3 md:divide-x md:divide-vault-border">
            {[
              {
                step: "01",
                icon: Shield,
                title: "Get Credentialed",
                subtitle: "On-chain identity",
                description:
                  "Connect your wallet, submit KYC documents, and receive a Vault Passport — a non-transferable on-chain credential that encodes your tier, jurisdiction, and permissions.",
                details: [
                  "Wallet signature auth (no passwords)",
                  "KYC review by VaultOX admin",
                  "Credential issued on Solana",
                  "Three tiers: Standard, Professional, Institutional",
                ],
                accent: "text-ok",
                accentBg: "bg-ok",
              },
              {
                step: "02",
                icon: ArrowRightLeft,
                title: "Settle Cross-Border",
                subtitle: "Atomic execution",
                description:
                  "Initiate a USDC settlement with any credentialed counterparty. FX rates lock via SIX Swiss Exchange. Travel Rule data attached. Confirms in ~1.4 seconds.",
                details: [
                  "SIX-verified FX rates (mTLS)",
                  "FATF Travel Rule on every transfer",
                  "On-chain credential check for both parties",
                  "Holiday-aware corridor warnings",
                ],
                accent: "text-teal",
                accentBg: "bg-teal",
              },
              {
                step: "03",
                icon: Landmark,
                title: "Park & Earn",
                subtitle: "Compliant yield",
                description:
                  "Between settlements, park idle USDC in tier-gated yield vaults. Low-risk T-Bills for everyone, higher-risk strategies for higher tiers.",
                details: [
                  "T-Bills ~4.2% APY (Tier 3+)",
                  "Private Credit ~7.8% (Tier 2+)",
                  "Commodity ~11.4% (Tier 1)",
                  "On-chain tier enforcement",
                ],
                accent: "text-gold",
                accentBg: "bg-gold",
              },
            ].map(({ step, icon: Icon, title, subtitle, description, details, accent, accentBg }, i) => (
              <Reveal key={step} delay={i * 0.1}>
                <article className="flex h-full flex-col p-8">
                  <div className="mb-6">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={cn("flex size-10 items-center justify-center rounded-full", accentBg + "/10")}>
                        <Icon className={cn("size-5", accent)} />
                      </div>
                      <span className="font-code text-[10px] uppercase tracking-widest text-muted-vault">
                        Step {step}
                      </span>
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-text-primary">
                      {title}
                    </h3>
                    <p className={cn("font-code text-[10px] uppercase tracking-widest", accent)}>
                      {subtitle}
                    </p>
                  </div>

                  <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                    {description}
                  </p>

                  <ul className="mt-auto space-y-2">
                    {details.map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <CheckCircle className={cn("size-3 shrink-0", accent)} />
                        <span className="font-body text-xs text-muted-vault">{d}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── What Makes It Institutional ── */}
        <section className="mx-auto max-w-7xl border-b border-vault-border px-6 py-20 lg:px-10">
          <Reveal>
            <p className="mb-2 font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
              Why VaultOX
            </p>
            <h2 className="font-heading text-3xl text-text-primary">
              Built for regulated institutions.
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Lock,
                title: "On-chain Enforcement",
                desc: "Solana Transfer Hook blocks non-credentialed wallets at the protocol level. Compliance isn't optional.",
              },
              {
                icon: Globe,
                title: "SIX Swiss Exchange",
                desc: "FX rates from SIX via mTLS authentication. Real TradFi data infrastructure powering DeFi settlement.",
              },
              {
                icon: FileText,
                title: "Regulatory Reports",
                desc: "FINMA, MiCA, MAS report generation from live data. Audit-ready exports for your compliance team.",
              },
              {
                icon: Zap,
                title: "Sub-2s Finality",
                desc: "Solana delivers ~1.4s settlement finality. No correspondent banks, no T+2 delays, no intermediaries.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div className="rounded-sm border border-vault-border bg-vault-surface p-6 h-full">
                  <Icon className="mb-3 size-5 text-gold" />
                  <h3 className="font-heading text-sm font-semibold text-text-primary">
                    {title}
                  </h3>
                  <p className="mt-2 font-body text-xs leading-relaxed text-muted-vault">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-10">
          <Reveal>
            <h2 className="font-heading text-[clamp(24px,4vw,48px)] leading-tight text-text-primary">
              Ready to settle?
            </h2>
            <p className="mx-auto mt-4 max-w-md font-body text-sm text-muted-vault">
              Connect your institutional wallet and request a Vault Passport credential to get started.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-sm bg-gold px-8 py-3 font-heading text-sm font-semibold text-vault-base transition-opacity hover:opacity-90"
              >
                Access Terminal
              </Link>
              <Link
                href="/"
                className="rounded-sm border border-vault-border px-8 py-3 font-heading text-sm text-muted-vault transition-colors hover:border-gold/20 hover:text-text-primary"
              >
                Back to Home
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-vault-border bg-vault-surface">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-code text-[10px] text-muted-vault/40">
              © 2026 VaultOX. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="font-code text-[10px] text-muted-vault/40 hover:text-muted-vault">
                Privacy
              </Link>
              <Link href="/terms" className="font-code text-[10px] text-muted-vault/40 hover:text-muted-vault">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
