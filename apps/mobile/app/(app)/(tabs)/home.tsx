import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronRight,
  ShoppingBag,
  Package,
  Settings,
  LineChart,
  type LucideIcon,
} from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";
import { useSession } from "../../../lib/session";
import { supabase } from "../../../lib/supabase";
import { firstNameFrom } from "../../../lib/profile";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchDashboardSummary, type DashboardSummary } from "../../../lib/dashboard";
import { formatNaira } from "../../../lib/format";
import { Wordmark } from "../../../components/wordmark";
import { OrderRow } from "../../../components/order-row";

const CARD_SHADOW = {
  shadowColor: "#0B0B0B",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Plain-language read of the day. Sounds like a person, no dashes.
function buildSummary(s: DashboardSummary | null): string {
  if (!s) return "Loading your day.";
  const orders = s.tiles.ordersTodayCount ?? 0;
  const pending = s.tiles.pendingCount ?? 0;
  if (orders === 0 && pending === 0) {
    return "Nothing yet today. A good moment to message a customer or share your catalogue.";
  }
  const parts: string[] = [];
  parts.push(
    orders === 1
      ? "1 order came in today"
      : orders === 0
        ? "No new orders yet today"
        : `${orders} orders came in today`,
  );
  if (pending > 0) {
    parts.push(pending === 1 ? "1 is waiting to be paid" : `${pending} are waiting to be paid`);
  }
  return parts.join(", ") + ".";
}

type QuickAction = {
  key: "order" | "product" | "settings" | "insights";
  label: string;
  hint: string;
  icon: LucideIcon;
  primary?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: "order", label: "Create order", hint: "Start a new sale", icon: ShoppingBag, primary: true },
  { key: "product", label: "Add product", hint: "Update your catalogue", icon: Package },
  { key: "settings", label: "Settings", hint: "Business and BizBot", icon: Settings },
  { key: "insights", label: "Insights", hint: "Sales and trends", icon: LineChart },
];

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [firstName, setFirstName] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  const load = useCallback(async () => {
    if (!userId) return;
    const [profileRes, businessId] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      getActiveBusinessId(userId),
    ]);
    setFirstName(firstNameFrom({ full_name: profileRes.data?.full_name, email: userEmail }));
    if (!businessId) {
      setSummary({
        tiles: { revenueTodayKobo: 0, ordersTodayCount: 0, pendingCount: 0, activeProductsCount: 0 },
        recentOrders: [],
      });
      return;
    }
    const data = await fetchDashboardSummary(businessId);
    setSummary(data);
  }, [userId, userEmail]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[home] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  // Gentle entrance, once on mount. Core Animated, no native rebuild needed.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [fade, lift]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[home] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  const t = summary?.tiles;
  const pending = t?.pendingCount ?? 0;
  const now = new Date();
  const dateLabel = `${DAYS[now.getDay()] ?? ""}, ${now.getDate()} ${MONTHS[now.getMonth()] ?? ""}`;
  const initial = (firstName?.trim()[0] ?? "?").toUpperCase();
  const ctaPending = !!t && pending > 0;
  const ctaLabel = ctaPending
    ? (pending === 1 ? "Review 1 pending order" : `Review ${pending} pending orders`)
    : "Open inbox";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        <View className="px-6 pt-4 flex-row items-center justify-between">
          <Wordmark />
          <Pressable
            onPress={() => router.push("/settings")}
            className="w-10 h-10 rounded-full bg-surface-muted items-center justify-center active:opacity-80"
            hitSlop={6}
          >
            <Text className="text-text text-base font-semibold">{initial}</Text>
          </Pressable>
        </View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
          <View className="px-6 pt-7">
            <Text className="text-text text-3xl font-bold">
              {greetingFor(now)}{firstName ? `, ${firstName}` : ""}
            </Text>
            <Text className="text-textMuted text-sm mt-1">{dateLabel}</Text>
          </View>

          {/* Hero revenue card */}
          <View className="px-6 pt-5">
            <View className="bg-white rounded-3xl px-5 py-5" style={CARD_SHADOW}>
              <Text className="text-textMuted text-xs font-medium uppercase tracking-wider">Today's revenue</Text>
              {loading && !summary ? (
                <View className="mt-2 h-10 w-44 rounded-lg bg-gray-100" />
              ) : (
                <Text className="text-text text-4xl font-bold mt-1" numberOfLines={1}>
                  {t ? formatNaira(t.revenueTodayKobo) : "-"}
                </Text>
              )}
              <Text className="text-textSecondary text-sm mt-3 leading-5">{buildSummary(summary)}</Text>

              <View className="flex-row mt-4 pt-4 border-t border-gray-100">
                <View className="flex-1">
                  <Text className="text-textMuted text-xs uppercase tracking-wide">Orders</Text>
                  <Text className="text-text text-lg font-semibold mt-0.5">
                    {t?.ordersTodayCount != null ? String(t.ordersTodayCount) : "-"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-textMuted text-xs uppercase tracking-wide">Pending</Text>
                  <Text className={"text-lg font-semibold mt-0.5 " + (pending > 0 ? "text-primary" : "text-text")}>
                    {t?.pendingCount != null ? String(t.pendingCount) : "-"}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-textMuted text-xs uppercase tracking-wide">Products</Text>
                  <Text className="text-text text-lg font-semibold mt-0.5">
                    {t?.activeProductsCount != null ? String(t.activeProductsCount) : "-"}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => router.push(ctaPending ? "/orders" : "/conversations")}
                className={"flex-row items-center justify-center rounded-full py-3 mt-4 active:opacity-80 " + (ctaPending ? "bg-primary" : "bg-gray-100")}
              >
                <Text className={"text-sm font-semibold mr-0.5 " + (ctaPending ? "text-white" : "text-text")}>{ctaLabel}</Text>
                <ChevronRight size={16} color={ctaPending ? "#FFFFFF" : designColors.text} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Quick actions */}
          <View className="px-6 pt-7">
            <Text className="text-text text-base font-semibold mb-3">Quick actions</Text>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <View key={a.key} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
                    <Pressable
                      onPress={() => {
                        if (a.key === "order") router.push("/orders/new");
                        else if (a.key === "product") router.push("/products/new");
                        else if (a.key === "settings") router.push("/settings");
                        else router.push("/insights");
                      }}
                      className="bg-white rounded-3xl p-4 active:opacity-80"
                      style={CARD_SHADOW}
                    >
                      <View className={"w-11 h-11 rounded-2xl items-center justify-center " + (a.primary ? "bg-green-50" : "bg-gray-100")}>
                        <Icon size={20} color={a.primary ? designColors.primary : designColors.text} strokeWidth={2} />
                      </View>
                      <Text className="text-text text-base font-semibold mt-3">{a.label}</Text>
                      <Text className="text-textMuted text-xs mt-0.5">{a.hint}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recent orders */}
          <View className="px-6 pt-4">
            <Pressable
              onPress={() => router.push("/orders")}
              className="flex-row items-center justify-between mb-3 active:opacity-70"
              hitSlop={6}
            >
              <Text className="text-text text-base font-semibold">Recent orders</Text>
              <View className="flex-row items-center">
                <Text className="text-textMuted text-sm mr-0.5">View all</Text>
                <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
              </View>
            </Pressable>

            {loading && !summary ? (
              <Text className="text-textMuted text-sm">Loading recent orders...</Text>
            ) : summary && summary.recentOrders.length === 0 ? (
              <View className="bg-white rounded-3xl px-5 py-6" style={CARD_SHADOW}>
                <Text className="text-text text-base font-medium">No orders yet</Text>
                <Text className="text-textMuted text-sm mt-1">They will appear here when customers buy from you.</Text>
              </View>
            ) : (
              <View className="gap-2">
                {summary?.recentOrders.map((order) => (
                  <OrderRow key={order.id} order={order} onPress={() => router.push(`/orders/${order.id}`)} />
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
