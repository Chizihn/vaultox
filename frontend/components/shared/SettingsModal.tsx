"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Globe, Shield, ChevronDown, Check } from "lucide-react";
import { useAuthStore } from "@/store";
import {
  useSettings,
  useNotificationPreferences,
  useUpdateSettings,
  useUpdateNotifications,
} from "@/hooks/api/useSettings";
import { type NotificationPreferences } from "@/services/settings";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const CURRENCIES = ["USD", "EUR", "CHF"] as const;
const TIMEZONES = [
  "Europe/Zurich (UTC+1)",
  "Europe/London (UTC+0)",
  "America/New_York (UTC-5)",
  "Asia/Singapore (UTC+8)",
  "Asia/Tokyo (UTC+9)",
  "Asia/Dubai (UTC+4)",
];

type SettingsSection = "notifications" | "preferences" | "security";

type ToggleNotificationKey =
  | "settlementCompleted"
  | "credentialExpiringSoon"
  | "yieldAccrued"
  | "reportReady";

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  settlementCompleted: true,
  settlementFailed: true,
  amlFlagRaised: true,
  credentialExpiringSoon: true,
  yieldAccrued: true,
  reportReady: false,
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { institution } = useAuthStore();

  const { data: settings } = useSettings();
  const { data: notifications } = useNotificationPreferences();
  const { mutate: updateSettings } = useUpdateSettings();
  const { mutate: updateNotifications } = useUpdateNotifications();

  // Handle local UI state for properties not in API yet
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const safeSettings = settings || {
    currency: "USD",
    timezone: "Europe/Zurich (UTC+1)",
  };

  const safeNotifications = notifications ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("notifications");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const handleSave = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const notifItems: {
    key: ToggleNotificationKey;
    label: string;
    desc: string;
  }[] = [
    {
      key: "settlementCompleted",
      label: "Settlements",
      desc: "Alerts when settlements complete, fail, or need attention",
    },
    {
      key: "credentialExpiringSoon",
      label: "Compliance",
      desc: "Credential expiry warnings and tier change notifications",
    },
    {
      key: "yieldAccrued",
      label: "Vault & Yield",
      desc: "Daily yield accruals and position updates",
    },
    {
      key: "reportReady",
      label: "System",
      desc: "Maintenance windows and platform announcements",
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            // onClick={onClose} // Removed to prevent accidental closure
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="overflow-hidden rounded-sm border border-vault-border bg-vault-surface shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-vault-border px-6 py-4">
                <div>
                  <h2 className="font-heading text-sm font-semibold text-text-primary">
                    Settings
                  </h2>
                  {institution && (
                    <p className="font-body text-[11px] text-muted-vault">
                      {institution.name} · {institution.jurisdiction}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="flex size-7 items-center justify-center rounded-sm text-muted-vault transition-colors hover:bg-vault-elevated hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex">
                {/* Sidebar */}
                <nav className="w-40 shrink-0 border-r border-vault-border py-3">
                  {(
                    [
                      {
                        key: "notifications" as SettingsSection,
                        label: "Notifications",
                        icon: Bell,
                      },
                      {
                        key: "preferences" as SettingsSection,
                        label: "Preferences",
                        icon: Globe,
                      },
                      {
                        key: "security" as SettingsSection,
                        label: "Security",
                        icon: Shield,
                      },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-body text-sm transition-colors",
                        activeSection === key
                          ? "bg-vault-elevated text-text-primary"
                          : "text-muted-vault hover:text-text-primary",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {label}
                      {activeSection === key && (
                        <motion.div
                          layoutId="settings-indicator"
                          className="absolute right-0 h-8 w-0.5 rounded-full bg-gold"
                        />
                      )}
                    </button>
                  ))}
                </nav>

                {/* Content */}
                <div className="flex-1 p-6">
                  <AnimatePresence mode="wait">
                    {activeSection === "notifications" && (
                      <motion.div
                        key="notif"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        <p className="font-body text-[10px] uppercase tracking-widest text-muted-vault">
                          Notification Channels
                        </p>
                        {notifItems.map(({ key, label, desc }) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-heading text-xs font-medium text-text-primary">
                                {label}
                              </p>
                              <p className="font-body text-[11px] text-muted-vault">
                                {desc}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                updateNotifications({
                                  [key]: !safeNotifications[key],
                                })
                              }
                              className={cn(
                                "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                                safeNotifications[key]
                                  ? "bg-teal"
                                  : "bg-vault-elevated border border-vault-border",
                              )}
                              role="switch"
                              aria-checked={Boolean(safeNotifications[key])}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200",
                                  safeNotifications[key]
                                    ? "translate-x-4"
                                    : "translate-x-0.5",
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {activeSection === "preferences" && (
                      <motion.div
                        key="prefs"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-5"
                      >
                        {/* Display Currency */}
                        <div>
                          <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Display Currency
                          </p>
                          <div className="relative">
                            <button
                              onClick={() => {
                                setCurrencyOpen((o) => !o);
                                setTzOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-sm text-text-primary transition-colors hover:border-gold/30"
                            >
                              <span>{safeSettings.currency}</span>
                              <ChevronDown className="size-3.5 text-muted-vault" />
                            </button>
                            {currencyOpen && (
                              <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-sm border border-vault-border bg-vault-surface shadow-xl">
                                {CURRENCIES.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => {
                                      updateSettings({ currency: c });
                                      setCurrencyOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 font-body text-sm text-text-primary transition-colors hover:bg-vault-elevated"
                                  >
                                    {c}
                                    {safeSettings.currency === c && (
                                      <Check className="size-3.5 text-teal" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Timezone */}
                        <div>
                          <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Timezone
                          </p>
                          <div className="relative">
                            <button
                              onClick={() => {
                                setTzOpen((o) => !o);
                                setCurrencyOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-sm border border-vault-border bg-vault-elevated px-3 py-2 font-body text-xs text-text-primary transition-colors hover:border-gold/30"
                            >
                              <span className="truncate">
                                {safeSettings.timezone}
                              </span>
                              <ChevronDown className="size-3.5 shrink-0 text-muted-vault" />
                            </button>
                            {tzOpen && (
                              <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-sm border border-vault-border bg-vault-surface shadow-xl max-h-40 overflow-y-auto">
                                {TIMEZONES.map((tz) => (
                                  <button
                                    key={tz}
                                    onClick={() => {
                                      updateSettings({ timezone: tz });
                                      setTzOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 font-body text-xs text-text-primary transition-colors hover:bg-vault-elevated"
                                  >
                                    <span className="truncate">{tz}</span>
                                    {safeSettings.timezone === tz && (
                                      <Check className="size-3.5 shrink-0 text-teal" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Theme */}
                        <div>
                          <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Theme
                          </p>
                          <div className="flex items-center gap-2 rounded-sm border border-vault-border bg-vault-elevated px-3 py-2">
                            <span className="size-3 rounded-full bg-vault-base ring-1 ring-vault-border" />
                            <span className="font-body text-sm text-text-primary">
                              Vault Dark
                            </span>
                            <span className="ml-auto font-code text-[10px] text-muted-vault">
                              Default
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSection === "security" && (
                      <motion.div
                        key="sec"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        {/* 2FA Toggle */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-heading text-xs font-medium text-text-primary">
                              Two-Factor Authentication
                            </p>
                            <p className="font-body text-[11px] text-muted-vault">
                              Require TOTP code on each login
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setTwoFactorEnabled(!twoFactorEnabled)
                            }
                            className={cn(
                              "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                              twoFactorEnabled
                                ? "bg-ok"
                                : "bg-vault-elevated border border-vault-border",
                            )}
                            role="switch"
                            aria-checked={twoFactorEnabled}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200",
                                twoFactorEnabled
                                  ? "translate-x-4"
                                  : "translate-x-0.5",
                              )}
                            />
                          </button>
                        </div>

                        {/* API Keys */}
                        <div>
                          <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            API Access
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5">
                              <div>
                                <p className="font-code text-[11px] text-text-primary">
                                  vaultox_sk_live_••••••••••••3f9a
                                </p>
                                <p className="font-body text-[10px] text-muted-vault">
                                  Created Jan 15, 2026 · Last used 2h ago
                                </p>
                              </div>
                              <button className="font-body text-[11px] text-warn hover:underline">
                                Revoke
                              </button>
                            </div>
                            <button className="w-full rounded-sm border border-dashed border-vault-border py-2 font-body text-xs text-muted-vault transition-colors hover:border-gold/30 hover:text-gold">
                              + Generate New API Key
                            </button>
                          </div>
                        </div>

                        {/* Session */}
                        <div>
                          <p className="mb-2 font-body text-[10px] uppercase tracking-widest text-muted-vault">
                            Active Sessions
                          </p>
                          <div className="rounded-sm border border-vault-border bg-vault-elevated px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-heading text-xs font-medium text-text-primary">
                                  Current Session
                                </p>
                                <p className="font-body text-[10px] text-muted-vault">
                                  Chrome · Zurich, Switzerland · Now
                                </p>
                              </div>
                              <span className="size-2 rounded-full bg-ok" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-vault-border px-6 py-3">
                <p className="font-body text-[10px] text-muted-vault/50">
                  Changes are saved automatically
                </p>
                <motion.button
                  onClick={handleSave}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    "rounded-sm px-4 py-1.5 font-heading text-xs font-semibold transition-all",
                    saveFlash
                      ? "bg-ok/20 text-ok"
                      : "bg-gold text-vault-base hover:opacity-90",
                  )}
                >
                  {saveFlash ? "✓ Saved" : "Save Changes"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
