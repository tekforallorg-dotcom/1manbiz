import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../../lib/session";
import { supabase } from "../../../lib/supabase";
import { firstNameFrom } from "../../../lib/profile";
import { Wordmark } from "../../../components/wordmark";

export default function HomeScreen() {
  const { session } = useSession();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setFirstName(firstNameFrom({ full_name: data?.full_name, email: session?.user?.email }));
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-4">
        <Wordmark />
      </View>

      <View className="flex-1 px-6 pt-12">
        <Text className="text-text text-3xl font-bold">
          Hey {firstName ?? "there"}
        </Text>
        <Text className="text-textMuted text-base mt-1">
          Welcome back
        </Text>

        <View className="mt-16">
          <Text className="text-textMuted text-sm">
            Dashboard tiles arrive in MOB-2.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
