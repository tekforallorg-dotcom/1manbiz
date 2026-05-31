import { View, Text, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../../lib/session";

export default function SettingsScreen() {
  const { signOut } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("[settings] sign out error:", err);
      Alert.alert("Sign out failed", "Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8">
        <Text className="text-text text-3xl font-bold">Settings</Text>
        <Text className="text-textMuted text-base mt-1">Account and preferences</Text>
      </View>

      <View className="flex-1 px-6 pt-12">
        <Pressable
          onPress={handleSignOut}
          className="bg-white border border-gray-200 rounded-2xl px-5 py-4 active:opacity-60"
        >
          <Text className="text-text text-base font-medium">Sign out</Text>
        </Pressable>

        <Text className="text-textMuted text-xs mt-3">
          Account settings, notifications, and billing arrive in later slices.
        </Text>
      </View>
    </SafeAreaView>
  );
}
