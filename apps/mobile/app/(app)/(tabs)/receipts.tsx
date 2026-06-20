import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, Share } from "react-native";
import { useNotifier } from "../../../components/notifier";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { supabase } from "../../../lib/supabase";
import { resendReceipt } from "../../../lib/order-detail";
import { formatNaira, formatDateTime } from "../../../lib/format";
import { API_BASE_URL } from "../../../lib/config";
import { ReceiptActionsSheet } from "../../../components/receipt-actions-sheet";
import { SummaryStrip } from "../../../components/summary-strip";

const WEB_BASE = API_BASE_URL;

type ReceiptItem = { name_snapshot: string | null; quantity: number | null };

type ReceiptRow = {
  id: string;
  subtotal_kobo: number;
  paid_at: string | null;
  receipt_code: string;
  customers: { name: string } | { name: string }[] | null;
  order_items: ReceiptItem[] | null;
};

function customerName(c: ReceiptRow["customers"]): string {
  if (!c) return "Customer";
  if (Array.isArray(c)) return c[0]?.name ?? "Customer";
  return c.name ?? "Customer";
}

function itemsPreview(items: ReceiptItem[] | null): string {
  if (!items || items.length === 0) return "Receipt";
  return items.map((i) => (i.quantity ?? 1) + "x " + (i.name_snapshot ?? "item")).join(", ");
}

export default function ReceiptsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const { notify } = useNotifier();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReceiptRow | null>(null);
  const [resending, setResending] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) { setRows([]); return; }
    const { data } = await supabase
      .from("orders")
      .select("id, subtotal_kobo, paid_at, receipt_code, customers(name), order_items(name_snapshot, quantity)")
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

  const totalKobo = useMemo(
    () => (rows ?? []).reduce((sum, r) => sum + (r.subtotal_kobo ?? 0), 0),
    [rows],
  );

  const doShare = useCallback(async (r: ReceiptRow) => {
    const link = `${WEB_BASE}/r/${r.receipt_code}`;
    const who = "Hi " + customerName(r.customers) + ", ";
    try {
      await Share.share({ message: who + "here is your receipt for " + formatNaira(r.subtotal_kobo) + ": " + link });
    } catch {
      // Share sheet dismissed.
    }
  }, []);

  const doView = useCallback((r: ReceiptRow) => {
    Linking.openURL(`${WEB_BASE}/r/${r.receipt_code}`).catch((err) =>
      console.error("[receipts] open error:", err),
    );
  }, []);

  const doResend = useCallback(async (r: ReceiptRow) => {
    setResending(true);
    const result = await resendReceipt(r.id);
    setResending(false);
    setSelected(null);
    if (!result.ok) {
      notify({ type: "error", title: "Could not resend", message: result.error ?? "Please try again." });
      return;
    }
    if (result.sent) {
      notify({ type: "success", title: "Receipt sent", message: "The receipt was sent to " + customerName(r.customers) + " on WhatsApp." });
    } else {
      notify({ type: "info", title: "Not sent on WhatsApp", message: "We could not message the customer right now (their chat window may be closed). Use Share link to send it another way." });
    }
  }, []);

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
        {rows && rows.length > 0 ? (
          <SummaryStrip
            items={[
              { label: "Collected", value: formatNaira(rows.reduce((sum, r) => sum + (r.subtotal_kobo || 0), 0)), tone: "lead" },
              { label: "Receipts", value: String(rows.length) },
              { label: "Average", value: formatNaira(rows.length ? Math.round(rows.reduce((sum, r) => sum + (r.subtotal_kobo || 0), 0) / rows.length) : 0) },
            ]}
          />
        ) : null}
        {loading && !rows ? (
          <Text className="text-textMuted text-sm">Loading receipts…</Text>
        ) : rows && rows.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No receipts yet</Text>
            <Text className="text-textMuted text-sm mt-1">A receipt is created when an order is marked paid.</Text>
          </View>
        ) : (
          <>
            <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-textMuted text-xs uppercase tracking-wider">Total collected</Text>
                <Text className="text-text text-2xl font-bold mt-1">{formatNaira(totalKobo)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-textMuted text-xs uppercase tracking-wider">Receipts</Text>
                <Text className="text-text text-2xl font-bold mt-1">{rows?.length ?? 0}</Text>
              </View>
            </View>

            <View className="gap-2">
              {rows?.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/receipts/${r.id}`)}
                  onLongPress={() => setSelected(r)}
                  delayLongPress={400}
                  className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-text text-base font-semibold" numberOfLines={1}>{customerName(r.customers)}</Text>
                    <Text className="text-textMuted text-xs mt-0.5" numberOfLines={1}>{itemsPreview(r.order_items)}</Text>
                    <Text className="text-textMuted text-xs mt-0.5">{r.paid_at ? formatDateTime(r.paid_at) : "Paid"}</Text>
                  </View>
                  <View className="items-end mr-2">
                    <Text className="text-text text-base font-bold">{formatNaira(r.subtotal_kobo)}</Text>
                    <Text className="text-textMuted text-xs mt-0.5">#{r.receipt_code}</Text>
                  </View>
                  <ChevronRight size={18} color={designColors.text} />
                </Pressable>
              ))}
            </View>

            <Text className="text-textMuted text-xs text-center mt-4">Press and hold a receipt for quick actions</Text>
          </>
        )}
      </ScrollView>

      <ReceiptActionsSheet
        visible={selected !== null}
        title={selected ? "#" + selected.receipt_code : "Receipt"}
        resending={resending}
        onResend={() => { if (selected) void doResend(selected); }}
        onShare={() => { const r = selected; setSelected(null); if (r) void doShare(r); }}
        onView={() => { const r = selected; setSelected(null); if (r) doView(r); }}
        onClose={() => { if (!resending) setSelected(null); }}
      />
    </SafeAreaView>
  );
}
