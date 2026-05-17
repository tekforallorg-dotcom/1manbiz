import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingWizard from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded) {
    redirect("/dashboard");
  }

  return <OnboardingWizard userName={profile?.full_name ?? ""} />;
}
