"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/utils/constants";
import { formatAddress } from "@/utils/format";
import { TierBadge } from "@/components/shared/TierBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { WalletModal } from "@/components/shared/WalletModal";
import { SettingsModal } from "@/components/shared/SettingsModal";
import { useAuthStore } from "@/store";
import { useNotificationStore } from "@/store";
import { useDashboard } from "@/hooks/api/useDashboard";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const { institution, walletAddress, tier } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();
  const { metrics, isLoading } = useDashboard();
  
  const safeMetrics = metrics || { totalAUM: 0, aumDelta: 0, yieldToday: 0, activeSettlements: 0, pendingSettlements: 0, complianceScore: 0 };

  return (
    <header className="sticky top-0 z-50 border-b border-vault-border bg-vault-surface/95 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* ── Left: Logo + Institution ── */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="font-heading text-xl font-bold text-gold tracking-tight">
              VAULT<span className="text-text-primary">OS</span>
            </span>
          </Link>

          {institution && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-vault-border">|</span>
              <span className="font-body text-xs text-muted-vault truncate max-w-35">
                {institution.name}
              </span>
              {tier && (
                <TierBadge
                  tier={tier}
                  size="sm"
                  className="hidden lg:inline-flex"
                />
              )}
            </div>
          )}
        </div>

        {/* ── Center: Nav links (desktop) ── */}
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link, i) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "relative px-3 py-1.5 font-heading text-sm font-medium transition-colors duration-150",
                    active
                      ? "text-gold"
                      : "text-muted-vault hover:text-text-primary",
                  )}
                >
                  {link.label}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute inset-x-0 -bottom-px h-px bg-gold"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* ── Right: AUM + Bell + Wallet ── */}
        <div className="flex items-center gap-2">
          {/* AUM ticker */}
          <div className="hidden items-center gap-1 lg:flex">
            <span className="font-heading text-[11px] uppercase tracking-widest text-muted-vault">
              AUM
            </span>
            <span className="font-heading text-base text-gold">
              <AnimatedNumber
                value={safeMetrics.totalAUM}
                format="compact-currency"
              />
            </span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex size-8 items-center justify-center rounded-sm border border-vault-border bg-vault-elevated transition-colors hover:border-gold/40"
              aria-label="Notifications"
            >
              <Bell className="size-4 text-muted-vault" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-vault-base">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 z-50 w-80 rounded-sm border border-vault-border bg-vault-surface shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-vault-border px-4 py-3">
                      <span className="font-heading text-sm font-semibold text-text-primary">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="font-body text-[11px] text-teal hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <ul className="divide-y divide-vault-border/50 max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={() => markAsRead(n.id)}
                            className={cn(
                              "w-full px-4 py-3 text-left transition-colors hover:bg-vault-elevated",
                              !n.read && "bg-vault-elevated/50",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                              )}
                              <div className={cn(!n.read ? "" : "pl-3.5")}>
                                <p className="font-heading text-xs font-semibold text-text-primary">
                                  {n.title}
                                </p>
                                <p className="mt-0.5 font-body text-[11px] text-muted-vault">
                                  {n.message}
                                </p>
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Wallet button — opens WalletModal */}
          {walletAddress && (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="hidden items-center gap-1.5 rounded-sm border border-vault-border bg-vault-elevated px-2.5 py-1.5 transition-all sm:flex hover:border-gold/30 hover:bg-vault-surface"
              aria-label="Wallet menu"
            >
              {institution ? (
                <UserAvatar name={institution.name} size="xs" />
              ) : (
                <div className="size-2 rounded-full bg-ok" />
              )}
              <span className="font-code text-[11px] text-muted-vault">
                {formatAddress(walletAddress)}
              </span>
              <ChevronDown className="size-3 text-muted-vault" />
            </button>
          )}

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex size-8 items-center justify-center rounded-sm border border-vault-border bg-vault-elevated md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="size-4 text-text-primary" />
            ) : (
              <Menu className="size-4 text-text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile nav ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-vault-border bg-vault-surface md:hidden"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col py-2">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block px-6 py-3 font-heading text-sm font-medium",
                        active ? "text-gold" : "text-muted-vault",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {walletAddress && (
                <li>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setWalletModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 mx-0 mt-0 border-t border-vault-border px-6 py-3 text-left"
                  >
                    {institution ? (
                      <UserAvatar name={institution.name} size="xs" />
                    ) : (
                      <div className="size-2 rounded-full bg-ok" />
                    )}
                    <div className="min-w-0">
                      {institution && (
                        <p className="font-heading text-xs font-medium text-text-primary truncate">
                          {institution.name}
                        </p>
                      )}
                      <p className="font-code text-[10px] text-muted-vault">
                        {formatAddress(walletAddress)}
                      </p>
                    </div>
                    <ChevronDown className="ml-auto size-3.5 text-muted-vault" />
                  </button>
                </li>
              )}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* ── Modals (rendered via Portal, anchored to viewport) ── */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </header>
  );
}
