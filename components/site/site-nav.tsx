"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/wordmark";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Track scroll for transparent → blurred backdrop transition.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-300",
          scrolled
            ? "bg-background/75 backdrop-blur-xl border-b border-border/60"
            : "bg-transparent border-b border-transparent",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/"
              className="flex items-center -ml-1 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              aria-label="1Man.Biz home"
            >
              <Wordmark className="text-[20px]" />
            </Link>

            <nav aria-label="Primary" className="hidden md:flex items-center gap-8">
              {siteConfig.nav.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13.5px] font-medium text-text-secondary hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/login"
                className="text-[13.5px] font-medium text-text-secondary hover:text-foreground transition-colors px-3 py-2 rounded-full hover:bg-surface-muted"
              >
                Log in
              </Link>
              <Button size="sm">Start free</Button>
            </div>

            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-full text-foreground hover:bg-surface-muted transition-colors"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-drawer"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 right-0 w-full max-w-sm bg-background shadow-[-24px_0_60px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-16 items-center justify-between px-5 border-b border-border">
            <Wordmark className="text-lg" />
            <button
              type="button"
              className="inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-full text-foreground hover:bg-surface-muted transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col p-4 gap-0.5">
            {siteConfig.nav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-3 text-[15px] font-medium text-foreground rounded-xl hover:bg-surface-muted transition-colors"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="px-3 py-3 text-[15px] font-medium text-foreground rounded-xl hover:bg-surface-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <div className="mt-4 px-3">
              <Button size="lg" className="w-full" onClick={() => setOpen(false)}>
                Start free
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
