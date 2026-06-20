import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { useNotifier } from "./notifier";
import {
  connectorHealth,
  relativeShort,
  setChannelConnection,
  type ChannelConnector,
} from "../lib/connectors";

interface Props {
  connector: ChannelConnector;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void; // refresh the list after a status change
}

const ENABLES = [
  "Receive customer chats in your inbox",
  "BizBot replies or drafts for you",
  "Detect orders and bookings from chat",
  "Send receipts on WhatsApp",
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
      <Text className="text-textMuted text-sm">{label}</Text>
      <Text className="text-text text-sm font-medium" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function WhatsappManageSheet({ connector, visible, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { notify, confirm } = useNotifier();

  const health = connectorHealth(connector);
  const verified = relativeShort(connector.lastVerifiedAt);
  const since = relativeShort(connector.createdAt);
  const isConnected = health.state === "connected";
  const isSoftOff = health.state === "disconnected";

  const handleDisconnect = () => {
    onClose();
    confirm({
      title: "Disconnect WhatsApp?",
      message:
        "BizBot will stop replying on WhatsApp until you reconnect. Your conversations are kept.",
      confirmLabel: "Disconnect",
      destructive: true,
      onConfirm: async () => {
        const res = await setChannelConnection(connector.id, false);
        if (res.error) {
          notify({ type: "error", title: "Could not disconnect", message: res.error });
          return;
        }
        notify({
          type: "success",
          title: "WhatsApp disconnected",
          message: "BizBot has stopped replying on WhatsApp.",
        });
        onChanged();
      },
    });
  };

  const handleReconnect = async () => {
    const res = await setChannelConnection(connector.id, true);
    if (res.error) {
      notify({ type: "error", title: "Could not reconnect", message: res.error });
      return;
    }
    notify({
      type: "success",
      title: "WhatsApp reconnected",
      message: "BizBot will reply on WhatsApp again.",
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
          className="bg-white rounded-t-3xl border border-gray-200"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="px-5 pt-5 pb-3 flex-row items-center justify-between">
            <Text className="text-text text-xl font-bold">WhatsApp</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="w-8 h-8 items-center justify-center active:opacity-60"
            >
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            style={{ maxHeight: 440 }}
            showsVerticalScrollIndicator={false}
          >
            {connector.lastError ? (
              <View className="bg-red-50 rounded-xl px-3 py-2 mb-3">
                <Text className="text-red-700 text-sm">{connector.lastError}</Text>
              </View>
            ) : null}

            <View className="mb-2">
              {connector.displayNumber ? (
                <Row label="Number" value={connector.displayNumber} />
              ) : null}
              <Row label="Status" value={health.label} />
              {since ? <Row label="Connected" value={`${since}`} /> : null}
              {verified ? <Row label="Last verified" value={verified} /> : null}
              <Row
                label="Token"
                value={connector.tokenType === "permanent" ? "Permanent" : "Temporary"}
              />
            </View>

            <Text className="text-textMuted text-xs font-bold tracking-wide uppercase mt-3 mb-2">
              What this enables
            </Text>
            <View className="mb-1">
              {ENABLES.map((item) => (
                <View key={item} className="flex-row items-center py-1">
                  <View className="w-5 h-5 rounded-full bg-green-50 items-center justify-center mr-2">
                    <Check size={13} color={colors.primary} />
                  </View>
                  <Text className="text-text text-sm flex-1">{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="px-5 pt-4">
            {isConnected ? (
              <Pressable
                onPress={handleDisconnect}
                className="border border-red-200 rounded-2xl py-3.5 items-center active:opacity-80"
              >
                <Text className="text-red-600 text-base font-semibold">Disconnect</Text>
              </Pressable>
            ) : isSoftOff ? (
              <Pressable
                onPress={handleReconnect}
                className="bg-primary rounded-2xl py-3.5 items-center active:opacity-90"
              >
                <Text className="text-white text-base font-semibold">Reconnect</Text>
              </Pressable>
            ) : (
              <View className="bg-amber-50 rounded-2xl px-4 py-3">
                <Text className="text-amber-700 text-sm">
                  This connection needs to be set up again from the web dashboard before BizBot
                  can use it.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
