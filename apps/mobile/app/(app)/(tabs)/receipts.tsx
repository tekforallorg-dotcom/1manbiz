import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { supabase } from "../../../lib/supabase";
import { formatNaira, formatDateTime } from "../../../lib/format";
import { API_BASE_URL } from "../../../lib/config";

type ReceiptRow = {
  id: string;
  subtotal_kobo: number;
  paid_at: string | null;
  receipt_code: string;
  customers: { name: string } | { name: string }[] | null;
};

function customerName(c: ReceiptRow["customers"]): string {
  if (!c) return "Customer";
  if (Array.isArray(c)) return c[0]?.name ?? "Customer";
  return c.name ?? "Customer";
}

export default function ReceiptsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) { setRows([]); return; }
    const { data } = await supabase
      .from("orders")
      .select("id, subtotal_kobo, paid_at, receipt_code, customers(name)")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .not("receipt_code", "is", null)
      .order("paid_at", { ascending: false });
    setRows((data ?? []) as ReceiptRow[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[receipts] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[receipts] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  const openReceipt = (code: string) => {
    Linking.openURL(API_BASE_URL + "/r/" + code).catch((err) =>
      console.error("[receipts] open error:", err),
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Receipts</Text>
        <Text className="text-textMuted text-base mt-1">Paid orders with a shareable receipt</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {loading && !rows ? (
          <Text className="text-textMuted text-sm">Loading receipts…</Text>
        ) : rows && rows.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No receipts yet</Text>
            <Text className="text-textMuted text-sm mt-1">A receipt is created when an order is marked paid.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {rows?.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => openReceipt(r.receipt_code)}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
              >
                <View className="flex-1 mr-3">
                  <Text className="text-text text-base font-semibold" numberOfLines={1}>{customerName(r.customers)}</Text>
                  <Text className="text-textMuted text-xs mt-0.5">{r.paid_at ? formatDateTime(r.paid_at) : "Paid"}</Text>
                </View>
                <Text className="text-text text-base font-bold mr-2">{formatNaira(r.subtotal_kobo)}</Text>
                <ExternalLink size={18} color={designColors.text} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
