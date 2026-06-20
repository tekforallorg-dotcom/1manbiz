import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { useNotifier } from "./notifier";
import { setOnlinePayments } from "../lib/payment-connectors";

interface Props {
  businessId: string;
  on: boolean; // current online-payments state
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ENABLES = [
  "BizBot sends a Paystack link for online orders",
  "Customer pays by card or bank transfer",
  "Order is marked paid automatically on payment",
  "Receipt is sent to the customer",
];

export function OnlinePaymentsSheet({ businessId, on, visible, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { notify } = useNotifier();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const res = await setOnlinePayments(businessId, !on);
    setBusy(false);
    if (res.error) {
      notify({ type: "error", title: "Could not update", message: res.error });
      return;
    }
    notify({
      type: "success",
      title: on ? "Online payments off" : "Online payments on",
      message: on
        ? "BizBot will stop sending payment links."
        : "BizBot can now send links and auto-mark paid.",
    });
    onClose();
    onChanged();
  };

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
          <Text className="text-textMuted text-sm mb-4">
            Card and transfer payments collected through a Paystack link.
          </Text>

          <View className="mb-4">
            {ENABLES.map((item) => (
              <View key={item} className="flex-row items-center py-1">
                <View className="w-5 h-5 rounded-full bg-green-50 items-center justify-center mr-2">
                  <Check size={13} color={colors.primary} />
                </View>
                <Text className="text-text text-sm flex-1">{item}</Text>
              </View>
            ))}
          </View>

          <View className="bg-gray-50 rounded-xl px-3 py-2 mb-5">
            <Text className="text-textMuted text-xs leading-5">
              In autonomous mode BizBot sends the link itself. In assisted mode you send it;
              the auto-mark on payment still applies.
            </Text>
          </View>

          {on ? (
            <Pressable
              onPress={toggle}
              disabled={busy}
              className={`border rounded-2xl py-3.5 items-center ${busy ? "border-gray-200" : "border-red-200 active:opacity-80"}`}
            >
              <Text className="text-red-600 text-base font-semibold">
                {busy ? "Working..." : "Turn off online payments"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={toggle}
              disabled={busy}
              className={`rounded-2xl py-3.5 items-center ${busy ? "bg-gray-300" : "bg-primary active:opacity-90"}`}
            >
              <Text className="text-white text-base font-semibold">
                {busy ? "Working..." : "Turn on online payments"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
