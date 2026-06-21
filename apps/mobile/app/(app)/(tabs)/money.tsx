import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Plus } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { formatNairaFromKobo } from "../../../lib/money";
import {
  fetchMoneyOverview,
  type MoneyOverview,
  type MoneyPeriodDays,
} from "../../../lib/money-overview";
import { fetchExpenses, labelForCategory, type ExpenseRow } from "../../../lib/expenses";

const PERIODS: { value: MoneyPeriodDays; label: string }[] = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

const HERO_BG = colors.primary;

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}

export default function MoneyScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();

  const [period, setPeriod] = useState<MoneyPeriodDays>(30);
  const [overview, setOverview] = useState<MoneyOverview | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) {
      setOverview({ incomeKobo: 0, expensesKobo: 0, profitKobo: 0 });
      setExpenses([]);
      return;
    }
    const [ov, list] = await Promise.all([
      fetchMoneyOverview(businessId, period),
      fetchExpenses(businessId),
    ]);
    setOverview(ov);
    setExpenses(list);
  }, [userId, period]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[money] load error:", err))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error("[money] refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const profitKobo = overview?.profitKobo ?? 0;
  const expensesTotalKobo = (expenses ?? []).reduce((s, e) => s + e.amount_kobo, 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Money</Text>
        <Text className="text-textMuted text-base mt-1">Sales, expenses, and real profit</Text>
      </View>

      {/* Period control */}
      <View className="px-6 pb-3">
        <View className="flex-row bg-surface-muted rounded-full p-1 self-start">
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                className={"rounded-full px-4 py-1.5 " + (active ? "bg-white" : "")}
              >
                <Text
                  className={
                    "text-sm font-semibold " + (active ? "text-text" : "text-textMuted")
                  }
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />
        }
      >
        {/* P&L hero */}
        <View className="rounded-3xl p-5" style={{ backgroundColor: HERO_BG }}>
          <Text className="text-white/70 text-xs uppercase tracking-wider font-semibold">
            Profit
          </Text>
          <Text className="text-white text-3xl font-bold mt-1">
            {formatNairaFromKobo(profitKobo)}
          </Text>
          <View className="flex-row mt-4 gap-4">
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold">Money in</Text>
              <Text className="text-white text-base font-semibold mt-0.5">
                {formatNairaFromKobo(overview?.incomeKobo ?? 0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold">Money out</Text>
              <Text className="text-white text-base font-semibold mt-0.5">
                {formatNairaFromKobo(overview?.expensesKobo ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Expenses */}
        <View className="flex-row items-center justify-between mt-6 mb-2">
          <Text className="text-text text-lg font-bold">Expenses</Text>
          {expenses && expenses.length > 0 ? (
            <Text className="text-textMuted text-sm">{formatNairaFromKobo(expensesTotalKobo)}</Text>
          ) : null}
        </View>

        {loading && !expenses ? (
          <Text className="text-textMuted text-sm">Loading…</Text>
        ) : expenses && expenses.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No expenses yet</Text>
            <Text className="text-textMuted text-sm mt-1">
              Record what you spend to see your real profit.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {expenses?.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/expenses/${e.id}` as Href)}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex-row items-center active:opacity-60"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2">
                    <View className="bg-surface-muted rounded-full px-2 py-0.5">
                      <Text className="text-text-secondary text-xs font-medium">
                        {labelForCategory(e.category)}
                      </Text>
                    </View>
                    <Text className="text-textMuted text-xs">{formatDate(e.occurred_at)}</Text>
                  </View>
                  {e.note ? (
                    <Text className="text-text-secondary text-sm mt-1" numberOfLines={1}>
                      {e.note}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-text text-base font-semibold">
                  {formatNairaFromKobo(e.amount_kobo)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/expenses/new" as Href)}
        className="absolute bg-primary rounded-full items-center justify-center active:opacity-80"
        style={{
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          shadowColor: "#0B0B0B",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
        hitSlop={6}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}
