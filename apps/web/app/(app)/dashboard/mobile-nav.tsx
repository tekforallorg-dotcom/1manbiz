"use client";

import {
  Bot,
  Calendar,
  Home,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { signOutAction } from "@/app/(auth)/actions";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Receipts", href: "/dashboard/receipts", icon: Receipt },
  { label: "Insights", href: "/dashboard/insights", icon: LineChart },
  { label: "AI Staff", href: "/dashboard/ai-staff", icon: Bot },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

type Props = {
  businessName: string | null;
  userName: string;
};

export function MobileNav({ businessName, userName }: Props) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setOpen(false);

  return (
    <>
      {/* Topbar ? z-30: above page, below backdrop+drawer when open */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 p-2 text-text-secondary transition-colors hover:text-foreground"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-baseline text-[18px] font-bold tracking-[-0.02em]"
        >
          <span className="text-foreground">1Man</span>
          <span className="text-brand-primary">.Biz</span>
        </Link>
      </header>

      {/* Backdrop ? z-40: above topbar, below drawer. More opaque + stronger blur. */}
      <div
        onClick={close}
        aria-hidden
        className={`fixed inset-0 z-40 bg-foreground/60 backdrop-blur-md transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer ? z-50: top of stack. Solid white + shadow-2xl for clean separation. */}
      <aside
        aria-hidden={!open}
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            href="/dashboard"
            onClick={close}
            className="inline-flex items-baseline text-[20px] font-bold tracking-[-0.02em]"
          >
            <span className="text-foreground">1Man</span>
            <span className="text-brand-primary">.Biz</span>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-2 p-2 text-text-secondary transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {businessName ? (
          <div className="border-b border-border px-5 py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Business
            </p>
            <p className="mt-1 truncate text-[14px] font-semibold text-foreground">
              {businessName}
            </p>
          </div>
        ) : null}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="px-3 pb-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Signed in as
            </p>
            <p className="mt-1 truncate text-[12.5px] font-medium text-foreground">
              {userName}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
