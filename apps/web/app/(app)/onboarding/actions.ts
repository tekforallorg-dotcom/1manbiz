"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export interface OnboardingInput {
  businessName: string;
  category: string;
  channels: string[];
  tone: string;
}

export interface OnboardingResult {
  error?: string;
}

export async function completeOnboardingAction(
  input: OnboardingInput,
): Promise<OnboardingResult | void> {
  // Validation
  if (!input.businessName.trim()) {
    return { error: "Business name is required." };
  }
  if (!input.category) {
    return { error: "Please pick a category." };
  }
  if (!input.channels.length) {
    return { error: "Pick at least one channel." };
  }
  if (!["friendly", "formal", "playful"].includes(input.tone)) {
    return { error: "Invalid AI tone." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in." };
  }

  // 1. Create business
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      name: input.businessName.trim(),
      category: input.category,
      channels: input.channels,
      ai_tone: input.tone,
      owner_id: user.id,
    })
    .select()
    .single();

  if (businessError || !business) {
    return {
      error: `Failed to create business: ${businessError?.message ?? "unknown error"}`,
    };
  }

  // 2. Create owner membership
  const { error: memberError } = await supabase
    .from("business_members")
    .insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    return {
      error: `Failed to create membership: ${memberError.message}`,
    };
  }

  // 3. Flip onboarded flag
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarded: true })
    .eq("id", user.id);

  if (profileError) {
    return {
      error: `Failed to update profile: ${profileError.message}`,
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
