import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { ScreenHeader } from "../../../components/screen-header";
import { ExpenseForm } from "../../../components/expense-form";
import { fetchExpense, type ExpenseRow } from "../../../lib/expenses";

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [expense, setExpense] = useState<ExpenseRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const bid = await getActiveBusinessId(userId);
      if (cancelled) return;
      setBusinessId(bid);
      if (bid) {
        const row = await fetchExpense(bid, id);
        if (!cancelled) setExpense(row);
      }
    })()
      .catch((err) => console.error("[expense/edit] load:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  if (loading || !businessId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScreenHeader title="Edit expense" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScreenHeader title="Edit expense" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text text-base font-medium">Expense not found</Text>
          <Text className="text-textMuted text-sm mt-1 text-center">
            It may have been removed already.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <ExpenseForm businessId={businessId} expense={expense} />;
}
