import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ExternalLink, Share2 } from "lucide-react-native";
import { fetchOrderDetail, type OrderDetail } from "../../../lib/order-detail";
import { formatNaira, nairaParts, formatDateTime } from "../../../lib/format";
import { API_BASE_URL } from "../../../lib/config";
import { ScreenHeader } from "../../../components/screen-header";
import { LineItemRow } from "../../../components/line-item-row";
import { colors as designColors } from "@1manbiz/design";

const WEB_BASE = API_BASE_URL;

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchOrderDetail(id);
    if (!data) { setNotFound(true); return; }
    setOrder(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[receipt-detail] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const handleViewReceipt = () => {
    if (!order?.receipt_code) return;
    Linking.openURL(`${WEB_BASE}/r/${order.receipt_code}`).catch((err) =>
      console.error("[receipt-detail] open error:", err),
    );
  };

  const handleSendReceipt = async () => {
    if (!order?.receipt_code) return;
    const link = `${WEB_BASE}/r/${order.receipt_code}`;
    const who = order.customer_name ? "Hi " + order.customer_name + ", " : "";
    const amount = "NGN " + Math.round(order.subtotal_kobo / 100).toLocaleString("en-NG");
    try {
      await Share.share({ message: who + "here is your receipt for " + amount + ": " + link });
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  };

  if (loading && !order) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Receipt" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !order || !order.receipt_code) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Receipt" />
        <View className="flex-1 px-6 pt-8">
          <Text className="text-text text-lg font-semibold">Receipt not found</Text>
          <Text className="text-textMuted text-sm mt-1">
            It may have been deleted or you do not have access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Receipt" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        <View className="pt-2">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Total paid</Text>
          <View className="flex-row items-center mt-1">
            <View className="flex-row items-baseline">
              <Text className="text-textMuted text-xl font-normal mr-1">{nairaParts(order.subtotal_kobo).symbol}</Text>
              <Text className="text-text text-4xl font-bold">{nairaParts(order.subtotal_kobo).amount}</Text>
            </View>
            <View className="bg-green-50 px-2.5 py-1 rounded-full ml-3">
              <Text className="text-green-700 text-xs font-medium">Paid</Text>
            </View>
          </View>
        </View>

        <View className="mt-6 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center justify-between">
          <View>
            <Text className="text-textMuted text-xs uppercase tracking-wider">Receipt</Text>
            <Text className="text-text text-lg font-semibold mt-1">#{order.receipt_code}</Text>
          </View>
          {order.paid_at ? (
            <Text className="text-textMuted text-sm">{formatDateTime(order.paid_at)}</Text>
          ) : null}
        </View>

        <View className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Customer</Text>
          <Text className="text-text text-lg font-semibold mt-1">
            {order.customer_name ?? "Walk-in customer"}
          </Text>
          {order.customer_phone ? (
            <Text className="text-textMuted text-sm mt-0.5">{order.customer_phone}</Text>
          ) : null}
        </View>

        <View className="mt-6">
          <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Items</Text>
          <View className="bg-white border border-gray-200 rounded-2xl px-4">
            {order.items.map((item, idx) => (
              <View key={item.id} className={idx === 0 ? "" : "border-t border-gray-100"}>
                <LineItemRow item={item} />
              </View>
            ))}
            <View className="border-t border-gray-200 flex-row items-center justify-between py-3">
              <Text className="text-text text-base font-semibold">Subtotal</Text>
              <Text className="text-text text-base font-bold">{formatNaira(order.subtotal_kobo)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleSendReceipt}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          >
            <Share2 size={18} color="#FFFFFF" strokeWidth={2} />
            <Text className="text-white text-base font-semibold ml-2">Send receipt</Text>
          </Pressable>
          <Pressable
            onPress={handleViewReceipt}
            className="bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
          >
            <Text className="text-text text-base font-semibold mr-2">View web receipt</Text>
            <ExternalLink size={18} color={designColors.text} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
