import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput, Share } from "react-native";
import { useNotifier } from "../../../components/notifier";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { ChevronRight, Search, UserPlus, Share2 } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { supabase } from "../../../lib/supabase";
import { createCustomer } from "../../../lib/customers";
import { formatNaira, formatDateTime } from "../../../lib/format";
import { AddCustomerSheet } from "../../../components/add-customer-sheet";
import { SummaryStrip } from "../../../components/summary-strip";

type CustomerRow = {
  id: string;
  name: string;
  phone_e164: string;
  total_orders: number;
  total_spent_kobo: number;
  last_purchase_at: string | null;
};

type SortKey = "recent" | "spend" | "orders";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return ((first.charAt(0) + last.charAt(0)) || "?").toUpperCase();
}

export default function CustomersScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const { notify } = useNotifier();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const [adding, setAdding] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const bid = await getActiveBusinessId(userId);
    setBusinessId(bid);
    if (!bid) { setCustomers([]); return; }
    const [{ data: biz }, { data }] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", bid).maybeSingle(),
      supabase
        .from("customers")
        .select("id, name, phone_e164, total_orders, total_spent_kobo, last_purchase_at")
        .eq("business_id", bid)
        .order("last_purchase_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);
    setBusinessName((biz as { name?: string } | null)?.name ?? "");
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

  const totalSpentKobo = useMemo(
    () => (customers ?? []).reduce((s, c) => s + (c.total_spent_kobo ?? 0), 0),
    [customers],
  );

  const visible = useMemo(() => {
    const list = customers ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => c.name.toLowerCase().includes(q) || c.phone_e164.toLowerCase().includes(q))
      : list;
    if (sort === "spend") return [...filtered].sort((a, b) => (b.total_spent_kobo ?? 0) - (a.total_spent_kobo ?? 0));
    if (sort === "orders") return [...filtered].sort((a, b) => (b.total_orders ?? 0) - (a.total_orders ?? 0));
    return filtered;
  }, [customers, query, sort]);

  const onSaveAdd = useCallback(async (name: string, phone: string) => {
    if (!businessId) { setAddError("No active business."); return; }
    setSavingAdd(true);
    setAddError(null);
    const result = await createCustomer(businessId, name, phone);
    setSavingAdd(false);
    if (result.error || !result.customer) { setAddError(result.error ?? "Could not add customer."); return; }
    setAdding(false);
    await load();
  }, [businessId, load]);

  const onExport = useCallback(async () => {
    const list = customers ?? [];
    if (list.length === 0) { notify({ type: "info", title: "Nothing to share", message: "You have no customers yet." }); return; }
    const header = (businessName ? businessName + " - " : "") + "customer book (" + list.length + ")";
    const lines = list.map((c, i) =>
      (i + 1) + ". " + c.name + " - " + (c.phone_e164 || "no phone") +
      " - " + c.total_orders + " order" + (c.total_orders === 1 ? "" : "s") +
      " - " + formatNaira(c.total_spent_kobo) + " spent",
    );
    try {
      await Share.share({ message: header + "\n\n" + lines.join("\n") });
    } catch {
      // Share sheet dismissed.
    }
  }, [customers, businessName]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-text text-3xl font-bold">Customers</Text>
          <Text className="text-textMuted text-base mt-1">
            {customers && customers.length > 0 ? customers.length + " in your book" : "Your customer list"}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Pressable onPress={onExport} hitSlop={8} className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center active:opacity-60">
            <Share2 size={18} color={designColors.text} />
          </Pressable>
          <Pressable onPress={() => { setAddError(null); setAdding(true); }} hitSlop={8} className="w-10 h-10 rounded-full bg-primary items-center justify-center active:opacity-80">
            <UserPlus size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {customers && customers.length > 0 ? (
          <SummaryStrip
            items={[
              { label: "Total spent", value: formatNaira(customers.reduce((sum, c) => sum + (c.total_spent_kobo || 0), 0)), tone: "lead" },
              { label: "Customers", value: String(customers.length) },
              { label: "Repeat", value: String(customers.filter((c) => c.total_orders >= 2).length) },
            ]}
          />
        ) : null}
        {loading && !customers ? (
          <Text className="text-textMuted text-sm">Loading customers…</Text>
        ) : customers && customers.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No customers yet</Text>
            <Text className="text-textMuted text-sm mt-1">Customers are added automatically when they chat or order, or tap the plus to add one.</Text>
          </View>
        ) : (
          <>
            <View className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 flex-row items-center mb-3">
              <Search size={16} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name or phone"
                placeholderTextColor="#9CA3AF"
                className="flex-1 ml-2 text-text text-base"
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>

            <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-textMuted text-xs uppercase tracking-wider">Total spent</Text>
                <Text className="text-text text-2xl font-bold mt-1">{formatNaira(totalSpentKobo)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-textMuted text-xs uppercase tracking-wider">Customers</Text>
                <Text className="text-text text-2xl font-bold mt-1">{customers?.length ?? 0}</Text>
              </View>
            </View>

            <View className="flex-row mb-3">
              {(["recent", "spend", "orders"] as SortKey[]).map((k) => {
                const label = k === "recent" ? "Recent" : k === "spend" ? "Top spend" : "Most orders";
                const active = sort === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setSort(k)}
                    className={"px-3 py-1.5 rounded-full mr-2 " + (active ? "bg-gray-900" : "bg-white border border-gray-200")}
                  >
                    <Text className={"text-xs font-medium " + (active ? "text-white" : "text-textMuted")}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {visible.length === 0 ? (
              <View className="bg-white border border-gray-200 rounded-2xl p-6">
                <Text className="text-textMuted text-sm">No customers match your search.</Text>
              </View>
            ) : (
              <View className="gap-2">
                {visible.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/customers/${c.id}`)}
                    className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
                  >
                    <View className="w-11 h-11 rounded-full bg-green-50 items-center justify-center mr-3">
                      <Text className="text-green-700 text-sm font-bold">{initials(c.name)}</Text>
                    </View>
                    <View className="flex-1 mr-3">
                      <Text className="text-text text-base font-semibold" numberOfLines={1}>{c.name}</Text>
                      <Text className="text-textMuted text-xs mt-0.5">{c.phone_e164}</Text>
                      <Text className="text-textMuted text-xs mt-0.5">
                        {c.total_orders + " order" + (c.total_orders === 1 ? "" : "s")}
                        {c.last_purchase_at ? "  -  " + formatDateTime(c.last_purchase_at) : ""}
                      </Text>
                    </View>
                    <Text className="text-text text-sm font-bold mr-2">{formatNaira(c.total_spent_kobo)}</Text>
                    <ChevronRight size={18} color={designColors.text} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <AddCustomerSheet
        visible={adding}
        saving={savingAdd}
        error={addError}
        onCancel={() => { if (!savingAdd) setAdding(false); }}
        onSave={onSaveAdd}
      />
    </SafeAreaView>
  );
}
