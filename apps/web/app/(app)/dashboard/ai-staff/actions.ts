"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type KnowledgeActionResult = { ok: true } | { ok: false; error: string };

const TITLE_MAX = 80;
const CONTENT_MAX = 1500;

function validate(title: string, content: string): string | null {
  if (!title) return "Add a title.";
  if (title.length > TITLE_MAX) return "Title is too long (max 80 characters).";
  if (!content) return "Add the answer your AI should give.";
  if (content.length > CONTENT_MAX) return "Answer is too long (max 1500 characters).";
  return null;
}

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
    console.error("[ai-staff] create failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/ai-staff");
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
    console.error("[ai-staff] update failed", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/dashboard/ai-staff");
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
    console.error("[ai-staff] archive failed", error);
    return { ok: false, error: "Could not remove. Please try again." };
  }

  revalidatePath("/dashboard/ai-staff");
  return { ok: true };
}
