"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ShieldOff,
  CheckCircle,
  ChevronRight,
  Wallet,
  Building2,
  Mail,
  Globe,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "@/store";
import type { CredentialStatus } from "@/types";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import Image from "next/image";

const JURISDICTION_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Republic of the Congo)",
  "Costa Rica",
  "Côte d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
].sort((a, b) => a.localeCompare(b));

const ROLE_OPTIONS = [
  "Board Member",
  "CEO / Managing Director",
  "CFO",
  "COO",
  "CIO",
  "CTO",
  "Chief Compliance Officer",
  "Chief Legal Officer / General Counsel",
  "Chief Risk Officer",
  "Chief Operating Officer",
  "Chief Technology Officer",
  "Chief Investment Officer",
  "Chief Security Officer",
  "MLRO (Money Laundering Reporting Officer)",
  "Compliance Director",
  "Compliance Manager",
  "Compliance Officer",
  "KYC / Onboarding Manager",
  "KYC / Onboarding Analyst",
  "AML Analyst",
  "Sanctions Officer",
  "Regulatory Affairs Manager",
  "Legal Counsel",
  "Finance Director",
  "Finance Manager",
  "Controller",
  "Head of Treasury",
  "Treasury Manager",
  "Treasury Operations Specialist",
  "Settlement Operations Manager",
  "Settlement Operations Analyst",
  "Head of Operations",
  "Operations Manager",
  "Back Office Manager",
  "Middle Office Manager",
  "Risk Manager",
  "Risk Analyst",
  "Head of Trading",
  "Trader",
  "Portfolio Manager",
  "Investment Manager",
  "Custody Operations Manager",
  "Payments Manager",
  "Relationship Manager",
  "Institutional Sales",
  "Business Development Manager",
  "Authorized Signatory",
  "Company Secretary",
  "Internal Auditor",
  "External Auditor",
  "Other",
].sort((a, b) => a.localeCompare(b));

// ─── Sub-view: Pending KYC ──────────────────────────────────────────────────

function PendingKYCView({
  walletAddress,
  onDisconnect,
}: {
  walletAddress: string;
  onDisconnect: () => void;
}) {
  return (
    <motion.div
      key="pending_kyc"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-6 text-center max-w-sm"
    >
      {/* Icon */}
      <div className="relative flex size-16 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/5">
        <Clock className="size-8 text-gold" />
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-vault-base">
          KYC
        </span>
      </div>

      {/* Copy */}
      <div>
        <h2 className="font-heading text-2xl text-text-primary">
          Application Under Review
        </h2>
        <p className="mt-2 font-body text-sm text-muted-vault leading-relaxed">
          Your institution&apos;s compliance application has been received and
          is currently under review by our regulatory team. This typically takes
          2–5 business days.
        </p>
      </div>

      {/* Status card */}
      <div className="w-full rounded-sm border border-vault-border bg-vault-elevated px-5 py-4 text-left space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-body text-xs text-muted-vault uppercase tracking-widest">
            Status
          </span>
          <span className="rounded-sm bg-gold/10 px-2.5 py-1 font-code text-[11px] text-gold">
            Pending KYC Review
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-body text-xs text-muted-vault uppercase tracking-widest">
            Wallet
          </span>
          <span className="font-code text-[11px] text-muted-vault">
            {walletAddress}
          </span>
        </div>
        <div className="flex items-start gap-2 pt-2 border-t border-vault-border/50">
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-ok" />
          <p className="font-body text-[11px] text-muted-vault">
            You will receive an email notification once your credential has been
            issued. You can then reconnect your wallet to gain full access.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full space-y-2">
        {[
          { step: "1", label: "Application Submitted", done: true },
          {
            step: "2",
            label: "Identity Verification (KYC)",
            done: false,
            active: true,
          },
          { step: "3", label: "Regulatory Approval", done: false },
          { step: "4", label: "Credential Issued On-Chain", done: false },
        ].map(({ step, label, done, active }) => (
          <div
            key={step}
            className={cn(
              "flex items-center gap-3 rounded-sm px-4 py-2.5",
              done && "bg-ok/5",
              active && "bg-gold/5 border border-gold/20",
              !done && !active && "opacity-40",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-code text-[10px] font-bold",
                done && "bg-ok text-vault-base",
                active && "bg-gold text-vault-base",
                !done && !active && "bg-vault-border text-muted-vault",
              )}
            >
              {done ? "✓" : step}
            </span>
            <span
              className={cn(
                "font-body text-xs",
                done && "text-ok",
                active && "text-gold font-medium",
                !done && !active && "text-muted-vault",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onDisconnect}
        className="mt-2 font-body text-xs text-muted-vault underline-offset-2 hover:underline"
      >
        Disconnect and return to login
      </button>
    </motion.div>
  );
}

// ─── Sub-view: Unregistered — Request Access ────────────────────────────────

function RequestAccessView({
  walletAddress,
  onDisconnect,
}: {
  walletAddress: string;
  onDisconnect: () => void;
}) {
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [isHydrating, setIsHydrating] = useState(true);
  const [form, setForm] = useState({
    institutionName: "",
    jurisdiction: "",
    email: "",
    role: "",
  });

  useEffect(() => {
    let isMounted = true;

    const hydrateFromBackend = async () => {
      if (!walletAddress || walletAddress === "Unknown Wallet") {
        if (isMounted) {
          setIsHydrating(false);
        }
        return;
      }

      try {
        const { data } = await api.get(`/auth/request-access/${walletAddress}`);

        if (!isMounted) {
          return;
        }

        if (data?.exists && data?.request) {
          setForm({
            institutionName: data.request.institutionName ?? "",
            jurisdiction: data.request.jurisdiction ?? "",
            email: data.request.email ?? "",
            role: data.request.role ?? "",
          });
          setStep("submitted");
        }
      } catch {
        // Keep default state when lookup fails.
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    hydrateFromBackend();

    return () => {
      isMounted = false;
    };
  }, [walletAddress]);

  const isValid =
    form.institutionName.trim() &&
    form.jurisdiction.trim() &&
    form.email.trim() &&
    form.role.trim();

  const handleSubmit = async () => {
    await api.post("/auth/request-access", { ...form, walletAddress });
    setStep("submitted");
  };

  if (isHydrating) {
    return (
      <motion.div
        key="request-hydrating"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4 text-center max-w-sm"
      >
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-vault-border bg-vault-elevated">
          <Clock className="size-8 text-muted-vault" />
        </div>
        <p className="font-body text-sm text-muted-vault">
          Checking your latest access request...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="unregistered"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-6 text-center max-w-sm"
    >
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6 w-full"
          >
            {/* Icon */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full border-2 border-vault-border bg-vault-elevated">
                <ShieldOff className="size-8 text-muted-vault" />
              </div>
              <div>
                <h2 className="font-heading text-2xl text-text-primary">
                  Wallet Not Registered
                </h2>
                <p className="mt-2 font-body text-sm text-muted-vault leading-relaxed">
                  This wallet does not have an active VaultOX credential.
                  Complete the form below to request institutional access.
                </p>
              </div>
            </div>

            {/* Wallet display */}
            <div className="flex items-center gap-2 rounded-sm bg-vault-elevated border border-vault-border px-4 py-2.5">
              <Wallet className="size-4 shrink-0 text-muted-vault" />
              <span className="font-code text-[11px] text-muted-vault truncate">
                {walletAddress}
              </span>
            </div>

            {/* Form */}
            <div className="space-y-3 text-left">
              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Institution Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-vault" />
                  <input
                    type="text"
                    value={form.institutionName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        institutionName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Acme Financial AG"
                    className="w-full rounded-sm border border-vault-border bg-vault-elevated py-2.5 pl-9 pr-4 font-body text-sm text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Jurisdiction
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-vault" />
                  <select
                    value={form.jurisdiction}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, jurisdiction: e.target.value }))
                    }
                    className="w-full appearance-none rounded-sm border border-vault-border bg-vault-elevated py-2.5 pl-9 pr-4 font-body text-sm text-text-primary focus:border-gold/40 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select country
                    </option>
                    {JURISDICTION_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Your Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                  className="w-full appearance-none rounded-sm border border-vault-border bg-vault-elevated px-4 py-2.5 font-body text-sm text-text-primary focus:border-gold/40 focus:outline-none"
                >
                  <option value="" disabled>
                    Select role
                  </option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-widest text-muted-vault">
                  Contact Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-vault" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="you@institution.com"
                    className="w-full rounded-sm border border-vault-border bg-vault-elevated py-2.5 pl-9 pr-4 font-body text-sm text-text-primary placeholder:text-muted-vault/40 focus:border-gold/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-gold py-3 font-heading text-sm font-semibold text-vault-base transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Access Request
              <ChevronRight className="size-4" />
            </button>

            <button
              onClick={onDisconnect}
              className="font-body text-xs text-muted-vault underline-offset-2 hover:underline"
            >
              Disconnect and return to login
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-ok/40 bg-ok/10">
              <CheckCircle className="size-8 text-ok" />
            </div>
            <div>
              <h2 className="font-heading text-2xl text-ok">
                Request Received
              </h2>
              <p className="mt-2 font-body text-sm text-muted-vault leading-relaxed">
                Your access request for{" "}
                <span className="text-text-primary font-medium">
                  {form.institutionName}
                </span>{" "}
                has been submitted. Our compliance team will contact{" "}
                <span className="text-text-primary font-medium">
                  {form.email}
                </span>{" "}
                within 1–2 business days.
              </p>
            </div>
            <div className="w-full rounded-sm border border-vault-border bg-vault-elevated px-5 py-3 text-left space-y-2">
              <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault mb-2">
                Submission Summary
              </p>
              {[
                { label: "Institution", value: form.institutionName },
                { label: "Jurisdiction", value: form.jurisdiction },
                { label: "Role", value: form.role },
                { label: "Email", value: form.email },
                { label: "Wallet", value: walletAddress },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-body text-[11px] text-muted-vault">
                    {label}
                  </span>
                  <span className="font-code text-[11px] text-text-primary max-w-48 truncate text-right">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 font-body text-xs text-muted-vault underline-offset-2 hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Return to login
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main AccessPendingView ─────────────────────────────────────────────────

export function AccessPendingView({ status }: { status: CredentialStatus }) {
  const router = useRouter();
  const { walletAddress, disconnect } = useAuthStore();

  const handleDisconnect = () => {
    disconnect();
    router.push("/login");
  };

  const address = walletAddress ?? "Unknown Wallet";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-vault-base px-6 py-12">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-10"
      >
        {/* <span className="font-heading text-2xl font-bold text-gold tracking-tight">
          VAULT<span className="text-text-primary">OX</span>
        </span> */}
        <Image
          src="/vaultox-logo.png"
          width={100}
          height={50}
          alt="Vaultox Logo"
          //  className="rounded-full"
        />
      </motion.div>

      {status === "pending_kyc" ? (
        <PendingKYCView
          walletAddress={address}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <RequestAccessView
          walletAddress={address}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
