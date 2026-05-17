import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  Home,
  ShoppingBag,
  Users,
  Receipt,
  LineChart,
  Settings,
  Package,
  MessageSquare,
} from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";

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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-surface border-r border-border sticky top-0 h-screen">
        <div className="px-6 py-5">
          <Link
            href="/dashboard"
            className="inline-flex items-baseline font-bold tracking-[-0.02em] text-[20px]"
          >
            <span className="text-foreground">1Man</span>
            <span className="text-brand-primary">.Biz</span>
          </Link>
        </div>

        {business && (
          <div className="px-6 pb-4 mb-2 border-b border-border">
            <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
              Business
            </p>
            <p className="mt-1 text-[14px] font-semibold text-foreground truncate">
              {business.name}
            </p>
          </div>
        )}

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-text-secondary hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="px-3 pb-3">
            <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
              Signed in as
            </p>
            <p className="mt-1 text-[12.5px] font-medium text-foreground truncate">
              {profile.full_name ?? user.email}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-text-secondary hover:bg-surface-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border flex items-center justify-between px-4 z-50">
        <Link
          href="/dashboard"
          className="inline-flex items-baseline font-bold tracking-[-0.02em] text-[18px]"
        >
          <span className="text-foreground">1Man</span>
          <span className="text-brand-primary">.Biz</span>
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="p-1.5" aria-label="Sign out">
            <LogOut
              className="h-5 w-5 text-text-secondary"
              strokeWidth={1.75}
            />
          </button>
        </form>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-14 lg:pt-0 min-w-0">{children}</main>
    </div>
  );
}
