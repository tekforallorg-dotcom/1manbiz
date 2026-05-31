import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { getActiveBusinessId } from "../../../lib/business";
import {
  fetchConversationHeader,
  fetchMessages,
  markConversationRead,
  type ConversationHeader,
  type MessageRow,
} from "../../../lib/conversations";
import { supabase } from "../../../lib/supabase";
import { MessageBubble } from "../../../components/message-bubble";

export default function ConversationThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Not signed in"); return; }
        const businessId = await getActiveBusinessId(user.id);
        if (!businessId || !id) { setError("No business"); return; }

        const h = await fetchConversationHeader(id, businessId);
        if (cancelled) return;
        if (!h) { setError("Conversation not found"); return; }
        setHeader(h);

        const m = await fetchMessages(id);
        if (cancelled) return;
        setMessages(m);

        await markConversationRead(id, businessId);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const displayName = header?.customer_name
    ?? header?.contact_phone_e164
    ?? "Customer";
  const showSubtitle = !!(header?.contact_phone_e164 && header?.customer_name);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {/* Inline header */}
      <View className="flex-row items-center px-3 py-3 border-b border-border">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          hitSlop={8}
        >
          <ChevronLeft size={24} color={designColors.text} strokeWidth={2} />
        </Pressable>
        <View className="flex-1 ml-1">
          <Text className="text-text text-lg font-semibold" numberOfLines={1}>{displayName}</Text>
          {showSubtitle ? (
            <Text className="text-textMuted text-xs" numberOfLines={1}>{header?.contact_phone_e164}</Text>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={designColors.primary} />
        </View>
      ) : error ? (
        <View className="px-6 pt-10">
          <Text className="text-textMuted text-sm">{error}</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        >
          {messages.length === 0 ? (
            <Text className="text-textMuted text-sm text-center mt-10">No messages yet.</Text>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          <Text className="text-textMuted text-[11px] text-center mt-6">
            Replying from the mobile app ships in the next slice.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
