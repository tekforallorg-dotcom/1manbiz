import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, Pressable, Alert, Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ExternalLink, Share2 } from "lucide-react-native";
import {
  fetchOrderDetail,
  markOrderPaid,
  cancelOrder,
  type OrderDetail,
} from "../../../lib/order-detail";
import { formatNaira, nairaParts, formatDateTime } from "../../../lib/format";
import { API_BASE_URL } from "../../../lib/config";
import { ScreenHeader } from "../../../components/screen-header";
import { ConfirmSheet } from "../../../components/confirm-sheet";
import { LineItemRow } from "../../../components/line-item-row";
import { colors as designColors } from "@1manbiz/design";
import { ORDER_SOURCE_LABEL } from "@1manbiz/shared";
import { PaymentLinkButton } from "../../../components/payment-link-button";

const STATUS_STYLES = {
  paid:      { bg: "bg-green-50",  text: "text-green-700", label: "Paid" },
  pending:   { bg: "bg-amber-50",  text: "text-amber-700", label: "Pending" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-600",  label: "Cancelled" },
} as const;

const WEB_BASE = API_BASE_URL;

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [marking, setMarking] = useState(false);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

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

  const doMarkPaid = async () => {
    if (!order) return;
    setMarking(true);
    const original = order;
    setOrder({ ...order, status: "paid", paid_at: new Date().toISOString() });

    const result = await markOrderPaid(order.id);
    if (!result.ok) {
      setOrder(original);
      setMarking(false);
      setConfirmingPaid(false);
      Alert.alert("Could not mark as paid", result.error ?? "Please try again.");
      return;
    }
    const refreshed = await fetchOrderDetail(order.id);
    if (refreshed) setOrder(refreshed);
    setMarking(false);
    setConfirmingPaid(false);
  };

  const doCancel = async () => {
    if (!order) return;
    setCancelling(true);
    const result = await cancelOrder(order.id);
    if (!result.ok) {
      setCancelling(false);
      setConfirmingCancel(false);
      Alert.alert("Could not cancel order", result.error ?? "Please try again.");
      return;
    }
    const refreshed = await fetchOrderDetail(order.id);
    if (refreshed) setOrder(refreshed);
    setCancelling(false);
    setConfirmingCancel(false);
  };

  const handleViewReceipt = () => {
    if (!order?.receipt_code) return;
    Linking.openURL(`${WEB_BASE}/r/${order.receipt_code}`).catch((err) =>
      console.error("[order-detail] open receipt error:", err),
    );
  };

  const handleSendReceipt = async () => {
    if (!order?.receipt_code) return;
    const link = `${WEB_BASE}/r/${order.receipt_code}`;
    const who = order.customer_name ? "Hi " + order.customer_name + ", " : "";
    const amount = "NGN " + Math.round((order.subtotal_kobo + (order.delivery_fee_kobo ?? 0)) / 100).toLocaleString("en-NG");
    try {
      await Share.share({ message: who + "here is your receipt for " + amount + ": " + link });
    } catch {
      // Share sheet dismissed; nothing to do.
    }
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
  const deliveryFeeKobo = order.delivery_fee_kobo ?? 0;
  const totalKobo = order.subtotal_kobo + deliveryFeeKobo;
  const fulfillmentLabel =
    order.fulfillment_type === "delivery"
      ? "Delivery"
      : order.fulfillment_type === "pickup"
        ? "Pickup"
        : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Order" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        <View className="pt-2">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Total</Text>
          <View className="flex-row items-center mt-1">
            <View className="flex-row items-baseline">
              <Text className="text-textMuted text-xl font-normal mr-1">{nairaParts(totalKobo).symbol}</Text>
              <Text className="text-text text-4xl font-bold">{nairaParts(totalKobo).amount}</Text>
            </View>
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
            <Text className="text-textMuted text-sm mt-0.5">{order.customer_phone}</Text>
          ) : null}
        </View>

        {fulfillmentLabel ? (
          <View className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Fulfillment</Text>
            <Text className="text-text text-lg font-semibold mt-1">{fulfillmentLabel}</Text>
            {order.fulfillment_type === "delivery" && order.delivery_address ? (
              <Text className="text-textMuted text-sm mt-1">{order.delivery_address}</Text>
            ) : null}
            {order.fulfillment_type === "pickup" && order.pickup_at ? (
              <Text className="text-textMuted text-sm mt-1">Pickup time: {formatDateTime(order.pickup_at)}</Text>
            ) : null}
          </View>
        ) : null}

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
            {deliveryFeeKobo > 0 ? (
              <>
                <View className="border-t border-gray-100 flex-row items-center justify-between py-3">
                  <Text className="text-textMuted text-base">Delivery</Text>
                  <Text className="text-text text-base font-medium">{formatNaira(deliveryFeeKobo)}</Text>
                </View>
                <View className="border-t border-gray-200 flex-row items-center justify-between py-3">
                  <Text className="text-text text-base font-semibold">Total</Text>
                  <Text className="text-text text-base font-bold">{formatNaira(totalKobo)}</Text>
                </View>
              </>
            ) : null}
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
              <Text className="text-text text-sm font-medium">{ORDER_SOURCE_LABEL[order.source]}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        {order.status === "pending" ? (
          <View style={{ gap: 10 }}>
            <PaymentLinkButton
              orderId={order.id}
              customerName={order.customer_name}
              customerPhone={order.customer_phone}
              amountKobo={totalKobo}
            />
          <Pressable
            onPress={() => setConfirmingPaid(true)}
            disabled={marking}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          >
            {marking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-semibold">
                Mark as paid
              </Text>
            )}
          </Pressable>
          </View>
        ) : order.status === "paid" && order.receipt_code ? (
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
              <Text className="text-text text-base font-semibold mr-2">View receipt</Text>
              <ExternalLink size={18} color={designColors.text} />
            </Pressable>
            <Pressable
              onPress={() => setConfirmingCancel(true)}
              disabled={cancelling}
              className="bg-white border border-red-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
            >
              {cancelling ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <Text className="text-red-600 text-base font-semibold">Cancel order</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      <ConfirmSheet
        visible={confirmingPaid}
        title="Mark as paid?"
        body={
          order
            ? "Confirm that " + (order.customer_name ?? "the customer") + " has paid " + formatNaira(totalKobo) + "."
            : undefined
        }
        confirmLabel="Mark as paid"
        pending={marking}
        onConfirm={doMarkPaid}
        onCancel={() => setConfirmingPaid(false)}
      />

      <ConfirmSheet
        visible={confirmingCancel}
        title="Cancel this paid order?"
        body="This returns the items to stock and reverses the sale. It does not refund the customer; send any refund separately."
        confirmLabel="Cancel order"
        destructive
        pending={cancelling}
        onConfirm={doCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </SafeAreaView>
  );
}
