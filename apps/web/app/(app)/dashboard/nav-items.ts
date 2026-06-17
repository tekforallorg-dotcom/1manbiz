import {
  Banknote,
  Bot,
  Calendar,
  Home,
  LineChart,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for dashboard navigation (M3c). Both the desktop
 * sidebar and the mobile drawer render from this, so the two cannot drift.
 * Routes are unchanged from the previous flat nav: "Inbox" relabels the
 * conversations route, "Insights" keeps its route, and Expenses is the new
 * sub-route shipped in M3b. Settings is pinned to each shell's footer (so it
 * never scrolls off-screen) and therefore lives outside the sections, but its
 * href is included in ALL_NAV_HREFS so active matching does not light Home on
 * a settings page.
 */

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavSection = { header: string | null; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    header: null,
    items: [
      { label: "Home", href: "/dashboard", icon: Home },
      { label: "Inbox", href: "/dashboard/conversations", icon: MessageSquare },
      { label: "Insights", href: "/dashboard/insights", icon: LineChart },
    ],
  },
  {
    header: "Sell",
    items: [
      { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
      { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
      { label: "Inventory", href: "/dashboard/inventory", icon: Package },
      { label: "Customers", href: "/dashboard/customers", icon: Users },
    ],
  },
  {
    header: "Money",
    items: [
      { label: "Overview", href: "/dashboard/money", icon: Wallet },
      { label: "Expenses", href: "/dashboard/money/expenses", icon: Banknote },
      { label: "Receipts", href: "/dashboard/receipts", icon: Receipt },
    ],
  },
  {
    header: "More",
    items: [{ label: "BizBot", href: "/dashboard/bizbot", icon: Bot }],
  },
];

// Pinned to the footer of both shells, not part of the scrolling sections.
export const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
};

// Every navigable href (sections + footer), used for longest-prefix active
// matching so a deeper route wins and Home only lights on an exact match.
export const ALL_NAV_HREFS: string[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.href)),
  SETTINGS_ITEM.href,
];
