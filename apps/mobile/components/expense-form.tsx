import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronDown, Trash2 } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { ScreenHeader } from "./screen-header";
import { parseNairaToKobo } from "../lib/money";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  EXPENSE_CATEGORY_OPTIONS,
  labelForCategory,
  type ExpenseRow,
} from "../lib/expenses";

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Shared by /expenses/new (create) and /expenses/[id] (edit). When `expense`
// is provided the form is in edit mode and shows a delete action. Amount is
// entered in naira and converted to kobo at save; the date is a plain
// YYYY-MM-DD string capped at today.
export function ExpenseForm({
  businessId,
  expense,
}: {
  businessId: string;
  expense?: ExpenseRow;
}) {
  const router = useRouter();
  const isEdit = Boolean(expense);

  const [amount, setAmount] = useState(
    expense ? String(expense.amount_kobo / 100) : "",
  );
  const [category, setCategory] = useState(expense?.category ?? "stock");
  const [dateStr, setDateStr] = useState(expense?.occurred_at ?? todayStr());
  const [note, setNote] = useState(expense?.note ?? "");
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const amountKobo = useMemo(() => parseNairaToKobo(amount), [amount]);
  const canSave = amountKobo !== null && amountKobo > 0 && !saving && !deleting;

  function validate(): string | null {
    if (amountKobo === null || amountKobo <= 0) return "Enter an amount greater than 0.";
    if (!DATE_RE.test(dateStr.trim())) return "Use the date format YYYY-MM-DD.";
    if (dateStr.trim() > todayStr()) return "The date cannot be in the future.";
    return null;
  }

  const handleSave = async () => {
    const problem = validate();
    if (problem || amountKobo === null) {
      Alert.alert("Check the expense", problem ?? "Please review the fields.");
      return;
    }
    setSaving(true);
    const input = {
      businessId,
      amountKobo,
      category,
      occurredAt: dateStr.trim(),
      note,
    };
    const result = expense
      ? await updateExpense(expense.id, input)
      : await createExpense(input);
    setSaving(false);

    if (result.error) {
      Alert.alert("Could not save expense", result.error);
      return;
    }
    router.back();
  };

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert("Delete this expense?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          const result = await deleteExpense(businessId, expense.id);
          setDeleting(false);
          if (result.error) {
            Alert.alert("Could not delete expense", result.error);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title={isEdit ? "Edit expense" : "New expense"} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        {/* Amount */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-2">Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
        />

        {/* Category */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Category</Text>
        <Pressable
          onPress={() => setShowCategories((v) => !v)}
          className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
        >
          <Text className="text-text text-base flex-1">{labelForCategory(category)}</Text>
          <ChevronDown size={18} color="#9CA3AF" />
        </Pressable>
        {showCategories ? (
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl px-4">
            {EXPENSE_CATEGORY_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setCategory(opt.value);
                  setShowCategories(false);
                }}
                className={
                  "py-3 active:opacity-60" + (i > 0 ? " border-t border-gray-100" : "")
                }
              >
                <Text
                  className={
                    "text-base " + (opt.value === category ? "text-primary font-semibold" : "text-text")
                  }
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Date */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Date</Text>
        <TextInput
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
        />

        {/* Note */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. fuel for delivery"
          placeholderTextColor="#9CA3AF"
          multiline
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />

        {isEdit ? (
          <Pressable
            onPress={handleDelete}
            disabled={deleting || saving}
            className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl py-4 bg-dangerSoft active:opacity-70"
          >
            {deleting ? (
              <ActivityIndicator color={designColors.danger} />
            ) : (
              <>
                <Trash2 size={18} color={designColors.danger} />
                <Text className="text-danger text-base font-semibold">Delete expense</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Sticky save */}
      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={"rounded-2xl py-4 items-center " + (canSave ? "bg-primary active:opacity-80" : "bg-gray-200")}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className={"text-base font-semibold " + (canSave ? "text-white" : "text-gray-400")}>
              {isEdit ? "Save changes" : "Add expense"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
