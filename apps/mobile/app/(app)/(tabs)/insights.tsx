import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Bot } from "lucide-react-native";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchInsightsData, computeWindow, type InsightsData, type RangeKey, type WindowStats } from "../../../lib/insights";
import { formatNaira } from "../../../lib/format";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];
const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  all: "all time",
};

function buildSummary(w: WindowStats, label: string): string {
  if (w.paidCount === 0 && w.outstandingKobo === 0) {
    return "No sales yet in this period. Share your catalogue or follow up with customers to land the first order.";
  }
  const parts: string[] = [];
  if (w.paidCount > 0) {
    parts.push("You've collected " + formatNaira(w.paidRevenueKobo) + " across " + w.paidCount + " paid order" + (w.paidCount === 1 ? "" : "s") + " in the " + label + ".");
  }
  if (w.outstandingKobo > 0) {
    parts.push(formatNaira(w.outstandingKobo) + " is still outstanding across " + w.pendingCount + " order" + (w.pendingCount === 1 ? "" : "s") + " — your best next move is to follow them up.");
  } else if (w.paidCount > 0) {
    parts.push("Nothing outstanding right now — you're all caught up.");
  }
  return parts.join(" ");
}

function Sparkline({ series }: { series: number[] }) {
  const W = 320;
  const H = 76;
  const PAD = 6;
  const n = series.length;
  if (n === 0) return null;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return { x, y };
  });
  const first = pts[0];
  const last = pts[n - 1];
  if (!first || !last) return null;
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area = line + " L" + last.x.toFixed(1) + " " + (H - PAD) + " L" + first.x.toFixed(1) + " " + (H - PAD) + " Z";
  return (
    <Svg width="100%" height={H} viewBox={"0 0 " + W + " " + H}>
      <Path d={area} fill="#00D26A" fillOpacity={0.08} />
      <Path d={line} stroke="#00D26A" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export default function InsightsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [data, setData] = useState<InsightsData | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) { setData({ orders: [], paidItems: [], paidAtByOrder: {} }); return; }
    setData(await fetchInsightsData(businessId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[insights] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } catch (err) { console.error("[insights] refresh error:", err); } finally { setRefreshing(false); }
  }, [load]);

  const stats = useMemo(() => (data ? computeWindow(data, range) : null), [data, range]);
  const hasAny = !!data && data.orders.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-2">
        <Text className="text-text text-3xl font-bold">Insights</Text>
        <Text className="text-textMuted text-base mt-1">How your business is doing</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        <View className="flex-row gap-2 px-1 pt-2 pb-1">
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                className={"px-4 py-2 rounded-full active:opacity-80 " + (active ? "bg-primary" : "bg-gray-100")}
              >
                <Text className={"text-sm font-semibold " + (active ? "text-white" : "text-textMuted")}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading && !stats ? (
          <Text className="text-textMuted text-sm mt-4 px-1">Loading insights…</Text>
        ) : !hasAny || !stats ? (
          <View className="bg-white rounded-3xl p-6 mt-3" style={styles.card}>
            <Text className="text-text text-base font-semibold">No data yet</Text>
            <Text className="text-textMuted text-sm mt-1">Insights appear once you start taking orders.</Text>
          </View>
        ) : (
          <View className="gap-4 mt-3">
            <View className="rounded-3xl p-5 bg-green-50" style={styles.card}>
              <View className="flex-row items-center mb-2">
                <Bot size={16} color="#15803D" />
                <Text className="text-green-700 text-xs font-bold uppercase tracking-wider ml-1.5">BizBot summary</Text>
              </View>
              <Text className="text-text text-base leading-6">{buildSummary(stats, RANGE_LABEL[range])}</Text>
            </View>

            <View className="bg-white rounded-3xl p-5" style={styles.card}>
              <Text className="text-textMuted text-xs uppercase tracking-wider">Revenue ({RANGE_LABEL[range]})</Text>
              <Text className="text-text text-4xl font-bold mt-1">{formatNaira(stats.paidRevenueKobo)}</Text>
              <View className="mt-3">
                <Sparkline series={stats.series} />
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1 bg-white rounded-3xl p-5" style={styles.card}>
                <Text className="text-textMuted text-xs uppercase tracking-wider">Avg order</Text>
                <Text className="text-text text-2xl font-bold mt-1">{formatNaira(stats.aovKobo)}</Text>
              </View>
              <View className="flex-1 bg-white rounded-3xl p-5" style={styles.card}>
                <Text className="text-textMuted text-xs uppercase tracking-wider">Paid orders</Text>
                <Text className="text-text text-2xl font-bold mt-1">{stats.paidCount}</Text>
              </View>
            </View>

            <View className="bg-white rounded-3xl p-5" style={styles.card}>
              <View className="flex-row items-center justify-between">
                <Text className="text-textMuted text-xs uppercase tracking-wider">Outstanding now</Text>
                <View className="bg-amber-50 px-2.5 py-1 rounded-full">
                  <Text className="text-amber-700 text-xs font-semibold">{stats.pendingCount} pending</Text>
                </View>
              </View>
              <Text className="text-text text-3xl font-bold mt-1">{formatNaira(stats.outstandingKobo)}</Text>
            </View>

            <View className="bg-white rounded-3xl px-5 py-2" style={styles.card}>
              <Text className="text-textMuted text-xs uppercase tracking-wider py-3">Top products</Text>
              {stats.topProducts.length === 0 ? (
                <Text className="text-textMuted text-sm pb-4">No paid sales in this period.</Text>
              ) : (
                stats.topProducts.map((p, idx) => (
                  <View key={p.name} className={"py-3 flex-row items-center justify-between " + (idx === 0 ? "border-t border-gray-100" : "border-t border-gray-100")}>
                    <View className="flex-1 mr-3">
                      <Text className="text-text text-base font-medium" numberOfLines={1}>{p.name}</Text>
                      <Text className="text-textMuted text-xs mt-0.5">{p.qty} sold</Text>
                    </View>
                    <Text className="text-text text-base font-semibold">{formatNaira(p.revenueKobo)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#0B0B0B",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
