import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ConversationsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8">
        <Text className="text-text text-3xl font-bold">Conversations</Text>
        <Text className="text-textMuted text-base mt-1">Inbound chats across channels</Text>
      </View>

      <View className="flex-1 px-6 pt-16">
        <Text className="text-textMuted text-sm">Threads will appear here once slice 3G.B lands the conversations and messages tables.</Text>
      </View>
    </SafeAreaView>
  );
}
