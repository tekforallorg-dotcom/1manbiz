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
import {
  getPaymentConnectors,
  getInflowByProvider,
  getOnlinePaymentsState,
  paymentHealth,
  ONLINE_ON_HEALTH,
  PAYMENT_PROVIDERS,
  type PaymentConnectorRow,
  type ProviderInflow,
  type ProviderMeta,
} from "../../../lib/payment-connectors";
import { formatNaira } from "../../../lib/format";
import { ConnectorCard } from "../../../components/connector-card";
import { WhatsappManageSheet } from "../../../components/whatsapp-manage-sheet";
import { PaymentConnectSheet } from "../../../components/payment-connect-sheet";
import { ProviderLogo } from "../../../components/provider-logo";
import { PaystackConnectSheet } from "../../../components/paystack-connect-sheet";

function SectionHeading({ children }: { children: string }) {
  return (
    <Text className="text-textMuted text-xs font-bold tracking-wide uppercase mb-2 mt-1">
      {children}
    </Text>
  );
}

function CardSkeleton() {
  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
      <View className="flex-row items-center">
        <View className="w-11 h-11 rounded-xl bg-gray-100 mr-3" />
        <View className="flex-1">
          <View className="h-4 w-28 bg-gray-100 rounded" />
          <View className="h-3 w-44 bg-gray-100 rounded mt-2" />
        </View>
      </View>
    </View>
  );
}

export default function ConnectorsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ChannelConnector[] | null>(null);
  const [payments, setPayments] = useState<PaymentConnectorRow[] | null>(null);
  const [inflow, setInflow] = useState<Record<string, ProviderInflow> | null>(null);
  const [onlineOn, setOnlineOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setConnectors([]);
      setPayments([]);
      setInflow({});
      setOnlineOn(false);
      return;
    }
    const bid = await getActiveBusinessId(userId);
    setBusinessId(bid);
    if (!bid) {
      setConnectors([]);
      setPayments([]);
      setInflow({});
      setOnlineOn(false);
      return;
    }
    const [chans, pays, inf, online] = await Promise.all([
      getChannelConnectors(bid),
      getPaymentConnectors(bid),
      getInflowByProvider(bid),
      getOnlinePaymentsState(bid),
    ]);
    setConnectors(chans);
    setPayments(pays);
    setInflow(inf);
    setOnlineOn(online);
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
  const whatsappHealth = whatsapp ? connectorHealth(whatsapp) : null;
  const verified = whatsapp ? relativeShort(whatsapp.lastVerifiedAt) : null;
  const selectedRow =
    selectedProvider
      ? (payments ?? []).find((r) => r.provider === selectedProvider.provider) ?? null
      : null;

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
        {loading && connectors === null ? (
          <CardSkeleton />
        ) : (
          <ConnectorCard
            name="WhatsApp"
            description="Receive customer chats and let BizBot reply"
            icon={MessageCircle}
            health={whatsappHealth}
            detail={whatsapp?.displayNumber ?? null}
            metaLine={verified ? `Verified ${verified}` : null}
            errorText={whatsapp?.lastError ?? null}
            onPress={whatsapp ? () => setManageOpen(true) : undefined}
          />
        )}

        <View className="mt-4">
          <SectionHeading>Money</SectionHeading>
          {loading && payments === null ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            PAYMENT_PROVIDERS.map((p) => {
              const row = (payments ?? []).find((r) => r.provider === p.provider) ?? null;
              const inflowRow = inflow?.[p.provider];
              const collected =
                inflowRow && inflowRow.totalKobo > 0
                  ? `${formatNaira(inflowRow.totalKobo)} collected`
                  : null;
              const isOnline = p.kind === "online";
              const health = isOnline
                ? onlineOn
                  ? ONLINE_ON_HEALTH
                  : null
                : paymentHealth(row);
              const detail = isOnline
                ? onlineOn
                  ? "Card and transfer via link"
                  : null
                : row?.displayLabel ?? null;
              const metaLine = collected ?? (isOnline ? null : row ? "Manual" : null);
              return (
                <ConnectorCard
                  key={p.provider}
                  name={p.name}
                  description={p.blurb}
                  logo={<ProviderLogo domain={p.domain} name={p.name} />}
                  health={health}
                  detail={detail}
                  metaLine={metaLine}
                  onPress={() => setSelectedProvider(p)}
                />
              );
            })
          )}
          <Text className="text-textMuted text-xs mt-1 leading-5">
            Connected rails feed your Money ledger and let BizBot mark customer payments
            as paid in auto mode.
          </Text>
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

      {selectedProvider && businessId ? (
        selectedProvider.kind === "online" ? (
          <PaystackConnectSheet
            businessId={businessId}
            visible={!!selectedProvider}
            onClose={() => setSelectedProvider(null)}
            onChanged={() => {
              void load();
            }}
          />
        ) : (
          <PaymentConnectSheet
            businessId={businessId}
            provider={selectedProvider}
            existing={selectedRow}
            visible={!!selectedProvider}
            onClose={() => setSelectedProvider(null)}
            onChanged={() => {
              void load();
            }}
          />
        )
      ) : null}
    </SafeAreaView>
  );
}
