import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InventoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8">
        <Text className="text-text text-3xl font-bold">Inventory</Text>
        <Text className="text-textMuted text-base mt-1">Products, stock, and catalogue</Text>
      </View>

      <View className="flex-1 px-6 pt-16">
        <Text className="text-textMuted text-sm">Product list, image upload, and stock controls arrive in MOB-5.</Text>
      </View>
    </SafeAreaView>
  );
}
