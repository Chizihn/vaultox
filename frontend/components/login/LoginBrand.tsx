"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const STATS = [
  { label: "Assets Under Management", value: "$2,840.50", suffix: "USDC" },
  { label: "Cross-Border Settlements", value: "14", suffix: "completed" },
  { label: "Compliance Score", value: "98.6", suffix: "/ 100" },
];

const PARTNERS = [
  "AMINA Bank",
  "DBS Singapore",
  "Goldman Sachs Digital",
  "Fireblocks",
  "Solana Foundation",
];

export function LoginBrand() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-vault-base p-10">
      {/* Grid dot background */}
      <div className="bg-grid-dots pointer-events-none absolute inset-0 opacity-30" />

      {/* Top accent line */}
      <div className="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-gold/40 to-transparent" />

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="font-code text-[10px] uppercase tracking-[0.3em] text-muted-vault">
          Institutional Stablecoin OS
        </p>
        {/* <h1 className="font-heading text-5xl leading-none text-gold tracking-tight mt-1">
          VAULT<span className="text-text-primary">OX</span>
        </h1> */}
        <Image
          src="/vaultox-logo.png"
          width={200}
          height={70}
          alt="Vaultox Logo"
          className="rounded-full mt-6"
        />
        <p className="mt-3 font-body text-xs text-muted-vault max-w-xs leading-relaxed">
          On-chain treasury management for regulated financial institutions.
          {/* <br />
          Built on Solana. Compliant by design. */}
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="space-y-5"
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
          >
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
              {s.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-body text-3xl text-gold leading-tight">
                {s.value}
              </span>
              <span className="font-body text-xs text-muted-vault">
                {s.suffix}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Partners */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        <p className="mb-3 font-body text-[9px] uppercase tracking-[0.3em] text-muted-vault/60">
          Trusted By
        </p>
        <div className="flex flex-wrap gap-2">
          {PARTNERS.map((p) => (
            <span
              key={p}
              className="rounded-sm border border-vault-border px-2.5 py-1 font-code text-[10px] text-muted-vault"
            >
              {p}
            </span>
          ))}
        </div>
        <p className="mt-6 font-code text-[9px] text-muted-vault/40">
          © 2026 VaultOX · StableHacks · All rights reserved
        </p>
      </motion.div>
    </div>
  );
}
