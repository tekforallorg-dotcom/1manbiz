import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, Pressable, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import {
  fetchOrderDetail,
  markOrderPaid,
  type OrderDetail,
  type OrderSource,
} from "../../../lib/order-detail";
import { formatNaira, formatDateTime } from "../../../lib/format";
import { ScreenHeader } from "../../../components/screen-header";
import { LineItemRow } from "../../../components/line-item-row";

const SOURCE_LABEL: Record<OrderSource, string> = {
  manual: "Captured manually",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  catalogue: "Online catalogue",
};

const STATUS_STYLES = {
  paid:      { bg: "bg-green-50",  text: "text-green-700", label: "Paid" },
  pending:   { bg: "bg-amber-50",  text: "text-amber-700", label: "Pending" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-600",  label: "Cancelled" },
} as const;

const WEB_BASE = "https://1manbiz.vercel.app";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchOrderDetail(id);
    if (!data) {
      setNotFound(true);
      return;
    }
    setOrder(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[order-detail] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const handleMarkPaid = () => {
    if (!order) return;
    Alert.alert(
      "Mark as paid?",
      `Confirm that ${order.customer_name ?? "the customer"} has paid ${formatNaira(order.subtotal_kobo)}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as paid",
          style: "default",
          onPress: async () => {
            setMarking(true);
            const original = order;
            setOrder({ ...order, status: "paid", paid_at: new Date().toISOString() });

            const result = await markOrderPaid(order.id);
            if (!result.ok) {
              setOrder(original);
              setMarking(false);
              Alert.alert("Could not mark as paid", result.error ?? "Please try again.");
              return;
            }
            const refreshed = await fetchOrderDetail(order.id);
            if (refreshed) setOrder(refreshed);
            setMarking(false);
          },
        },
      ],
    );
  };

  const handleViewReceipt = () => {
    if (!order?.receipt_code) return;
    Linking.openURL(`${WEB_BASE}/r/${order.receipt_code}`).catch((err) =>
      console.error("[order-detail] open receipt error:", err),
    );
  };

  if (loading && !order) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Order" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !order) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Order" />
        <View className="flex-1 px-6 pt-8">
          <Text className="text-text text-lg font-semibold">Order not found</Text>
          <Text className="text-textMuted text-sm mt-1">
            It may have been deleted or you do not have access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_STYLES[order.status];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Order" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        <View className="pt-2">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Total</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-text text-4xl font-bold">{formatNaira(order.subtotal_kobo)}</Text>
            <View className={`${status.bg} px-2.5 py-1 rounded-full ml-3`}>
              <Text className={`${status.text} text-xs font-medium`}>{status.label}</Text>
            </View>
          </View>
        </View>

        <View className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Customer</Text>
          <Text className="text-text text-lg font-semibold mt-1">
            {order.customer_name ?? "Walk-in customer"}
          </Text>
          {order.customer_phone ? (
            <Text className="text-textMuted text-sm mt-0.5">+{order.customer_phone}</Text>
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

        {order.notes ? (
          <View className="mt-6">
            <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Notes</Text>
            <View className="bg-white border border-gray-200 rounded-2xl p-4">
              <Text className="text-text text-sm">{order.notes}</Text>
            </View>
          </View>
        ) : null}

        <View className="mt-6">
          <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Timeline</Text>
          <View className="bg-white border border-gray-200 rounded-2xl p-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-textMuted text-sm">Created</Text>
              <Text className="text-text text-sm font-medium">{formatDateTime(order.created_at)}</Text>
            </View>
            {order.paid_at ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-textMuted text-sm">Paid</Text>
                <Text className="text-text text-sm font-medium">{formatDateTime(order.paid_at)}</Text>
              </View>
            ) : null}
            {order.cancelled_at ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-textMuted text-sm">Cancelled</Text>
                <Text className="text-text text-sm font-medium">{formatDateTime(order.cancelled_at)}</Text>
              </View>
            ) : null}
            <View className="flex-row justify-between py-1">
              <Text className="text-textMuted text-sm">Source</Text>
              <Text className="text-text text-sm font-medium">{SOURCE_LABEL[order.source]}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        {order.status === "pending" ? (
          <Pressable
            onPress={handleMarkPaid}
            disabled={marking}
            style={{ backgroundColor: "#00D26A" }}
            className="rounded-2xl py-4 items-center active:opacity-80"
          >
            {marking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF" }} className="text-base font-semibold">
                Mark as paid
              </Text>
            )}
          </Pressable>
        ) : order.status === "paid" && order.receipt_code ? (
          <Pressable
            onPress={handleViewReceipt}
            className="bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
          >
            <Text className="text-text text-base font-semibold mr-2">View receipt</Text>
            <ExternalLink size={18} color="#0F172A" />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
