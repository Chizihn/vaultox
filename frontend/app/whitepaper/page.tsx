"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ShieldCheck, Zap, Globe, Lock, BarChart3, Activity } from "lucide-react";
import Link from "next/link";

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-vault-base text-text-primary selection:bg-gold/30 selection:text-white">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-vault-border bg-vault-base/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="size-4 text-muted-vault transition-transform group-hover:-translate-x-1" />
            <span className="font-heading text-sm font-medium text-muted-vault group-hover:text-gold transition-colors">Return Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-bold tracking-tight">VAULT<span className="text-gold">OX</span></span>
          </div>
          <div className="w-20" /> {/* Spacer */}
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <header className="relative border-b border-vault-border bg-vault-surface py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 h-px w-full bg-gradient-to-r from-transparent via-gold to-transparent" />
          <div className="absolute bottom-0 right-1/4 h-px w-full bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>
        
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-gold/10 px-4 py-1.5 border border-gold/20">
                <span className="font-heading text-xs font-bold uppercase tracking-widest text-gold">Project Whitepaper</span>
              </div>
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-text-primary">
              Institutional Cross-Border <br />
              <span className="text-gold">Stablecoin Settlement</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-body text-lg text-muted-vault leading-relaxed">
              Technical overview of the VaultOX compliance-native settlement rail powered by Solana and SIX Financial.
            </p>
          </motion.div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        <article className="prose prose-invert prose-gold max-w-none">
          {/* Section: Overview */}
          <section className="mb-16">
            <h2 className="flex items-center gap-3 font-heading text-3xl font-bold text-text-primary mb-8 border-l-4 border-gold pl-6">
              <BookOpen className="size-8 text-gold" />
              Project Overview
            </h2>
            <div className="rounded-sm border border-vault-border bg-vault-surface p-8 shadow-sm">
              <p className="font-body text-lg leading-relaxed text-muted-vault mb-6">
                VaultOX is a compliance-native institutional settlement rail for regulated financial entities on Solana. It solves the critical **&quot;Settlement Gap&quot;** that emerged after the collapse of Signature Bank in 2023.
              </p>
              <p className="font-body text-lg leading-relaxed text-muted-vault">
                International institutions can no longer rely on fast, cheap USD settlement rails like the Signature Signet or Silvergate Exchange Network (SEN). VaultOX provides a blockchain-native alternative that is faster, cheaper, and fundamentally more compliant.
              </p>
            </div>
          </section>

          {/* Section: The Problem */}
          <section className="mb-16">
            <h2 className="font-heading text-2xl font-bold text-text-primary mb-6">The Problem VaultOX Solves</h2>
            <p className="font-body text-muted-vault mb-8">
              Regulated banks face a major challenge: after the collapse of the &quot;big three&quot; crypto-friendly banks, correspondent banking became slow, expensive, and opaque.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "Anonymous Wallets", desc: "No on-chain identity means protocol-level compliance is impossible." },
                { title: "Fragmented Workflows", desc: "KYC, settlement, and audit trails live in separate, un-synced systems." },
                { title: "No FX Transparency", desc: "Institutions settle &quot;blind&quot; without verified market rates locked at execution." },
                { title: "Regulatory Risk", desc: "FATF Travel Rule and AML screening are manual afterthoughts." }
              ].map((item, i) => (
                <div key={i} className="rounded-sm border border-vault-border bg-vault-elevated p-6">
                  <h3 className="font-heading text-sm font-bold text-gold uppercase tracking-wide mb-2">{item.title}</h3>
                  <p className="font-body text-sm text-muted-vault">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Core Principles */}
          <section className="mb-16">
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-10">How VaultOX Works — The 5 Core Principles</h2>
            
            <div className="space-y-12">
              {/* Principle 1 */}
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-text-primary mb-4">
                    <ShieldCheck className="size-6 text-teal" />
                    1. Vault Passport (1:1 Sticky Identity)
                  </h3>
                  <p className="font-body text-muted-vault leading-relaxed">
                    Unlike retail wallets, VaultOX enforces a strict **1:1 Subject-Wallet Binding** via Microsoft Entra ID (OIDC). Verified institutional identities are permanently bound to a specific Solana wallet in the <code className="text-teal">compliance_registry</code>.
                  </p>
                </div>
                <div className="w-full md:w-72 rounded-sm bg-vault-surface border border-vault-border p-4 flex flex-col items-center justify-center min-h-40">
                  <div className="relative size-24 mb-4 flex items-center justify-center">
                    <ShieldCheck className="size-10 text-teal animate-pulse" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-vault text-center">Compliance Radar v1.0</span>
                </div>
              </div>

              {/* Principle 2 */}
              <div className="flex flex-col md:flex-row-reverse gap-8">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-text-primary mb-4">
                    <Zap className="size-6 text-gold" />
                    2. Atomic Settlement & FX Locking
                  </h3>
                  <p className="font-body text-muted-vault leading-relaxed">
                    Sub-2-second finality on Solana. Featuring **SIX Financial Integration** for live FX rates (EUR/USD, CHF/USD) fetched via mTLS-authenticated API (.p12 certificates). Rates are locked at initiation, ensuring zero hidden spreads.
                  </p>
                </div>
                <div className="w-full md:w-72 rounded-sm bg-vault-surface border border-vault-border p-4 flex flex-col items-center justify-center min-h-40">
                   <div className="flex items-center gap-1 font-heading text-2xl font-bold text-gold">
                      <span>1.0432</span>
                      <span className="text-[10px] text-muted-vault mt-2">EUR/USD</span>
                   </div>
                   <div className="mt-2 rounded-full bg-gold/10 px-2 py-0.5 border border-gold/20 text-[10px] text-gold uppercase font-bold">SIX Verified</div>
                </div>
              </div>

              {/* Principle 3 */}
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-text-primary mb-4">
                    < Globe className="size-6 text-teal" />
                    3. FATF Travel Rule — Built-In
                  </h3>
                  <p className="font-body text-muted-vault leading-relaxed">
                    Every settlement above regulatory thresholds automatically attaches a compliant originator/beneficiary payload. All 6 FATF-required fields are stored on-chain in the <code className="text-teal">settlement_engine</code> state.
                  </p>
                </div>
                <div className="w-full md:w-72 rounded-sm bg-vault-surface border border-vault-border p-4">
                   <div className="space-y-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-1.5 w-full bg-vault-elevated rounded-full overflow-hidden">
                           <div className="h-full bg-teal/40" style={{ width: `${Math.random() * 60 + 40}%` }} />
                        </div>
                      ))}
                      <div className="text-[9px] uppercase font-bold text-teal mt-2">FATF Payload Hash: 0x82f...a12</div>
                   </div>
                </div>
              </div>

              {/* Principle 4 */}
              <div className="flex flex-col md:flex-row-reverse gap-8">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-text-primary mb-4">
                    <Lock className="size-6 text-gold" />
                    4. Compliance-Gated Treasury Vaults
                  </h3>
                  <p className="font-body text-muted-vault leading-relaxed">
                    Idle treasury capital earns yield in compliance-gated strategies powered by **Solstice**. Compliance levels (Tier 1/2/3) strictly limit access to specific risk-tier strategies.
                  </p>
                </div>
                <div className="w-full md:w-72 rounded-sm bg-vault-surface border border-vault-border p-4 flex flex-col items-center justify-center min-h-40">
                   <div className="relative">
                      <BarChart3 className="size-16 text-gold opacity-30" />
                      <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-8 text-gold" />
                   </div>
                   <span className="text-[10px] uppercase font-bold tracking-widest text-muted-vault mt-2">Tier Restricted</span>
                </div>
              </div>

              {/* Principle 5 */}
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-text-primary mb-4">
                    <Activity className="size-6 text-teal" />
                    5. Regulatory Reporting & Audit
                  </h3>
                  <p className="font-body text-muted-vault leading-relaxed">
                    Audit-ready PDF reports for **FINMA (Switzerland)**, **MiCA (EU)**, and **MAS (Singapore)** generated on-demand. Predictive compliance monitoring identifies anomalies before they trigger flags.
                  </p>
                </div>
                <div className="w-full md:w-72 rounded-sm bg-vault-surface border border-vault-border p-6">
                   <div className="flex flex-col gap-2">
                      <div className="h-2 w-full bg-teal/20 rounded-full" />
                      <div className="h-2 w-3/4 bg-teal/20 rounded-full" />
                      <div className="h-2 w-5/6 bg-teal/20 rounded-full" />
                      <div className="mt-2 text-[10px] font-bold text-teal text-right">FINMA Report · PDF</div>
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Infrastructure */}
          <section className="mb-16">
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-8">System Architecture</h2>
            <div className="rounded-sm border border-vault-border bg-vault-surface p-8">
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <h4 className="font-heading text-sm font-bold text-gold uppercase tracking-widest mb-2">Smart Contracts</h4>
                  <p className="text-xs text-muted-vault font-code">compliance_registry<br />settlement_engine<br />vault_program</p>
                </div>
                <div>
                  <h4 className="font-heading text-sm font-bold text-gold uppercase tracking-widest mb-2">Oracle Layer</h4>
                  <p className="text-xs text-muted-vault font-code">SIX Financial API<br />mTLS Auth (.p12)<br />Solana Oracles</p>
                </div>
                <div>
                  <h4 className="font-heading text-sm font-bold text-gold uppercase tracking-widest mb-2">Frontend Stack</h4>
                  <p className="text-xs text-muted-vault font-code">Next.js 15<br />React 19<br />Tailwind CSS v4</p>
                </div>
              </div>
              <div className="rounded-sm bg-vault-base p-6 text-left border border-vault-border font-code text-xs text-teal/80">
                <p>// Smart Contract Proof of Deployment</p>
                <p>Program ID: 5iRF8NUVhQuTGNd4Thndc4LA3PGShfgmKvWX4C25JAuG</p>
                <p>Environment: Solana Devnet</p>
                <p>Network: AMINA Switzerland Node</p>
              </div>
            </div>
          </section>

          {/* Footer of the article */}
          <footer className="mt-24 border-t border-vault-border pt-12 text-center">
             <div className="mb-6 flex justify-center">
                <span className="font-heading text-xl font-bold tracking-tight">VAULT<span className="text-gold">OX</span></span>
             </div>
             <p className="font-body text-sm text-muted-vault">
                StableHacks 2026 — Team VaultOX <br />
                Built on Solana · Powered by SIX · Yield by Solstice
             </p>
          </footer>
        </article>
      </main>

      {/* ── CTA ── */}
      <section className="bg-vault-surface py-20 text-center border-t border-vault-border">
         <div className="mx-auto max-w-xl px-6">
            <h2 className="font-heading text-3xl font-bold text-text-primary mb-6">Experience the future of institutional settlement</h2>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-sm bg-gold px-8 font-heading text-sm font-bold text-vault-base transition-all hover:bg-gold/90">
               Launch Dashboard
            </Link>
         </div>
      </section>
    </div>
  );
}
