import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Landmark, Search, X } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { useNotifier } from "./notifier";
import {
  connectPaystackSubaccount,
  getPaystackSettlement,
  listPaystackBanks,
  setOnlinePayments,
  type PaystackBank,
  type PaystackSettlement,
} from "../lib/payment-connectors";

interface Props {
  businessId: string;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function maskAccount(num: string | null): string {
  if (!num) return "";
  return num.length >= 4 ? "\u2022\u2022\u2022\u2022 " + num.slice(-4) : num;
}

export function PaystackConnectSheet({ businessId, visible, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { notify } = useNotifier();

  const [loading, setLoading] = useState(true);
  const [settlement, setSettlement] = useState<PaystackSettlement | null>(null);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [changing, setChanging] = useState(false);

  const [query, setQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState<PaystackBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    setChanging(false);
    setQuery("");
    setSelectedBank(null);
    setAccountNumber("");
    (async () => {
      const [s, b] = await Promise.all([getPaystackSettlement(businessId), listPaystackBanks()]);
      if (!alive) return;
      setSettlement(s);
      setBanks(b.ok ? b.banks : []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [visible, businessId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as PaystackBank[];
    return banks.filter((bk) => bk.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, banks]);

  const canConnect = Boolean(selectedBank) && /^\d{10}$/.test(accountNumber) && !busy;

  const doConnect = async () => {
    if (!selectedBank || !canConnect) return;
    setBusy(true);
    const res = await connectPaystackSubaccount(selectedBank.code, accountNumber, selectedBank.name);
    setBusy(false);
    if (!res.ok) {
      notify({ type: "error", title: "Could not connect", message: res.error });
      return;
    }
    notify({
      type: "success",
      title: "Paystack connected",
      message: "Settling to " + res.accountName + ". Online payments are on.",
    });
    onClose();
    onChanged();
  };

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    const res = await setOnlinePayments(businessId, false);
    setBusy(false);
    if (res.error) {
      notify({ type: "error", title: "Could not update", message: res.error });
      return;
    }
    notify({ type: "success", title: "Online payments off", message: "BizBot will stop sending payment links." });
    onClose();
    onChanged();
  };

  const showForm = !settlement || changing;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        className="bg-black/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View className="absolute left-0 right-0 bottom-0">
        <View
          className="bg-white rounded-t-3xl border border-gray-200 px-5 pt-5"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-text text-xl font-bold">Online payments</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="w-8 h-8 items-center justify-center active:opacity-60"
            >
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : showForm ? (
            <View>
              <Text className="text-textMuted text-sm mb-4">
                Add the account where Paystack should settle your sales. Card and transfer payments
                land here automatically.
              </Text>

              <Text className="text-textMuted text-xs font-semibold mb-1.5">BANK</Text>
              {selectedBank ? (
                <Pressable
                  onPress={() => {
                    setSelectedBank(null);
                    setQuery("");
                  }}
                  style={styles.selectedBank}
                  className="active:opacity-70"
                >
                  <View className="w-9 h-9 rounded-xl bg-green-50 items-center justify-center mr-3">
                    <Landmark size={17} color={colors.primary} />
                  </View>
                  <Text className="text-text text-base font-medium flex-1">{selectedBank.name}</Text>
                  <Text className="text-primary text-sm font-medium">Change</Text>
                </Pressable>
              ) : (
                <View>
                  <View style={styles.searchRow}>
                    <Search size={17} color={colors.textMuted} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search your bank"
                      placeholderTextColor={colors.textMuted}
                      style={styles.searchInput}
                      autoCorrect={false}
                    />
                  </View>
                  {matches.length > 0 ? (
                    <ScrollView
                      style={{ maxHeight: 220 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {matches.map((bk) => (
                        <Pressable
                          key={bk.code}
                          onPress={() => setSelectedBank(bk)}
                          style={styles.bankRow}
                          className="active:opacity-70"
                        >
                          <Text className="text-text text-base flex-1">{bk.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : query.trim().length > 1 ? (
                    <Text className="text-textMuted text-xs mt-2">No bank matches that.</Text>
                  ) : null}
                </View>
              )}

              <Text className="text-textMuted text-xs font-semibold mb-1.5 mt-4">ACCOUNT NUMBER</Text>
              <TextInput
                value={accountNumber}
                onChangeText={(v) => setAccountNumber(v.replace(/[^\d]/g, "").slice(0, 10))}
                placeholder="10-digit account number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.acctInput}
              />

              <Pressable
                onPress={doConnect}
                disabled={!canConnect}
                className={`mt-5 rounded-2xl py-3.5 items-center ${canConnect ? "bg-primary active:opacity-90" : "bg-gray-300"}`}
              >
                <Text className="text-white text-base font-semibold">
                  {busy ? "Connecting..." : "Connect"}
                </Text>
              </Pressable>

              {changing ? (
                <Pressable onPress={() => setChanging(false)} className="mt-2 py-2 items-center active:opacity-60">
                  <Text className="text-textMuted text-sm">Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View>
              <View className="bg-gray-50 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center mb-1">
                  <View className="w-5 h-5 rounded-full bg-green-50 items-center justify-center mr-2">
                    <Check size={13} color={colors.primary} />
                  </View>
                  <Text className="text-text text-base font-semibold">Settling to your account</Text>
                </View>
                <Text className="text-text text-sm">{settlement?.accountName}</Text>
                <Text className="text-textMuted text-sm">
                  {settlement?.bankName} {maskAccount(settlement?.accountNumber ?? null)}
                </Text>
                {settlement?.splitPercent != null ? (
                  <Text className="text-textMuted text-xs mt-2">
                    Platform fee {settlement.splitPercent}% per sale.
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => setChanging(true)}
                style={styles.manageRow}
                className="active:opacity-70"
              >
                <Text className="text-text text-base flex-1">Change settlement account</Text>
              </Pressable>

              <Pressable
                onPress={turnOff}
                disabled={busy}
                className={`mt-3 border rounded-2xl py-3.5 items-center ${busy ? "border-gray-200" : "border-red-200 active:opacity-80"}`}
              >
                <Text className="text-red-600 text-base font-semibold">
                  {busy ? "Working..." : "Turn off online payments"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: "#0A0A0A" },
  bankRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  selectedBank: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  acctInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: "#0A0A0A",
  },
  manageRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
});
