/**
 * Site-wide configuration. Single source of truth for nav links,
 * brand strings, and external URLs. Shared by SiteNav, Footer, etc.
 */
export const siteConfig = {
  name: "1Man.Biz",
  tagline: "The AI operating system for modern SMEs.",
  description:
    "Connect WhatsApp, Instagram, email, SMS, and your business tools into one system for orders, customers, receipts, bookings, inventory, and growth.",
  url: "https://1man.biz",
  nav: [
    { label: "Product", href: "#product" },
    { label: "Features", href: "#features" },
    { label: "Workflow", href: "#workflow" },
    { label: "Pricing", href: "#pricing" },
  ],
} as const;

export type SiteNavLink = (typeof siteConfig.nav)[number];
