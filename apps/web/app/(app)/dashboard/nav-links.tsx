"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS, ALL_NAV_HREFS, SETTINGS_ITEM } from "./nav-items";

/**
 * Shared navigation renderer for both the desktop sidebar and the mobile drawer
 * (M3c), so grouping and active state live in one place and cannot drift.
 *
 * Active state is a longest-prefix match against the current path: the deepest
 * href that the pathname equals or sits under wins. That makes
 * /dashboard/money/expenses light Expenses rather than the Money Overview, and
 * keeps Home (/dashboard) active only on an exact match. Settings is rendered by
 * each shell's footer via SettingsNavLink, not inside the sections.
 */

function activeHrefFor(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_NAV_HREFS) {
    const matches = pathname === href || pathname.startsWith(href + "/");
    if (matches && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}

function itemClass(variant: "desktop" | "mobile", active: boolean): string {
  const size = variant === "mobile" ? "py-2.5 text-[14px]" : "py-2 text-[13.5px]";
  const state = active
    ? "bg-brand-primary/10 text-brand-primary"
    : "text-text-secondary hover:bg-surface-muted hover:text-foreground";
  return (
    "flex items-center gap-2.5 rounded-lg px-3 font-medium transition-colors " +
    size +
    " " +
    state
  );
}

export function NavLinks({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname);

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {NAV_SECTIONS.map((section, idx) => (
        <div key={section.header ?? "top-" + idx} className="space-y-0.5">
          {section.header ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {section.header}
            </p>
          ) : null}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={itemClass(variant, active)}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SettingsNavLink({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === SETTINGS_ITEM.href || pathname.startsWith(SETTINGS_ITEM.href + "/");
  const Icon = SETTINGS_ITEM.icon;
  return (
    <Link
      href={SETTINGS_ITEM.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={itemClass(variant, active)}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {SETTINGS_ITEM.label}
    </Link>
  );
}
