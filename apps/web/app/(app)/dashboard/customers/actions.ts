"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/whatsapp";

export type CreateCustomerState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function createCustomerAction(
  _prev: CreateCustomerState,
  formData: FormData
): Promise<CreateCustomerState> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[customers] resolve business failed", businessError);
    return { status: "error", error: "No business found for this account." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Name is required";
  else if (name.length > 120) fieldErrors.name = "Too long (max 120)";

  const phoneNormalized = normalizePhone(phoneRaw);
  if (!phoneRaw) {
    fieldErrors.phone = "Phone number is required";
  } else if (!phoneNormalized || phoneNormalized.length < 10) {
    fieldErrors.phone = "Enter a valid phone number";
  }

  let email: string | null = null;
  if (emailRaw) {
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    if (!looksLikeEmail) {
      fieldErrors.email = "Enter a valid email";
    } else {
      email = emailRaw.toLowerCase();
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { error: insertError } = await supabase.from("customers").insert({
    business_id: business.id,
    name,
    phone_e164: phoneNormalized!,
    email,
    notes,
  });

  if (insertError) {
    console.error("[customers] insert failed", insertError);
    if (insertError.code === "23505") {
      return {
        status: "error",
        error: "A customer with that phone number already exists.",
        fieldErrors: { phone: "Already on file" },
      };
    }
    return {
      status: "error",
      error: "Could not add customer: " + insertError.message,
    };
  }

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}

export type UpdateCustomerState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function updateCustomerAction(
  _prev: UpdateCustomerState,
  formData: FormData
): Promise<UpdateCustomerState> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[customers] resolve business failed", businessError);
    return { status: "error", error: "No business found for this account." };
  }

  const customerId = String(formData.get("customerId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!customerId) {
    return { status: "error", error: "Missing customer." };
  }

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required";
  else if (name.length > 120) fieldErrors.name = "Too long (max 120)";
  if (notes && notes.length > 1000) fieldErrors.notes = "Too long (max 1000)";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Ownership is enforced by scoping the update to this owner's business_id;
  // a customer that is not theirs matches no row and returns not found.
  const { data: updated, error: updateError } = await supabase
    .from("customers")
    .update({ name, notes })
    .eq("id", customerId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("[customers] update failed", updateError);
    return { status: "error", error: "Could not save: " + updateError.message };
  }
  if (!updated) {
    return { status: "error", error: "Customer not found." };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/customers/" + customerId);
  return { status: "success", error: null };
}
