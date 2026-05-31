import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrdersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8">
        <Text className="text-text text-3xl font-bold">Orders</Text>
        <Text className="text-textMuted text-base mt-1">Capture and track sales</Text>
      </View>

      <View className="flex-1 px-6 pt-16">
        <Text className="text-textMuted text-sm">Recent orders, mark-paid actions, and order detail arrive in MOB-4.</Text>
      </View>
    </SafeAreaView>
  );
}
