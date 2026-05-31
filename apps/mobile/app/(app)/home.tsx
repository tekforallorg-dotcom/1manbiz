import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@1manbiz/design";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { firstNameFrom } from "../../lib/profile";

type Profile = { full_name: string | null; email: string };

export default function Home() {
  const { session, signOut } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data as Profile | null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        {loading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : (
          <>
            <Text className="text-foreground text-2xl font-semibold">
              Hey {profile ? firstNameFrom(profile) : "there"}
            </Text>
            <Text className="text-text-muted text-base mt-2">Welcome to 1Man.Biz</Text>
          </>
        )}
      </View>
      <View className="px-6 pb-8">
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          className="bg-surface-muted rounded-lg py-3 items-center"
        >
          <Text className="text-foreground text-base font-semibold">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
