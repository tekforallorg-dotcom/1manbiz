"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type KnowledgeActionResult = { ok: true } | { ok: false; error: string };
export type DeliveryActionResult = { ok: true } | { ok: false; error: string };

const TITLE_MAX = 80;
const CONTENT_MAX = 1500;
const LABEL_MAX = 60;
const NOTE_MAX = 200;

function validate(title: string, content: string): string | null {
  if (!title) return "Add a title.";
  if (title.length > TITLE_MAX) return "Title is too long (max 80 characters).";
  if (!content) return "Add the answer your AI should give.";
  if (content.length > CONTENT_MAX) return "Answer is too long (max 1500 characters).";
  return null;
}

// --- Knowledge base ---

export async function createKnowledgeItem(input: {
  title: string;
  content: string;
}): Promise<KnowledgeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const title = input.title.trim();
  const content = input.content.trim();
  const invalid = validate(title, content);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from("knowledge_items").insert({
    business_id: business.id,
    title,
    content,
    source_type: "manual",
    status: "active",
  });
  if (error) {
    console.error("[bizbot] knowledge create failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

export async function updateKnowledgeItem(
  id: string,
  input: { title: string; content: string },
): Promise<KnowledgeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const title = input.title.trim();
  const content = input.content.trim();
  const invalid = validate(title, content);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from("knowledge_items")
    .update({ title, content })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("[bizbot] knowledge update failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

export async function archiveKnowledgeItem(id: string): Promise<KnowledgeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const { error } = await supabase
    .from("knowledge_items")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("[bizbot] knowledge archive failed", error);
    return { ok: false, error: "Could not remove. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

// --- Delivery zones ---

// Parse a naira fee string into kobo. Returns null on invalid input so the
// caller can tell a genuine free zone (0) apart from a typo. We do NOT reuse
// parseNairaInputToKobo here because it returns 0 for both "0" and garbage,
// which would silently turn a typo into free delivery.
function parseFeeToKobo(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const naira = Number.parseFloat(cleaned);
  if (Number.isNaN(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}

function validateZone(label: string, note: string): string | null {
  if (!label) return "Add an area name.";
  if (label.length > LABEL_MAX) return "Area name is too long (max 60 characters).";
  if (note.length > NOTE_MAX) return "Note is too long (max 200 characters).";
  return null;
}

export async function createDeliveryZone(input: {
  label: string;
  fee: string;
  note: string;
}): Promise<DeliveryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const label = input.label.trim();
  const note = input.note.trim();
  const invalid = validateZone(label, note);
  if (invalid) return { ok: false, error: invalid };

  const feeKobo = parseFeeToKobo(input.fee);
  if (feeKobo === null) {
    return { ok: false, error: "Enter a delivery fee, e.g. 3000 (use 0 for free)." };
  }

  const { error } = await supabase.from("delivery_zones").insert({
    business_id: business.id,
    label,
    fee_kobo: feeKobo,
    note: note || null,
    active: true,
  });
  if (error) {
    console.error("[bizbot] zone create failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

export async function updateDeliveryZone(
  id: string,
  input: { label: string; fee: string; note: string },
): Promise<DeliveryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const label = input.label.trim();
  const note = input.note.trim();
  const invalid = validateZone(label, note);
  if (invalid) return { ok: false, error: invalid };

  const feeKobo = parseFeeToKobo(input.fee);
  if (feeKobo === null) {
    return { ok: false, error: "Enter a delivery fee, e.g. 3000 (use 0 for free)." };
  }

  const { error } = await supabase
    .from("delivery_zones")
    .update({ label, fee_kobo: feeKobo, note: note || null })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("[bizbot] zone update failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

export async function archiveDeliveryZone(id: string): Promise<DeliveryActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const { error } = await supabase
    .from("delivery_zones")
    .update({ active: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("[bizbot] zone archive failed", error);
    return { ok: false, error: "Could not remove. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}

// --- AI behaviour ---

export type AiBehaviorActionResult = { ok: true } | { ok: false; error: string };

const AI_MODES = ["off", "assisted", "semi", "autonomous"] as const;
const AI_TONES = ["friendly", "formal", "playful"] as const;
type AiModeValue = (typeof AI_MODES)[number];
type AiToneValue = (typeof AI_TONES)[number];
const LANGUAGE_MAX = 40;

// Persist how BizBot replies: mode (off, assisted, semi, autonomous), tone,
// language, and whether it sends payment links. The mode and tone are checked
// against the same allowed sets the database enforces, and payment links are
// only stored on when the mode is autonomous so the toggle and the engine agree.
// Owner-scoped; a client-supplied business is never trusted.
export async function updateAiBehaviorAction(input: {
  mode: string;
  tone: string;
  language: string;
  autopay: boolean;
}): Promise<AiBehaviorActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business found for this account." };

  const mode = input.mode as AiModeValue;
  if (!AI_MODES.includes(mode)) return { ok: false, error: "Pick a valid BizBot mode." };
  const tone = input.tone as AiToneValue;
  if (!AI_TONES.includes(tone)) return { ok: false, error: "Pick a valid tone." };

  let language = (input.language ?? "").trim();
  if (language.length > LANGUAGE_MAX) {
    return { ok: false, error: "Language is too long (max 40 characters)." };
  }
  if (!language) language = "English";

  const autopay = mode === "autonomous" ? !!input.autopay : false;

  const { error } = await supabase
    .from("businesses")
    .update({
      ai_mode: mode,
      ai_tone: tone,
      ai_language: language,
      ai_sends_payment_link: autopay,
    })
    .eq("id", business.id);
  if (error) {
    console.error("[bizbot] ai behavior update failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/bizbot");
  return { ok: true };
}
