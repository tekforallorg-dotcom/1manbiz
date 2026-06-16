import Link from "next/link";

/**
 * Money sub-navigation. A pure server component (Links only) rendered by both
 * Money pages, each passing its own active key. This local nav survives the
 * later M3c sidebar regroup -- it is page-level, not global chrome. Styling
 * mirrors the period pills on the Overview for visual consistency.
 */

const TABS = [
  { key: "overview", label: "Overview", href: "/dashboard/money" },
  { key: "expenses", label: "Expenses", href: "/dashboard/money/expenses" },
] as const;

export function MoneyTabs({ active }: { active: "overview" | "expenses" }) {
  return (
    <div className="inline-flex rounded-full bg-surface-muted p-1">
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={
              "rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors " +
              (on
                ? "bg-white text-foreground shadow-sm"
                : "text-text-secondary hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
