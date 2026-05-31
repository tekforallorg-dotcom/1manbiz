import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageCircle } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { getActiveBusinessId } from "../../../lib/business";
import {
  fetchConversations,
  type ConversationListItem,
} from "../../../lib/conversations";
import { supabase } from "../../../lib/supabase";
import { ConversationRow } from "../../../components/conversation-row";

type ChannelState = "unknown" | "not_connected" | "connected";

export default function ConversationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [channelState, setChannelState] = useState<ChannelState>("unknown");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const businessId = await getActiveBusinessId(user.id);
      if (!businessId) {
        setError("No business yet");
        return;
      }

      const { data: channel } = await supabase
        .from("channel_accounts")
        .select("status")
        .eq("business_id", businessId)
        .eq("channel", "whatsapp")
        .neq("status", "disconnected")
        .maybeSingle();

      if (channel?.status === "connected") {
        setChannelState("connected");
        const list = await fetchConversations(businessId);
        setConversations(list);
      } else {
        setChannelState("not_connected");
        setConversations([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-4">
        <Text className="text-text text-3xl font-bold">Conversations</Text>
        <Text className="text-textMuted text-base mt-1">Inbound chats across channels</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={designColors.primary}
          />
        }
      >
        {loading && !refreshing ? (
          <View className="pt-16 items-center">
            <ActivityIndicator color={designColors.primary} />
          </View>
        ) : error ? (
          <View className="px-6 pt-16">
            <Text className="text-textMuted text-sm">{error}</Text>
          </View>
        ) : channelState === "not_connected" ? (
          <View className="px-6 pt-16 items-center">
            <View className="w-16 h-16 bg-primarySoft rounded-2xl items-center justify-center">
              <MessageCircle size={28} color={designColors.primary} strokeWidth={1.75} />
            </View>
            <Text className="text-text text-xl font-semibold mt-6 text-center">WhatsApp not connected</Text>
            <Text className="text-textMuted text-sm mt-2 text-center max-w-xs">
              Open the web dashboard at 1manbiz.vercel.app to connect your WhatsApp Business number.
            </Text>
          </View>
        ) : conversations.length === 0 ? (
          <View className="px-6 pt-16 items-center">
            <View className="w-16 h-16 bg-primarySoft rounded-2xl items-center justify-center">
              <MessageCircle size={28} color={designColors.primary} strokeWidth={1.75} />
            </View>
            <Text className="text-text text-xl font-semibold mt-6 text-center">Waiting for messages</Text>
            <Text className="text-textMuted text-sm mt-2 text-center max-w-xs">
              Send a test message to your WhatsApp number to see it appear here.
            </Text>
          </View>
        ) : (
          <View>
            {conversations.map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
