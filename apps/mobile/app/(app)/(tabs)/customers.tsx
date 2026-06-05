import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { supabase } from "../../../lib/supabase";
import { formatNaira, formatDateTime } from "../../../lib/format";

type CustomerRow = {
  id: string;
  name: string;
  phone_e164: string;
  total_orders: number;
  total_spent_kobo: number;
  last_purchase_at: string | null;
};

export default function CustomersScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) { setCustomers([]); return; }
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone_e164, total_orders, total_spent_kobo, last_purchase_at")
      .eq("business_id", businessId)
      .order("last_purchase_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setCustomers((data ?? []) as CustomerRow[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[customers] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[customers] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Customers</Text>
        <Text className="text-textMuted text-base mt-1">
          {customers && customers.length > 0 ? customers.length + " in your book" : "Your customer list"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {loading && !customers ? (
          <Text className="text-textMuted text-sm">Loading customers…</Text>
        ) : customers && customers.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No customers yet</Text>
            <Text className="text-textMuted text-sm mt-1">Customers are added automatically when they chat or order.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {customers?.map((c) => (
              <View key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <Text className="text-text text-base font-semibold" numberOfLines={1}>{c.name}</Text>
                <Text className="text-textMuted text-sm mt-0.5">{c.phone_e164}</Text>
                <View className="flex-row items-center mt-2">
                  <Text className="text-textMuted text-xs">{c.total_orders} order{c.total_orders === 1 ? "" : "s"}</Text>
                  <Text className="text-textMuted text-xs">{"  \u00B7  "}</Text>
                  <Text className="text-text text-xs font-medium">{formatNaira(c.total_spent_kobo)} spent</Text>
                </View>
                {c.last_purchase_at ? (
                  <Text className="text-textMuted text-xs mt-1">Last purchase {formatDateTime(c.last_purchase_at)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
