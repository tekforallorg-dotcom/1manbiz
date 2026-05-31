import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Send } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { getActiveBusinessId } from "../../../lib/business";
import {
  fetchConversationHeader,
  fetchMessages,
  markConversationRead,
  type ConversationHeader,
  type MessageRow,
} from "../../../lib/conversations";
import { sendReply } from "../../../lib/messages";
import { supabase } from "../../../lib/supabase";
import { MessageBubble } from "../../../components/message-bubble";

export default function ConversationThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

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
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Scroll to bottom when message list changes.
  useEffect(() => {
    if (messages.length > 0) {
      // Defer to next tick so layout settles first.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const canSend = draft.trim().length > 0 && !sending && !!id;

  async function handleSend() {
    if (!canSend || !id) return;
    const text = draft.trim();
    const tempId = "temp-" + Date.now();
    const tempMessage: MessageRow = {
      id: tempId,
      direction: "out",
      sender_role: "vendor",
      body_text: text,
      media_url: null,
      media_type: null,
      sent_at: new Date().toISOString(),
      meta_status: "sending",
    };

    setMessages((prev) => [...prev, tempMessage]);
    setDraft("");
    setSending(true);

    const result = await sendReply(id, text);

    if (!result.ok) {
      // Roll back optimistic bubble and restore draft.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      Alert.alert("Send failed", result.error);
      setSending(false);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === tempId ? result.message : m)));
    setSending(false);
  }

  const displayName = header?.customer_name
    ?? header?.contact_phone_e164
    ?? "Customer";
  const showSubtitle = !!(header?.contact_phone_e164 && header?.customer_name);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
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
            ref={scrollRef}
            className="flex-1 px-4"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 12 }}
          >
            {messages.length === 0 ? (
              <Text className="text-textMuted text-sm text-center mt-10">No messages yet.</Text>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
          </ScrollView>
        )}

        {/* Reply composer */}
        {!loading && !error ? (
          <View className="px-3 py-2 border-t border-border bg-background">
            <View className="flex-row items-end">
              <View className="flex-1 bg-surface-muted rounded-2xl px-3.5 py-2 mr-2">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type a reply..."
                  placeholderTextColor={designColors.textMuted}
                  multiline
                  className="text-text text-base"
                  style={{ maxHeight: 100, minHeight: 24 }}
                  editable={!sending}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={"w-10 h-10 rounded-full items-center justify-center " + (canSend ? "bg-primary" : "bg-borderStrong")}
                hitSlop={4}
              >
                <Send size={18} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
