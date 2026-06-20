import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { useNotifier } from "./notifier";
import {
  connectPaymentManual,
  disconnectPayment,
  type PaymentConnectorRow,
  type ProviderMeta,
} from "../lib/payment-connectors";

interface Props {
  businessId: string;
  provider: ProviderMeta;
  existing: PaymentConnectorRow | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function PaymentConnectSheet({
  businessId,
  provider,
  existing,
  visible,
  onClose,
  onChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const { notify, confirm } = useNotifier();

  const [label, setLabel] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the form to the current row each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setLabel(existing?.displayLabel ?? "");
      setAccountRef(existing?.accountRef ?? "");
      setSaving(false);
    }
  }, [visible, existing]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const res = await connectPaymentManual(businessId, provider.provider, label, accountRef);
    setSaving(false);
    if (res.error) {
      notify({ type: "error", title: "Could not save", message: res.error });
      return;
    }
    notify({
      type: "success",
      title: existing ? `${provider.name} updated` : `${provider.name} connected`,
      message: "Payments to this rail can now be tagged in your Money ledger.",
    });
    onClose();
    onChanged();
  };

  const handleDisconnect = () => {
    if (!existing) return;
    onClose();
    confirm({
      title: `Remove ${provider.name}?`,
      message: "This stops tagging payments to this rail. Recorded payments are kept.",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        const res = await disconnectPayment(existing.id);
        if (res.error) {
          notify({ type: "error", title: "Could not remove", message: res.error });
          return;
        }
        notify({ type: "success", title: `${provider.name} removed`, message: "Rail disconnected." });
        onChanged();
      },
    });
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="absolute left-0 right-0 bottom-0"
      >
        <View
          className="bg-white rounded-t-3xl border border-gray-200 px-5 pt-5"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-text text-xl font-bold">{provider.name}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="w-8 h-8 items-center justify-center active:opacity-60"
            >
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text className="text-textMuted text-sm mb-4">{provider.blurb}</Text>

          <Text className="text-text text-sm font-semibold mb-1.5">Account name or label</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Ada Stores OPay"
            placeholderTextColor={colors.textMuted}
            className="border border-gray-200 rounded-xl px-3.5 py-3 text-text text-base mb-4"
          />

          <Text className="text-text text-sm font-semibold mb-1.5">Account number (optional)</Text>
          <TextInput
            value={accountRef}
            onChangeText={setAccountRef}
            placeholder="e.g. 8012345678"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            className="border border-gray-200 rounded-xl px-3.5 py-3 text-text text-base mb-5"
          />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`rounded-2xl py-3.5 items-center ${saving ? "bg-gray-300" : "bg-primary active:opacity-90"}`}
          >
            <Text className="text-white text-base font-semibold">
              {saving ? "Saving..." : existing ? "Save changes" : "Connect"}
            </Text>
          </Pressable>

          {existing ? (
            <Pressable
              onPress={handleDisconnect}
              className="py-3 items-center mt-1 active:opacity-70"
            >
              <Text className="text-red-600 text-sm font-semibold">Remove {provider.name}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
