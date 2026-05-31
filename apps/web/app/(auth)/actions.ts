"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface ActionResult {
  error?: string;
  success?: string;
}

/* ──────────────── Sign Up ──────────────── */
export async function signUpAction(
  formData: FormData,
): Promise<ActionResult | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!full_name) {
    return { error: "Please enter your name." };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Email confirmation enabled in Supabase → user must verify before signing in
  if (data.user && !data.session) {
    return {
      success: `Check your inbox. We sent a confirmation link to ${email}.`,
    };
  }

  // Email confirmation disabled → auto-signed in
  if (data.session) {
    redirect("/onboarding");
  }

  return { error: "Unexpected sign-up state." };
}

/* ──────────────── Sign In ──────────────── */
export async function signInAction(
  formData: FormData,
): Promise<ActionResult | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Sign in failed. Please try again." };
  }

  // Route based on onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", data.user.id)
    .maybeSingle();

  redirect(profile?.onboarded ? "/dashboard" : "/onboarding");
}

/* ──────────────── Sign Out ──────────────── */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
