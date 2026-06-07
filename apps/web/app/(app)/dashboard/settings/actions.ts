"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/slug";
import { normalizePhone } from "@/lib/whatsapp";

export type UpdateBusinessSettingsState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function updateBusinessSettingsAction(
  _prev: UpdateBusinessSettingsState,
  formData: FormData,
): Promise<UpdateBusinessSettingsState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[settings] resolve business failed", businessError);
    return {
      status: "error",
      error: "No business found for this account.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const slugRaw = String(formData.get("slug") ?? "")
    .toLowerCase()
    .trim();
  const whatsappRaw =
    String(formData.get("whatsapp_number") ?? "").trim() || null;
  const logoPathRaw = String(formData.get("logo_path") ?? "").trim();
  const logoPath = logoPathRaw.length > 0 ? logoPathRaw : null;
  const catalogueActive = formData.get("catalogue_active") === "on";

  const fulfillmentRaw = String(formData.get("fulfillment_mode") ?? "both");
  const fulfillmentMode = ["delivery", "pickup", "both"].includes(fulfillmentRaw)
    ? fulfillmentRaw
    : "both";
  const address = String(formData.get("address") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Business name is required";
  else if (name.length > 120) fieldErrors.name = "Too long (max 120)";

  const slugErr = validateSlug(slugRaw);
  if (slugErr) fieldErrors.slug = slugErr;

  let whatsappNormalized: string | null = null;
  if (whatsappRaw) {
    whatsappNormalized = normalizePhone(whatsappRaw);
    if (!whatsappNormalized || whatsappNormalized.length < 10) {
      fieldErrors.whatsapp_number = "Enter a valid phone number";
    }
  }

  if ((fulfillmentMode === "pickup" || fulfillmentMode === "both") && !address) {
    fieldErrors.address =
      "Add your store address so pickup customers know where to come.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      name,
      tagline,
      slug: slugRaw,
      whatsapp_number: whatsappNormalized,
      logo_path: logoPath,
      catalogue_active: catalogueActive,
      address,
      fulfillment_mode: fulfillmentMode,
    })
    .eq("id", business.id);

  if (updateError) {
    console.error("[settings] update failed", updateError);
    // Unique-violation on slug
    if (updateError.code === "23505") {
      return {
        status: "error",
        error: "That URL handle is already taken. Try another.",
        fieldErrors: { slug: "Already taken" },
      };
    }
    return {
      status: "error",
      error: `Could not save settings: ${updateError.message}`,
    };
  }

  // Revalidate both the settings page and the public catalogue
  revalidatePath("/dashboard/settings");
  revalidatePath(`/c/${slugRaw}`);
  if (slugRaw !== business.slug) {
    revalidatePath(`/c/${business.slug}`);
  }

  return { status: "success", error: null, fieldErrors: {} };
}
