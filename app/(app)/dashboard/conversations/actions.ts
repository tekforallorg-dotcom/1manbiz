"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { verifyWhatsAppPhoneNumber } from "@/lib/whatsapp/meta-client";

export type ConnectState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function connectWhatsAppAction(
  _prev: ConnectState,
  formData: FormData
): Promise<ConnectState> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
    return { status: "error", error: "No business found for this account." };
  }

  const phoneNumberId = String(formData.get("phone_number_id") ?? "").trim();
  const accessToken = String(formData.get("access_token") ?? "").trim();
  const tokenTypeRaw = String(formData.get("token_type") ?? "temporary").trim();
  const tokenType = tokenTypeRaw === "permanent" ? "permanent" : "temporary";

  const fieldErrors: Record<string, string> = {};
  if (!phoneNumberId) fieldErrors.phone_number_id = "Phone number ID is required";
  if (!accessToken) fieldErrors.access_token = "Access token is required";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Verify with Meta before saving
  const verify = await verifyWhatsAppPhoneNumber({ phoneNumberId, accessToken });

  if (!verify.ok) {
    // Mark any existing record as failed so the UI can show the error
    await supabase
      .from("channel_accounts")
      .update({
        status: "failed",
        last_error: verify.error,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id)
      .eq("channel", "whatsapp")
      .neq("status", "disconnected");

    return { status: "error", error: verify.error };
  }

  const tokenExpiresAt = tokenType === "temporary"
    ? new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
    : null;

  // Mark any existing whatsapp row disconnected first (preserves history)
  await supabase
    .from("channel_accounts")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("channel", "whatsapp")
    .neq("status", "disconnected");

  const { error: insertError } = await supabase.from("channel_accounts").insert({
    business_id: business.id,
    channel: "whatsapp",
    meta_phone_number_id: phoneNumberId,
    meta_business_account_id: verify.data.whatsapp_business_account_id,
    meta_display_phone_number: verify.data.display_phone_number,
    access_token: accessToken,
    token_type: tokenType,
    token_expires_at: tokenExpiresAt,
    status: "connected",
    last_verified_at: new Date().toISOString(),
    last_error: null,
  });

  if (insertError) {
    console.error("[conversations] insert channel_account failed", insertError);
    return { status: "error", error: "Could not save the connection: " + insertError.message };
  }

  revalidatePath("/dashboard/conversations");
  return { status: "success", error: null };
}
