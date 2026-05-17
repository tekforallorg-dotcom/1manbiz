import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();
  const { data: business } = await supabase
    .from("businesses")
    .select("name, channels, ai_tone")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-brand-primary">
          {business?.name ?? "Your business"}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-foreground leading-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome to 1Man.Biz"}
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Your business operating system is set up. We're building the rest.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Channels connected" value={String(business?.channels?.length ?? 0)} />
        <Card label="AI tone" value={(business?.ai_tone ?? "friendly").replace(/^./, (c) => c.toUpperCase())} />
        <Card label="Setup status" value="Complete" tone="brand" />
      </div>

      <div className="mt-10 rounded-card border border-border bg-surface p-7 max-w-2xl">
        <h2 className="text-lg font-semibold text-foreground">What's next</h2>
        <p className="mt-2 text-[14px] text-text-secondary leading-relaxed">
          Your dashboard is ready but mostly empty. The next slices will add real
          features: inventory, orders, customers, receipts, and the AI Conversation
          Engine. We'll wire one feature at a time.
        </p>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
        {label}
      </p>
      <p
        className={
          tone === "brand"
            ? "mt-2 text-2xl font-bold tracking-tight text-brand-primary"
            : "mt-2 text-2xl font-bold tracking-tight text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
