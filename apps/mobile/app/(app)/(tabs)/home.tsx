import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../../lib/session";
import { supabase } from "../../../lib/supabase";
import { firstNameFrom } from "../../../lib/profile";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchDashboardSummary, type DashboardSummary } from "../../../lib/dashboard";
import { formatNaira } from "../../../lib/format";
import { Wordmark } from "../../../components/wordmark";
import { DashboardTile } from "../../../components/dashboard-tile";
import { OrderRow } from "../../../components/order-row";

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [firstName, setFirstName] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    // Fetch profile (for greeting) + business + dashboard in parallel where possible.
    const [profileRes, businessId] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      getActiveBusinessId(userId),
    ]);

    setFirstName(firstNameFrom({ full_name: profileRes.data?.full_name, email: userEmail }));

    if (!businessId) {
      // No business yet — render empty dashboard. User likely mid-onboarding.
      setSummary({
        tiles: { revenueTodayKobo: 0, ordersTodayCount: 0, pendingCount: 0, activeProductsCount: 0 },
        recentOrders: [],
      });
      return;
    }

    const data = await fetchDashboardSummary(businessId);
    setSummary(data);
  }, [userId, userEmail]);

  // Re-fetch every time the tab is focused (covers initial mount + return from other tabs).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[home] load error:", err))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error("[home] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const t = summary?.tiles;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        <View className="px-6 pt-4">
          <Wordmark />
        </View>

        <View className="px-6 pt-8">
          <Text className="text-text text-3xl font-bold">
            Hey {firstName ?? "there"}
          </Text>
          <Text className="text-textMuted text-base mt-1">
            Here is your business today
          </Text>
        </View>

        {/* Tile grid 2x2 */}
        <View className="px-6 pt-6">
          <View className="flex-row gap-3">
            <DashboardTile
              label="Revenue today"
              value={t ? formatNaira(t.revenueTodayKobo) : null}
              loading={loading}
            />
            <DashboardTile
              label="Orders today"
              value={t?.ordersTodayCount != null ? String(t.ordersTodayCount) : null}
              loading={loading}
            />
          </View>
          <View className="flex-row gap-3 mt-3">
            <DashboardTile
              label="Pending"
              value={t?.pendingCount != null ? String(t.pendingCount) : null}
              loading={loading}
            />
            <DashboardTile
              label="Active products"
              value={t?.activeProductsCount != null ? String(t.activeProductsCount) : null}
              loading={loading}
            />
          </View>
        </View>

        {/* Recent orders */}
        <View className="px-6 pt-8">
          <Text className="text-text text-lg font-semibold mb-3">Recent orders</Text>

          {loading && !summary ? (
            <Text className="text-textMuted text-sm">Loading recent orders…</Text>
          ) : summary && summary.recentOrders.length === 0 ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-6">
              <Text className="text-text text-base font-medium">No orders yet</Text>
              <Text className="text-textMuted text-sm mt-1">
                They will appear here when customers buy from you.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {summary?.recentOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onPress={() => router.push(`/orders/${order.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
