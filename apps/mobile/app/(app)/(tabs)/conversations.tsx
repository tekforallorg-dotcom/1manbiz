import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageCircle, Search } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { getActiveBusinessId } from "../../../lib/business";
import {
  fetchConversations,
  type ConversationListItem,
} from "../../../lib/conversations";
import { supabase } from "../../../lib/supabase";
import { ConversationRow } from "../../../components/conversation-row";
import { SummaryStrip } from "../../../components/summary-strip";

type ChannelState = "unknown" | "not_connected" | "connected";
type Filter = "all" | "unread";

export default function ConversationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [channelState, setChannelState] = useState<ChannelState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
      setBusinessId(businessId);

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

  // Live updates: any conversation change for this business refetches the list
  // silently so order and unread badges stay current without a manual refresh.
  useEffect(() => {
    if (!businessId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      // Authenticate the realtime socket before joining so RLS lets this
      // business's conversation changes through (see thread screen for detail).
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`conversations:${businessId}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `business_id=eq.${businessId}` },
          () => { fetchConversations(businessId).then(setConversations).catch(() => {}); })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [businessId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread_count > 0).length,
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && !(c.unread_count > 0)) return false;
      if (!q) return true;
      const hay = [c.customer_name, c.contact_phone_e164, c.last_message_preview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query, filter]);

  const showTools = channelState === "connected" && conversations.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-3">
        <Text className="text-text text-3xl font-bold">Chats</Text>
        <Text className="text-textMuted text-base mt-1">Customer conversations and AI replies</Text>
      </View>

      {showTools ? (
        <View className="px-6 pb-2">
          <View className="flex-row items-center bg-surface-muted rounded-2xl px-3.5 py-2.5">
            <Search size={18} color={designColors.textMuted} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search customers, phone, messages..."
              placeholderTextColor={designColors.textMuted}
              className="flex-1 text-text text-base ml-2"
              style={{ paddingVertical: 0 }}
              returnKeyType="search"
              autoCapitalize="none"
            />
          </View>

          <View className="flex-row mt-3">
            <Pressable
              onPress={() => setFilter("all")}
              className={"rounded-full px-4 py-1.5 mr-2 active:opacity-80 " + (filter === "all" ? "bg-primary" : "bg-surface-muted")}
              hitSlop={4}
            >
              <Text className={"text-sm font-medium " + (filter === "all" ? "text-white" : "text-textMuted")}>All</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter("unread")}
              className={"rounded-full px-4 py-1.5 active:opacity-80 " + (filter === "unread" ? "bg-primary" : "bg-surface-muted")}
              hitSlop={4}
            >
              <Text className={"text-sm font-medium " + (filter === "unread" ? "text-white" : "text-textMuted")}>
                {unreadCount > 0 ? "Unread " + unreadCount : "Unread"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={designColors.primary} />
        }
      >
        {conversations.length > 0 ? (
          <View className="px-6">
            <SummaryStrip
              items={[
                { label: "Chats", value: String(conversations.length), tone: "lead" },
                {
                label: "Unread",
                value: String(conversations.filter((c) => c.unread_count > 0).length),
                tone: conversations.some((c) => c.unread_count > 0) ? "warn" : "default",
              },
                { label: "Open", value: String(conversations.filter((c) => c.status === "open").length) },
              ]}
            />
          </View>
        ) : null}
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
        ) : filtered.length === 0 ? (
          <View className="px-6 pt-16 items-center">
            <Text className="text-text text-base font-medium">No matches</Text>
            <Text className="text-textMuted text-sm mt-1 text-center">
              {filter === "unread" ? "No unread chats right now." : "No chats match your search."}
            </Text>
          </View>
        ) : (
          <View className="mx-6 bg-white rounded-3xl overflow-hidden border border-borderStrong">
            {filtered.map((c, idx) => (
              <View key={c.id} className={idx === 0 ? "" : "border-t border-gray-100"}>
                <ConversationRow conversation={c} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
