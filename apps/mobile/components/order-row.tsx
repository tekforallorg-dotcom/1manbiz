import { View, Text, Pressable } from "react-native";
import type { RecentOrder } from "../lib/dashboard";
import { formatNaira, relativeTime } from "../lib/format";

interface Props {
  order: RecentOrder;
  onPress?: () => void;
}

const STATUS_STYLES: Record<RecentOrder["status"], { bg: string; text: string; label: string }> = {
  paid:      { bg: "bg-green-50",  text: "text-green-700", label: "Paid" },
  pending:   { bg: "bg-amber-50",  text: "text-amber-700", label: "Pending" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-600",  label: "Cancelled" },
};

export function OrderRow({ order, onPress }: Props) {
  const s = STATUS_STYLES[order.status];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white border border-gray-200 rounded-2xl px-4 py-3 active:opacity-60"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-text text-base font-medium flex-1 mr-2" numberOfLines={1}>
          {order.customer_name ?? "Walk-in customer"}
        </Text>
        <Text className="text-text text-base font-semibold">
          {formatNaira(order.subtotal_kobo)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-1.5">
        <View className={`${s.bg} px-2 py-0.5 rounded-full`}>
          <Text className={`${s.text} text-xs font-medium`}>{s.label}</Text>
        </View>
        <Text className="text-textMuted text-xs">{relativeTime(order.created_at)}</Text>
      </View>
    </Pressable>
  );
}
