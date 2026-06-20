import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { useNotifier } from "../../../components/notifier";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { MessageCircle, Phone, Pencil, ChevronRight } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { ScreenHeader } from "../../../components/screen-header";
import { EditCustomerSheet } from "../../../components/edit-customer-sheet";
import {
  fetchCustomerProfile,
  fetchOpenOrders,
  fetchCustomerReceipts,
  updateCustomer,
  findCustomerConversation,
  type CustomerProfile,
  type OpenOrder,
  type CustomerReceipt,
} from "../../../lib/customer-stats";
import { formatNaira, formatDateTime } from "../../../lib/format";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return ((first.charAt(0) + last.charAt(0)) || "?").toUpperCase();
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const { notify } = useNotifier();
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await fetchCustomerProfile(id);
    if (!p) { setNotFound(true); return; }
    setProfile(p);
    const [o, r] = await Promise.all([fetchOpenOrders(id), fetchCustomerReceipts(id)]);
    setOpenOrders(o);
    setReceipts(r);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[customer-detail] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onMessage = useCallback(async () => {
    if (!profile) return;
    const convoId = await findCustomerConversation(profile.id);
    if (convoId) {
      router.push(`/conversations/${convoId}`);
      return;
    }
    const num = digitsOnly(profile.phoneE164);
    if (num) {
      Linking.openURL(`https://wa.me/${num}`).catch((err) => console.error("[customer-detail] wa error:", err));
    } else {
      notify({ type: "info", title: "No chat yet", message: "There is no WhatsApp conversation with this customer yet." });
    }
  }, [profile]);

  const onCall = useCallback(() => {
    if (!profile?.phoneE164) return;
    Linking.openURL(`tel:${profile.phoneE164}`).catch((err) => console.error("[customer-detail] call error:", err));
  }, [profile]);

  const onSaveEdit = useCallback(async (name: string, notes: string) => {
    if (!profile) return;
    setSavingEdit(true);
    setEditError(null);
    const result = await updateCustomer(profile.id, { name, notes });
    setSavingEdit(false);
    if (!result.ok) { setEditError(result.error ?? "Could not save."); return; }
    setEditing(false);
    await load();
  }, [profile, load]);

  if (loading && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Customer" />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#9CA3AF" /></View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Customer" />
        <View className="flex-1 px-6 pt-8">
          <Text className="text-text text-lg font-semibold">Customer not found</Text>
          <Text className="text-textMuted text-sm mt-1">It may have been removed or you do not have access.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Customer" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }}>
        <View className="bg-white border border-gray-200 rounded-2xl p-5 mt-2">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-green-50 items-center justify-center mr-4">
              <Text className="text-green-700 text-lg font-bold">{initials(profile.name)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text text-xl font-bold" numberOfLines={1}>{profile.name}</Text>
              {profile.phoneE164 ? <Text className="text-textMuted text-sm mt-0.5">{profile.phoneE164}</Text> : null}
              {profile.email ? <Text className="text-textMuted text-sm">{profile.email}</Text> : null}
            </View>
            <Pressable onPress={() => { setEditError(null); setEditing(true); }} hitSlop={8} className="p-2 active:opacity-60">
              <Pencil size={18} color={designColors.text} />
            </Pressable>
          </View>

          {profile.notes ? (
            <View className="mt-4 bg-gray-50 rounded-xl p-3">
              <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Notes</Text>
              <Text className="text-text text-sm">{profile.notes}</Text>
            </View>
          ) : null}

          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <Pressable onPress={onMessage} className="flex-1 bg-primary rounded-2xl py-3 items-center active:opacity-80 flex-row justify-center">
              <MessageCircle size={16} color="#FFFFFF" strokeWidth={2} />
              <Text className="text-white text-sm font-semibold ml-2">Message</Text>
            </Pressable>
            <Pressable onPress={onCall} className="flex-1 bg-white border border-gray-200 rounded-2xl py-3 items-center active:opacity-60 flex-row justify-center">
              <Phone size={16} color={designColors.text} strokeWidth={2} />
              <Text className="text-text text-sm font-semibold ml-2">Call</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row mt-3" style={{ gap: 10 }}>
          <View className="flex-1 bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Spent</Text>
            <Text className="text-text text-lg font-bold mt-1" numberOfLines={1}>{formatNaira(profile.totalSpentKobo)}</Text>
          </View>
          <View className="flex-1 bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Orders</Text>
            <Text className="text-text text-lg font-bold mt-1">{profile.totalOrders}</Text>
          </View>
        </View>
        {profile.lastPurchaseAt ? (
          <Text className="text-textMuted text-xs mt-2 px-1">Last purchase {formatDateTime(profile.lastPurchaseAt)}</Text>
        ) : null}

        {openOrders.length > 0 ? (
          <View className="mt-6">
            <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Open orders</Text>
            <View className="gap-2">
              {openOrders.map((o) => (
                <Pressable key={o.id} onPress={() => router.push(`/orders/${o.id}`)} className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60">
                  <View className="flex-1 mr-3">
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>{o.itemSummary}</Text>
                    <Text className="text-textMuted text-xs mt-0.5">{formatDateTime(o.createdAt)}</Text>
                  </View>
                  <Text className="text-text text-sm font-bold mr-2">{formatNaira(o.subtotalKobo)}</Text>
                  <ChevronRight size={16} color={designColors.text} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-6">
          <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Receipts</Text>
          {receipts.length === 0 ? (
            <View className="bg-white border border-gray-200 rounded-2xl p-5">
              <Text className="text-textMuted text-sm">No paid receipts yet.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {receipts.map((r) => (
                <Pressable key={r.id} onPress={() => router.push(`/receipts/${r.id}`)} className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60">
                  <View className="flex-1 mr-3">
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>{r.itemSummary}</Text>
                    <Text className="text-textMuted text-xs mt-0.5">{r.paidAt ? formatDateTime(r.paidAt) : "Paid"}</Text>
                  </View>
                  <View className="items-end mr-2">
                    <Text className="text-text text-sm font-bold">{formatNaira(r.subtotalKobo)}</Text>
                    <Text className="text-textMuted text-xs mt-0.5">#{r.receiptCode}</Text>
                  </View>
                  <ChevronRight size={16} color={designColors.text} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <EditCustomerSheet
        visible={editing}
        initialName={profile.name}
        initialNotes={profile.notes ?? ""}
        saving={savingEdit}
        error={editError}
        onCancel={() => { if (!savingEdit) setEditing(false); }}
        onSave={onSaveEdit}
      />
    </SafeAreaView>
  );
}
