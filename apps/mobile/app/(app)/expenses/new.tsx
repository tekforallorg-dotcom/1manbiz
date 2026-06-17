import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { ScreenHeader } from "../../../components/screen-header";
import { ExpenseForm } from "../../../components/expense-form";

export default function NewExpenseScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getActiveBusinessId(userId)
      .then(setBusinessId)
      .catch((err) => console.error("[expense/new] business:", err))
      .finally(() => setResolved(true));
  }, [userId]);

  if (!businessId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScreenHeader title="New expense" />
        <View className="flex-1 items-center justify-center">
          {!resolved ? <ActivityIndicator color="#9CA3AF" /> : null}
        </View>
      </SafeAreaView>
    );
  }

  return <ExpenseForm businessId={businessId} />;
}
