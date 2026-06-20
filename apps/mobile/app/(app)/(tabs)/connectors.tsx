import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { MessageCircle } from "lucide-react-native";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import {
  getChannelConnectors,
  connectorHealth,
  relativeShort,
  type ChannelConnector,
} from "../../../lib/connectors";
import { ConnectorCard } from "../../../components/connector-card";
import { WhatsappManageSheet } from "../../../components/whatsapp-manage-sheet";

function SectionHeading({ children }: { children: string }) {
  return (
    <Text className="text-textMuted text-xs font-bold tracking-wide uppercase mb-2 mt-1">
      {children}
    </Text>
  );
}

export default function ConnectorsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [connectors, setConnectors] = useState<ChannelConnector[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setConnectors([]);
      return;
    }
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) {
      setConnectors([]);
      return;
    }
    setConnectors(await getChannelConnectors(businessId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[connectors] load error:", err))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const whatsapp = (connectors ?? []).find((c) => c.channel === "whatsapp") ?? null;
  const health = whatsapp ? connectorHealth(whatsapp) : null;
  const verified = whatsapp ? relativeShort(whatsapp.lastVerifiedAt) : null;
  const initialLoading = loading && connectors === null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Connectors</Text>
        <Text className="text-textMuted text-base mt-1">
          The tools that bring your business into 1Man.Biz
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <SectionHeading>Channels</SectionHeading>

        {initialLoading ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-xl bg-gray-100 mr-3" />
              <View className="flex-1">
                <View className="h-4 w-28 bg-gray-100 rounded" />
                <View className="h-3 w-44 bg-gray-100 rounded mt-2" />
              </View>
            </View>
          </View>
        ) : (
          <ConnectorCard
            name="WhatsApp"
            description="Receive customer chats and let BizBot reply"
            icon={MessageCircle}
            health={health}
            detail={whatsapp?.displayNumber ?? null}
            metaLine={verified ? `Verified ${verified}` : null}
            errorText={whatsapp?.lastError ?? null}
            onPress={whatsapp ? () => setManageOpen(true) : undefined}
          />
        )}

        <View className="mt-4">
          <SectionHeading>Money</SectionHeading>
          <View className="bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-text text-base font-bold">Payment rails are coming</Text>
            <Text className="text-textMuted text-sm mt-1">
              Paystack, OPay, Moniepoint, Kuda and Flutterwave land here next. They
              feed your Money ledger and let BizBot mark customer payments as paid in
              auto mode.
            </Text>
          </View>
        </View>
      </ScrollView>

      {whatsapp ? (
        <WhatsappManageSheet
          connector={whatsapp}
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
          onChanged={() => {
            void load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
