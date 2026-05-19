import {
  Home,
  LineChart,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

import { MobileNav } from "./mobile-nav";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Receipts", href: "/dashboard/receipts", icon: Receipt },
  { label: "Insights", href: "/dashboard/insights", icon: LineChart },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded) {
    redirect("/onboarding");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const userName = profile.full_name ?? user.email ?? "Account";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-6 py-5">
          <Link
            href="/dashboard"
            className="inline-flex items-baseline text-[20px] font-bold tracking-[-0.02em]"
          >
            <span className="text-foreground">1Man</span>
            <span className="text-brand-primary">.Biz</span>
          </Link>
        </div>

        {business && (
          <div className="mb-2 border-b border-border px-6 pb-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Business
            </p>
            <p className="mt-1 truncate text-[14px] font-semibold text-foreground">
              {business.name}
            </p>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-foreground"
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
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile topbar + drawer (single client component, flat sibling stacking) */}
      <MobileNav
        businessName={business?.name ?? null}
        userName={userName}
      />

      {/* Main content ? pt-* only, no py-* shorthand */}
      <main className="min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-6 sm:pt-24 lg:px-10 lg:pb-12 lg:pt-12">
        {children}
      </main>
    </div>
  );
}
