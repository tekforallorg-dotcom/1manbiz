import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";
import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchOrders, type OrderFilter } from "../../../lib/orders";
import type { RecentOrder } from "../../../lib/dashboard";
import { OrderRow } from "../../../components/order-row";
import { StatusFilter } from "../../../components/status-filter";

const FILTER_OPTIONS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OrdersScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const router = useRouter();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) {
      setOrders([]);
      return;
    }
    const data = await fetchOrders(businessId, filter);
    setOrders(data);
  }, [userId, filter]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[orders] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[orders] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-text text-3xl font-bold">Orders</Text>
          <Text className="text-textMuted text-base mt-1">Capture and track sales</Text>
        </View>
        <Pressable
          onPress={() => router.push("/orders/new")}
          style={{ backgroundColor: "#00D26A" }}
          className="w-11 h-11 rounded-full items-center justify-center active:opacity-80"
          hitSlop={8}
        >
          <Plus size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="pb-3">
        <StatusFilter options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {loading && !orders ? (
          <Text className="text-textMuted text-sm">Loading orders…</Text>
        ) : orders && orders.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No orders</Text>
            <Text className="text-textMuted text-sm mt-1">
              {filter === "all"
                ? "Orders will appear here when customers buy from you."
                : `No orders with status “${filter}”.`}
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {orders?.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onPress={() => router.push(`/orders/${order.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
