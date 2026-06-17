import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { listExpenses, EXPENSE_CATEGORIES } from "@/lib/expenses/core";

import { MoneyTabs } from "../money-tabs";
import { ExpensesClient } from "../expenses-client";

export const dynamic = "force-dynamic";

/**
 * Money > Expenses (M3b). Lists the business's recent expenses (newest first)
 * and hosts the add/edit/delete surface. Reads through the shared core so the
 * business scoping and column shape match the API exactly. Category slugs come
 * from the core (single source of truth); the vendor-natural labels are
 * presentation only and live here, mapped onto the slugs before they go down to
 * the client. The Overview is where the 7/30/90 period filter lives; this list
 * shows recent entries so the vendor can manage every row.
 */

const CATEGORY_LABELS: Record<string, string> = {
  stock: "Stock",
  delivery: "Delivery",
  transport: "Transport",
  rent: "Rent",
  utilities: "Utilities",
  airtime_data: "Airtime & Data",
  salaries: "Salaries",
  packaging: "Packaging",
  marketing: "Marketing",
  fees: "Fees",
  other: "Other",
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const result = await listExpenses(user.id, {});
  if (!result.ok && result.status === 403) redirect("/onboarding");
  const expenses = result.ok ? result.expenses : [];

  const categoryOptions = EXPENSE_CATEGORIES.map((slug) => ({
    value: slug,
    label: CATEGORY_LABELS[slug] ?? slug,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[1.9rem] font-semibold leading-none tracking-tight text-foreground">
          Money
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Record what you spend to see your real profit.
        </p>
      </div>

      <MoneyTabs active="expenses" />

      <ExpensesClient initial={expenses} categoryOptions={categoryOptions} />
    </div>
  );
}
