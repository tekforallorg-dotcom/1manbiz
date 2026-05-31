import { supabase } from "./supabase";

export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  last_purchase_at: string | null;
}

// Lists up to 100 customers for a business, sorted by recent purchase first.
// Caller filters client-side on the search query. Server-side ilike search
// is a future polish slice when data volume justifies it.
export async function listCustomers(businessId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164, email, last_purchase_at")
    .eq("business_id", businessId)
    .order("last_purchase_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error("[customers] list error:", error);
    return [];
  }
  return data as Customer[];
}

// MVP normalisation: strip everything that is not a digit. Future polish:
// proper E.164 with country-code prompting (Nigerian default 234).
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export async function createCustomer(
  businessId: string,
  name: string,
  phoneRaw: string,
): Promise<{ customer?: Customer; error?: string }> {
  const trimmedName = name.trim();
  const phone = normalizePhone(phoneRaw);

  if (!trimmedName) return { error: "Please enter a name." };
  if (phone.length < 7) return { error: "Please enter a valid phone number." };

  const { data, error } = await supabase
    .from("customers")
    .insert({ business_id: businessId, name: trimmedName, phone_e164: phone })
    .select("id, name, phone_e164, email, last_purchase_at")
    .single();

  if (error) {
    console.error("[customers] create error:", error);
    return { error: error.message };
  }
  return { customer: data as Customer };
}
