"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ── Animated counter (inline to avoid SSR mismatch) ─────────────────────────
function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * to).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to, decimals]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

// ── Marquee ticker ───────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  "AMINA → DBS  $2,000,000 USDC  1.4s",
  "Goldman Digital → AMINA  $500,000 USDC  1.8s",
  "DBS Singapore → Société Générale  $1,200,000 USDC  2.1s",
  "AMINA → Deutsche Bank  $750,000 USDC  0.9s",
  "Société Générale → DBS  $3,000,000 USDC  1.6s",
  "Deutsche Bank → Goldman Digital  $450,000 USDC  1.1s",
];

function Ticker() {
  return (
    <div className="w-full overflow-hidden border-y border-vault-border bg-vault-surface py-2.5">
      <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="mx-8 inline-flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-ok animate-pulse" />
            <span className="font-code text-[11px] text-muted-vault">
              {item}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Section fade-in wrapper ──────────────────────────────────────────────────
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

// ── Main ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-vault-base text-text-primary">
      {/* ── Navigation ────────────────────────────────────────────────── */}
      <header
        role="banner"
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          navScrolled
            ? "border-b border-vault-border bg-vault-base/95 backdrop-blur-sm"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10"
        >
          <Link
            href="/"
            className="font-heading text-xl leading-none text-gold"
            aria-label="VaultOX home"
          >
            {/* VAULT<span className="text-text-primary">OX</span>*/}
            <Image
              src="/vaultox-logo.png"
              width={150}
              height={60}
              alt="Vaultox Logo"
              //  className="rounded-full"
            />
          </Link>

          <ul className="hidden items-center gap-8 md:flex" role="list">
            {["Product", "Compliance", "Architecture", "Jurisdictions"].map(
              (item) => (
                <li key={item}>
                  <a
                    href={`#${item.toLowerCase()}`}
                    className="font-code text-[11px] uppercase tracking-[0.15em] text-muted-vault transition-colors hover:text-text-primary"
                  >
                    {item}
                  </a>
                </li>
              ),
            )}
          </ul>

          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-sm border border-gold/30 px-4 py-2 font-heading text-xs font-semibold text-gold transition-all hover:bg-gold/10"
          >
            Access Terminal
            <ArrowUpRight className="size-3.5" />
          </Link>
        </nav>
      </header>

      <main id="main-content">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          aria-label="Hero"
          className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-20 pt-32 lg:px-10"
        >
          {/* Grid dot bg */}
          <div className="bg-grid-dots pointer-events-none absolute inset-0 opacity-20" />
          {/* Top gradient fade */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-vault-base to-transparent" />
          {/* Bottom gradient fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-vault-base to-transparent" />

          <div className="relative z-10 mx-auto max-w-5xl text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-sm border border-gold/20 px-4 py-1.5"
            >
              <span className="inline-block size-1.5 rounded-full bg-ok animate-pulse" />
              <span className="font-code text-[10px] uppercase tracking-[0.25em] text-muted-vault">
                StableHacks 2026 · Built on Solana
              </span>
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-heading text-[clamp(40px,8vw,96px)] leading-[0.95] tracking-tight"
            >
              <span className="text-text-primary">Settle Across</span>
              <br />
              <span className="text-text-primary">Borders. </span>
              <span className="text-gold">Instantly.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mx-auto mt-5 max-w-lg font-body text-sm leading-relaxed text-muted-vault"
            >
              The institutional cross-border settlement rail on Solana.
              <br />
              On-chain KYC. Travel Rule built-in. SIX-verified FX.
              Sub-2s finality.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <Link
                href="/login"
                className="rounded-sm bg-gold px-6 py-2.5 font-heading text-sm font-semibold text-vault-base transition-opacity hover:opacity-90"
              >
                Enter Platform
              </Link>
              <a
                href="#product"
                className="rounded-sm border border-vault-border px-6 py-2.5 font-heading text-sm text-muted-vault transition-colors hover:border-gold/20 hover:text-text-primary"
              >
                View Architecture
              </a>
            </motion.div>

            {/* Hero stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-vault-border bg-vault-border sm:grid-cols-4"
            >
              {[
                {
                  label: "Assets Under Management",
                  value: 4.1,
                  prefix: "$",
                  suffix: "B",
                  decimals: 1,
                },
                {
                  label: "Settlements Processed",
                  value: 99847,
                  prefix: "",
                  suffix: "",
                  decimals: 0,
                },
                {
                  label: "Avg Settlement Speed",
                  value: 1.8,
                  prefix: "",
                  suffix: "s",
                  decimals: 1,
                },
                {
                  label: "Compliance Score",
                  value: 98.6,
                  prefix: "",
                  suffix: "/100",
                  decimals: 1,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-start bg-vault-surface px-5 py-4"
                >
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                    {s.label}
                  </p>
                  <p className="mt-1 font-heading text-2xl text-gold">
                    <Counter
                      to={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Ticker ────────────────────────────────────────────────────── */}
        <Ticker />

        {/* ── Product Pillars ───────────────────────────────────────────── */}
        <section
          id="product"
          aria-label="Product pillars"
          className="mx-auto max-w-7xl border-b border-vault-border px-6 py-20 lg:px-10"
        >
          <Reveal>
            <div className="mb-12">
              <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
                01 / Product
              </p>
              <h2 className="mt-1 font-heading text-3xl text-text-primary">
              Three Layers. One Settlement Rail.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 divide-vault-border border border-vault-border md:grid-cols-3 md:divide-x">
            {[
              {
                index: "I",
                title: "Settlement Layer",
                tag: "Atomic Execution",
                description:
                  "Sub-2-second cross-border USDC settlement across 47 corridors. FX-locked at initiation via SIX. Non-custodial escrow, reversible only by mutual signature.",
                items: [
                  "Solana atomic finality",
                  "Travel Rule compliant (FATF)",
                  "SIX-verified FX rates",
                  "Holiday-aware corridors",
                ],
                accent: "text-teal",
              },
              {
                index: "II",
                title: "Compliance OS",
                tag: "On-chain Regulation",
                description:
                  "Vault Passport — a non-transferable on-chain credential encoding tier, jurisdiction, and permitted operations. Fireblocks-attested KYC.",
                items: [
                  "FINMA · MiCA · MAS ready",
                  "Non-transferable credential NFT",
                  "Automated audit trail",
                  "FATF Travel Rule built-in",
                ],
                accent: "text-ok",
              },
              {
                index: "III",
                title: "Vault Engine",
                tag: "Treasury Parking",
                description:
                  "Compliance-gated yield strategies for idle treasury capital between settlements. T-Bill exposure at 4.2%, private credit at 7.8%, commodity at 11.4%.",
                items: [
                  "Real-world asset integration",
                  "Maturity-matched allocation",
                  "Automatic yield accrual",
                  "Tier-gated access controls",
                ],
                accent: "text-gold",
              },
            ].map(({ index, title, tag, description, items, accent }, i) => (
              <Reveal key={title} delay={i * 0.1}>
                <article className="flex h-full flex-col p-8">
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <span
                        className={cn(
                          "font-heading text-4xl leading-none",
                          accent,
                        )}
                      >
                        {index}
                      </span>
                      <p className="mt-1 font-heading text-base font-semibold text-text-primary">
                        {title}
                      </p>
                    </div>
                    <span className="rounded-sm border border-vault-border px-2.5 py-1 font-code text-[9px] uppercase tracking-widest text-muted-vault">
                      {tag}
                    </span>
                  </div>

                  <p className="mb-6 font-body text-sm leading-relaxed text-muted-vault">
                    {description}
                  </p>

                  <ul className="mt-auto space-y-2" role="list">
                    {items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "block size-1 rounded-full",
                            accent.replace("text-", "bg-"),
                          )}
                        />
                        <span className="font-code text-[11px] text-muted-vault">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Architecture ──────────────────────────────────────────────── */}
        <section
          id="architecture"
          aria-label="Technical architecture"
          className="mx-auto max-w-7xl border-b border-vault-border px-6 py-20 lg:px-10"
        >
          <Reveal>
            <div className="mb-10">
              <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
                02 / Architecture
              </p>
              <h2 className="mt-1 font-heading text-3xl text-text-primary">
                Solana Program Stack
              </h2>
              <p className="mt-2 font-body text-sm text-muted-vault">
                Three on-chain programs. Fully composable. Open-source.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {/* Terminal frame */}
            <div className="overflow-hidden rounded-sm border border-vault-border">
              {/* Terminal titlebar */}
              <div className="flex items-center justify-between border-b border-vault-border bg-vault-surface px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-warn/50" />
                  <span className="size-2.5 rounded-full bg-gold/50" />
                  <span className="size-2.5 rounded-full bg-ok/50" />
                </div>
                <span className="font-code text-[10px] text-muted-vault/50">
                  solana · mainnet-beta
                </span>
                <span className="font-code text-[10px] text-ok">● live</span>
              </div>

              {/* Program cards */}
              <div className="bg-vault-base p-6">
                <p className="mb-4 font-code text-[11px] text-muted-vault">
                  <span className="text-teal">$</span> anchor deploy
                  --provider.cluster mainnet
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    {
                      name: "vault_manager",
                      address: "VLTm9x...3kQpR8",
                      lang: "Rust · Anchor",
                      lines: [
                        "deposit()",
                        "withdraw()",
                        "accrue_yield()",
                        "rebalance()",
                      ],
                      color: "border-gold/20",
                      badge: "text-gold",
                    },
                    {
                      name: "settlement_engine",
                      address: "SETLy7...9MnZ4w",
                      lang: "Rust · Anchor",
                      lines: [
                        "initiate_settlement()",
                        "lock_fx_rate()",
                        "finalize()",
                        "revert()",
                      ],
                      color: "border-teal/20",
                      badge: "text-teal",
                    },
                    {
                      name: "compliance_core",
                      address: "COMPr3...X4aK1p",
                      lang: "Rust · Anchor",
                      lines: [
                        "issue_credential()",
                        "verify_tier()",
                        "update_permissions()",
                        "revoke()",
                      ],
                      color: "border-ok/20",
                      badge: "text-ok",
                    },
                  ].map((prog) => (
                    <div
                      key={prog.name}
                      className={cn(
                        "rounded-sm border p-4",
                        prog.color,
                        "bg-vault-surface",
                      )}
                    >
                      <div className="mb-3">
                        <p
                          className={cn(
                            "font-code text-xs font-semibold",
                            prog.badge,
                          )}
                        >
                          {prog.name}
                        </p>
                        <p className="mt-0.5 font-code text-[10px] text-muted-vault/60">
                          {prog.address}
                        </p>
                      </div>
                      <p className="mb-3 font-code text-[9px] uppercase tracking-widest text-muted-vault/50">
                        {prog.lang}
                      </p>
                      <ul className="space-y-1" role="list">
                        {prog.lines.map((line) => (
                          <li
                            key={line}
                            className="font-code text-[11px] text-muted-vault"
                          >
                            <span className="text-muted-vault/40">fn </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <p className="mt-4 font-code text-[10px] text-ok">
                  ✓ All programs verified on Solana Explorer · Last audit: Jan
                  2026 by OtterSec
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Jurisdictions ─────────────────────────────────────────────── */}
        <section
          id="jurisdictions"
          aria-label="Supported jurisdictions"
          className="mx-auto max-w-7xl border-b border-vault-border px-6 py-20 lg:px-10"
        >
          <Reveal>
            <div className="mb-10">
              <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
                03 / Compliance
              </p>
              <h2 className="mt-1 font-heading text-3xl text-text-primary">
                Regulatory Coverage
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-sm border border-vault-border">
              <table
                className="min-w-full"
                aria-label="Jurisdiction compliance table"
              >
                <thead>
                  <tr className="border-b border-vault-border bg-vault-surface">
                    {[
                      "Jurisdiction",
                      "Regulation",
                      "Framework",
                      "Status",
                      "Max Tier",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-6 py-3 text-left font-code text-[10px] uppercase tracking-[0.2em] text-muted-vault"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-vault-border/40">
                  {[
                    {
                      flag: "🇨🇭",
                      jurisdiction: "Switzerland",
                      regulation: "VASP Act 2023",
                      framework: "FINMA",
                      status: "Active",
                      tier: "Tier 1",
                      ok: true,
                    },
                    {
                      flag: "🇪🇺",
                      jurisdiction: "European Union",
                      regulation: "MiCA Regulation",
                      framework: "EBA / ESMA",
                      status: "Active",
                      tier: "Tier 1",
                      ok: true,
                    },
                    {
                      flag: "🇸🇬",
                      jurisdiction: "Singapore",
                      regulation: "PSA 2019",
                      framework: "MAS",
                      status: "Active",
                      tier: "Tier 2",
                      ok: true,
                    },
                    {
                      flag: "🇦🇪",
                      jurisdiction: "UAE — ADGM",
                      regulation: "COBS Rules",
                      framework: "FSRA",
                      status: "Active",
                      tier: "Tier 2",
                      ok: true,
                    },
                    {
                      flag: "🇬🇧",
                      jurisdiction: "United Kingdom",
                      regulation: "FSMA 2000",
                      framework: "FCA",
                      status: "Q2 2026",
                      tier: "Tier 2",
                      ok: false,
                    },
                    {
                      flag: "🇺🇸",
                      jurisdiction: "United States",
                      regulation: "SEC / OCC",
                      framework: "Federal",
                      status: "Q3 2026",
                      tier: "Tier 3",
                      ok: false,
                    },
                  ].map((row) => (
                    <tr
                      key={row.jurisdiction}
                      className="transition-colors hover:bg-vault-elevated/40"
                    >
                      <td className="px-6 py-3.5 font-body text-xs text-text-primary">
                        <span className="mr-2">{row.flag}</span>
                        {row.jurisdiction}
                      </td>
                      <td className="px-6 py-3.5 font-code text-[11px] text-muted-vault">
                        {row.regulation}
                      </td>
                      <td className="px-6 py-3.5 font-code text-[11px] text-muted-vault">
                        {row.framework}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={cn(
                            "rounded-sm px-2 py-0.5 font-code text-[10px]",
                            row.ok
                              ? "bg-ok/10 text-ok"
                              : "bg-gold/10 text-gold",
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-code text-[11px] text-muted-vault">
                        {row.tier}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* ── Statement / Quote ─────────────────────────────────────────── */}
        <section
          aria-label="Mission statement"
          className="mx-auto max-w-7xl border-b border-vault-border px-6 py-24 text-center lg:px-10"
        >
          <Reveal>
            <blockquote>
              <p className="font-heading text-[clamp(24px,4vw,48px)] leading-tight text-text-primary">
                &ldquo;Compliant by design.
                <br />
                <span className="text-gold">Not by accident.</span>&rdquo;
              </p>
              <footer className="mt-6">
                <cite className="font-code text-[11px] not-italic text-muted-vault">
                  VaultOX — Built for regulated financial institutions.
                  StableHacks 2026.
                </cite>
              </footer>
            </blockquote>
          </Reveal>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section
          aria-label="Call to action"
          className="mx-auto max-w-7xl px-6 py-24 lg:px-10"
        >
          <Reveal>
            <div className="grid grid-cols-1 items-center gap-8 border border-vault-border bg-vault-surface p-10 sm:grid-cols-2">
              <div>
                <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
                  Request Access
                </p>
                <h2 className="mt-2 font-heading text-3xl text-text-primary">
                  Eligible institutions
                  <br />
                  <span className="text-gold">may request access.</span>
                </h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted-vault">
                  VaultOX is currently available to regulated financial
                  institutions with active VASP or equivalent licensing in
                  supported jurisdictions.
                </p>
              </div>

              <div className="flex flex-col items-start gap-4 sm:items-end">
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-sm bg-gold px-8 py-3 font-heading text-sm font-bold text-vault-base transition-opacity hover:opacity-90"
                >
                  Access Terminal
                  <ArrowUpRight className="size-4" />
                </Link>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-code text-[11px] text-muted-vault transition-colors hover:text-text-primary"
                >
                  View source on GitHub
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        role="contentinfo"
        className="border-t border-vault-border bg-vault-surface"
      >
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              {/* <p className="font-heading text-xl text-gold">
                VAULT<span className="text-text-primary">OX</span>
              </p> */}
              <Image
                src="/vaultox-logo.png"
                width={100}
                height={50}
                alt="Vaultox Logo"
                //  className="rounded-full"
              />
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-vault">
                Cross-Border Settlement Infrastructure.
                <br />
                Built on Solana.
                <br />
                StableHacks 2026.
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: "Platform",
                links: [
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Vaults", href: "/vaults" },
                  { label: "Settlements", href: "/settlements" },
                  { label: "Compliance", href: "/compliance" },
                  { label: "Reports", href: "/reports" },
                ],
              },
              {
                title: "Resources",
                links: [
                  { label: "How It Works", href: "/how-it-works" },
                  { label: "Platform Guide", href: "/guide" },
                  { label: "Login", href: "/login" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                ],
              },
            ].map(({ title, links }) => (
              <nav key={title} aria-label={`${title} links`}>
                <p className="mb-3 font-code text-[9px] uppercase tracking-[0.3em] text-muted-vault/50">
                  {title}
                </p>
                <ul className="space-y-2" role="list">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="font-body text-[11px] text-muted-vault transition-colors hover:text-text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-vault-border pt-6">
            <p className="font-code text-[10px] text-muted-vault/40">
              © 2026 VaultOX. All rights reserved. This is a demonstration
              product.
            </p>
            <p className="font-code text-[10px] text-muted-vault/40">
              Solana · Anchor · Next.js · StableHacks 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
