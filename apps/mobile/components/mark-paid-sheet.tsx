import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banknote, Landmark, MoreHorizontal, X } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { ProviderLogo } from "./provider-logo";
import { supabase } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { getActiveBusinessId } from "../lib/business";
import {
  getPaymentConnectors,
  getOnlinePaymentsState,
  paymentHealth,
  PAYMENT_PROVIDERS,
} from "../lib/payment-connectors";

interface RailOption {
  provider: string;
  name: string;
  domain: string | null;
}

interface Props {
  visible: boolean;
  customerName: string | null;
  amountKobo: number;
  pending?: boolean;
  onPick: (provider: string | null) => void;
  onClose: () => void;
}

export function MarkPaidSheet({
  visible,
  customerName,
  amountKobo,
  pending,
  onPick,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const bid = await getActiveBusinessId(user.id);
        if (!bid || !alive) return;
        const [rows, onlineOn] = await Promise.all([
          getPaymentConnectors(bid),
          getOnlinePaymentsState(bid),
        ]);
        if (!alive) return;
        // "Active" mirrors the Connectors screen exactly: a manual connector
        // counts when paymentHealth says connected (status manual/connected),
        // and Paystack counts when online payments are on -- the same flag the
        // Paystack card reads, since its connector row can lag behind the flag.
        const set = new Set<string>();
        for (const r of rows) {
          if (paymentHealth(r)?.state === "connected") set.add(r.provider);
        }
        if (onlineOn) set.add("paystack");
        setConnected(set);
      } catch {
        // best-effort: drives which connected rails appear
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  // Every connector the vendor has active -- including the online rail (Paystack)
  // when auto-collect is on -- then the universal manual methods every vendor can
  // receive. The bank connector folds into "Bank transfer" to avoid a duplicate.
  const connectedRails: RailOption[] = PAYMENT_PROVIDERS.filter(
    (p) => p.provider !== "bank" && connected.has(p.provider),
  ).map((p) => ({ provider: p.provider, name: p.name, domain: p.domain }));
  const options: RailOption[] = [
    ...connectedRails,
    { provider: "bank", name: "Bank transfer", domain: null },
    { provider: "cash", name: "Cash", domain: null },
  ];

  const renderIcon = (o: RailOption): ReactNode => {
    if (o.domain) return <ProviderLogo domain={o.domain} name={o.name} />;
    if (o.provider === "cash") return iconChip(<Banknote size={18} color={colors.primary} />);
    if (o.provider === "bank") return iconChip(<Landmark size={18} color={colors.primary} />);
    return iconChip(<MoreHorizontal size={18} color={colors.textMuted} />);
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
            <Text className="text-text text-xl font-bold">Mark as paid</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="w-8 h-8 items-center justify-center active:opacity-60"
            >
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text className="text-textMuted text-sm mb-4">
            {"How did " + (customerName ?? "the customer") + " pay " + formatNaira(amountKobo) + "?"}
          </Text>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => (
              <Pressable
                key={o.provider}
                onPress={() => onPick(o.provider)}
                disabled={pending}
                style={styles.row}
                className={pending ? "opacity-50" : "active:opacity-70"}
              >
                {renderIcon(o)}
                <Text className="text-text text-base font-medium flex-1 ml-3">{o.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => onPick(null)}
            disabled={pending}
            className={`mt-2 py-3 items-center ${pending ? "opacity-50" : "active:opacity-60"}`}
          >
            <Text className="text-textMuted text-sm font-medium">Skip, just mark paid</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function iconChip(icon: ReactNode): ReactNode {
  return (
    <View className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 items-center justify-center">
      {icon}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
});
