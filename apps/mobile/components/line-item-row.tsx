import { View, Text } from "react-native";
import type { OrderLineItem } from "../lib/order-detail";
import { formatNaira } from "../lib/format";

export function LineItemRow({ item }: { item: OrderLineItem }) {
  return (
    <View className="flex-row items-start py-3">
      <View className="flex-1 mr-3">
        <Text className="text-text text-base font-medium" numberOfLines={2}>
          {item.name_snapshot}
        </Text>
        <Text className="text-textMuted text-xs mt-0.5">
          {item.quantity} {"×"} {formatNaira(item.price_kobo_snapshot)}
        </Text>
      </View>
      <Text className="text-text text-base font-semibold">
        {formatNaira(item.line_total_kobo)}
      </Text>
    </View>
  );
}
