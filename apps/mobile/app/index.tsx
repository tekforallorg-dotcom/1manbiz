import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@1manbiz/design";
import { useSession } from "../lib/session";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href="/home" />;
}
