import { Text, View } from "react-native";

export function Wordmark() {
  return (
    <View className="flex-row items-center">
      <Text className="text-foreground text-3xl font-bold">1Man</Text>
      <Text className="text-brand-primary text-3xl font-bold">.</Text>
      <Text className="text-foreground text-3xl font-bold">Biz</Text>
    </View>
  );
}
