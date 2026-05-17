import Link from "next/link";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#workflow" },
    { label: "Pricing", href: "#pricing" },
    { label: "For your business", href: "#personas" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "Help center", href: "#" },
    { label: "Community", href: "#" },
    { label: "Blog", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
    { label: "Cookies", href: "#" },
  ],
} as const;

export function SiteFooter() {
  return (
    <footer className="relative bg-foreground text-background pt-16 sm:pt-20 lg:pt-24 pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-y-10 gap-x-8 lg:gap-x-12">
          {/* Brand + tagline */}
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="inline-flex items-baseline font-bold tracking-[-0.02em] text-[22px]">
              <span className="text-background">1Man</span>
              <span className="text-brand-primary">.Biz</span>
            </Link>
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-background/60">
              One system for every business conversation. Built for businesses that sell through messages.
            </p>
            <p className="mt-6 text-[12px] text-background/40">
              Made in Lagos &middot; For African SMEs
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <p className="text-[10.5px] uppercase tracking-[0.16em] font-bold text-background/40">
                {title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-background/80 hover:text-background transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 sm:mt-16 pt-6 border-t border-background/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[12.5px] text-background/40">
            © 2026 1Man.Biz. All rights reserved.
          </p>
          <p className="text-[12.5px] text-background/40">
            One operating system for modern SMEs.
          </p>
        </div>
      </div>
    </footer>
  );
}
