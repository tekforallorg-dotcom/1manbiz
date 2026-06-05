import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Send, Sparkles, X, Minus, Plus } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { getActiveBusinessId } from "../../../lib/business";
import { parseOrderFromConversation, type OrderProposal } from "../../../lib/parse-order";
import { createOrder } from "../../../lib/order-create";
import { createCustomer } from "../../../lib/customers";
import { formatNaira } from "../../../lib/format";
import {
  fetchConversationHeader,
  fetchMessages,
  markConversationRead,
  type ConversationHeader,
  type MessageRow,
} from "../../../lib/conversations";
import { sendReply } from "../../../lib/messages";
import { fetchCustomerStats, type CustomerStats } from "../../../lib/customer-stats";
import { supabase } from "../../../lib/supabase";
import { MessageBubble } from "../../../components/message-bubble";

type DraftLine = {
  uid: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceKobo: number;
  stockQty: number;
};

let draftUidSeq = 0;
function nextDraftUid(): string {
  draftUidSeq += 1;
  return "dl" + draftUidSeq;
}

// Compact money for header pills: 1.3M, 12k, 900. Avoids Intl (Hermes-safe).
function compactNaira(kobo: number): string {
  const naira = Math.round(kobo / 100);
  if (naira >= 1000000) {
    const m = naira / 1000000;
    return "₦" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
  }
  if (naira >= 1000) {
    const k = naira / 1000;
    return "₦" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return "₦" + String(naira);
}

export default function ConversationThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // AI order-draft sheet (3H.3)
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [creating, setCreating] = useState(false);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Not signed in"); return; }
        const bizId = await getActiveBusinessId(user.id);
        if (!bizId || !id) { setError("No business"); return; }
        if (!cancelled) setBusinessId(bizId);

        const h = await fetchConversationHeader(id, bizId);
        if (cancelled) return;
        if (!h) { setError("Conversation not found"); return; }
        setHeader(h);

        const m = await fetchMessages(id);
        if (cancelled) return;
        setMessages(m);

        await markConversationRead(id, bizId);
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

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const m = await fetchMessages(id);
      setMessages(m);
    } catch {
      // Keep the current list on a refresh error; surfaced errors live on load.
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    const cid = header?.customer_id ?? null;
    if (!cid) { setCustomerStats(null); return; }
    let cancelled = false;
    (async () => {
      const stats = await fetchCustomerStats(cid);
      if (!cancelled) setCustomerStats(stats);
    })();
    return () => { cancelled = true; };
  }, [header?.customer_id]);

  // Scroll to bottom when message list changes.
  useEffect(() => {
    if (messages.length > 0) {
      // Defer to next tick so layout settles first.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Keep the composer snug to the keyboard when open, and clear of the home
  // indicator when closed. A static safe-area inset alone would float the
  // input above the keyboard, so we drop to a small base while it is shown.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Live updates: stream inbound messages + outbound status changes for this
  // conversation. Dedupe by id so our optimistic send (already swapped for the
  // server row) is not appended twice when its INSERT event arrives.
  useEffect(() => {
    if (!id) return;
    const mapRow = (r: Record<string, unknown>): MessageRow => ({
      id: r.id as string,
      direction: r.direction as MessageRow["direction"],
      sender_role: r.sender_role as MessageRow["sender_role"],
      body_text: (r.body_text as string | null) ?? null,
      media_url: (r.media_url as string | null) ?? null,
      media_type: (r.media_type as string | null) ?? null,
      sent_at: r.sent_at as string,
      meta_status: (r.meta_status as string | null) ?? null,
    });
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      // RLS-gated postgres_changes only reach an authenticated socket. On RN the
      // realtime socket can join as anon before the persisted session attaches,
      // so its subscription bindings are created unauthenticated and every event
      // is dropped. Set the user token BEFORE subscribe so the join is authed.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`messages:${id}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          (payload) => {
            const row = mapRow(payload.new as Record<string, unknown>);
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          })
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          (payload) => {
            const row = mapRow(payload.new as Record<string, unknown>);
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [id]);

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

  async function openDraft() {
    if (!id) return;
    setSheetOpen(true);
    setDrafting(true);
    setDraftError(null);
    setLines([]);
    const result = await parseOrderFromConversation(id);
    setDrafting(false);
    if (!result.ok) {
      setDraftError(result.error);
      return;
    }
    setLines(
      result.proposal.lineItems.map((li) => ({
        uid: nextDraftUid(),
        productId: li.productId,
        name: li.name,
        qty: li.qty,
        unitPriceKobo: li.unitPriceKobo,
        stockQty: li.stockQty,
      })),
    );
  }

  function setLineQty(uid: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, qty: Math.min(999, Math.max(1, qty)) } : l)),
    );
  }

  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  const draftSubtotalKobo = lines.reduce((sum, l) => sum + l.unitPriceKobo * l.qty, 0);

  async function createFromDraft() {
    if (!id || !businessId || lines.length === 0 || creating) return;
    setCreating(true);
    setDraftError(null);

    let customerId = header?.customer_id ?? null;
    if (!customerId) {
      const phone = (header?.contact_phone_e164 ?? "").trim();
      if (!phone) {
        setDraftError("This chat has no linked customer yet. Reopen it to link the contact, then retry.");
        setCreating(false);
        return;
      }
      const made = await createCustomer(businessId, header?.customer_name ?? phone, phone);
      if (made.error || !made.customer) {
        setDraftError(made.error ?? "Could not link a customer.");
        setCreating(false);
        return;
      }
      customerId = made.customer.id;
    }

    const result = await createOrder({
      businessId,
      customerId,
      source: "whatsapp_ai",
      items: lines.map((l) => ({
        product_id: l.productId,
        name: l.name,
        price_kobo: l.unitPriceKobo,
        quantity: l.qty,
      })),
    });

    if (result.error && !result.id) {
      setDraftError(result.error);
      setCreating(false);
      return;
    }

    setCreating(false);
    setSheetOpen(false);
    router.push(`/orders/${result.id}`);
  }

  const displayName = header?.customer_name
    ?? header?.contact_phone_e164
    ?? "Customer";
  const showSubtitle = !!(header?.contact_phone_e164 && header?.customer_name);
  const avatarInitial = (displayName.trim()[0] ?? "?").toUpperCase();

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
          <View className="w-9 h-9 rounded-full bg-surface-muted items-center justify-center ml-1 mr-2.5">
            <Text className="text-text text-base font-semibold">{avatarInitial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-text text-lg font-semibold" numberOfLines={1}>{displayName}</Text>
            {showSubtitle ? (
              <Text className="text-textMuted text-xs" numberOfLines={1}>{header?.contact_phone_e164} · WhatsApp</Text>
            ) : null}
          </View>
          {!loading && !error ? (
            <Pressable
              onPress={openDraft}
              className="flex-row items-center bg-primary rounded-full px-3 py-1.5 active:opacity-80"
              hitSlop={6}
            >
              <Sparkles size={14} color="#FFFFFF" strokeWidth={2} />
              <Text className="text-white text-sm font-semibold ml-1">Draft</Text>
            </Pressable>
          ) : null}
        </View>

        {!loading && !error && header?.customer_id && customerStats ? (
          <View className="flex-row items-center flex-wrap px-4 pt-2.5 pb-0.5">
            <View className="bg-surface-muted rounded-full px-3 py-1.5 mr-2 mb-1">
              <Text className="text-textMuted text-xs font-medium">{compactNaira(customerStats.totalSpentKobo)} spent</Text>
            </View>
            <View className="bg-surface-muted rounded-full px-3 py-1.5 mr-2 mb-1">
              <Text className="text-textMuted text-xs font-medium">
                {customerStats.totalOrders === 1 ? "1 order" : `${customerStats.totalOrders} orders`}
              </Text>
            </View>
            {customerStats.openOrders > 0 && customerStats.openOrderId ? (
              <Pressable
                onPress={() => router.push(`/orders/${customerStats.openOrderId}`)}
                className="flex-row items-center bg-green-50 rounded-full pl-3 pr-2 py-1.5 mb-1 active:opacity-70"
                hitSlop={6}
              >
                <Text className="text-green-700 text-xs font-semibold">
                  {customerStats.openOrders === 1 ? "1 open order" : `${customerStats.openOrders} open orders`}
                </Text>
                <ChevronRight size={13} color="#15803D" strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={designColors.primary}
              />
            }
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
          <View
            className="px-3 pt-2 border-t border-border bg-background"
            style={{ paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }}
          >
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

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="bg-background rounded-t-3xl px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: "85%" }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-text text-lg font-semibold">Draft order from chat</Text>
              <Pressable
                onPress={() => setSheetOpen(false)}
                className="w-9 h-9 items-center justify-center rounded-full active:opacity-60"
                hitSlop={6}
              >
                <X size={20} color={designColors.text} strokeWidth={2} />
              </Pressable>
            </View>
            <Text className="text-textMuted text-sm mb-3">
              AI reads this chat and suggests an order. Review and edit before you create it.
            </Text>

            {drafting ? (
              <View className="items-center py-10">
                <ActivityIndicator color={designColors.primary} />
                <Text className="text-textMuted text-sm mt-3">Reading the chat...</Text>
              </View>
            ) : draftError ? (
              <Text className="text-danger text-sm py-4">{draftError}</Text>
            ) : lines.length === 0 ? (
              <Text className="text-textMuted text-sm py-6 text-center">
                No orderable items found in this chat yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 8 }}>
                {lines.map((l) => (
                  <View
                    key={l.uid}
                    className="flex-row items-center bg-surface-muted rounded-2xl px-3 py-3 mb-2"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-text text-base" numberOfLines={1}>{l.name}</Text>
                      <Text className="text-textMuted text-xs">{formatNaira(l.unitPriceKobo)} each</Text>
                      {l.qty > l.stockQty ? (
                        <Text className="text-warn text-xs mt-0.5">
                          {l.stockQty === 0
                            ? "Out of stock"
                            : `Only ${l.stockQty} in stock`}
                        </Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center bg-gray-100 rounded-full px-1 py-1 mr-2">
                      <Pressable
                        onPress={() => setLineQty(l.uid, l.qty - 1)}
                        disabled={l.qty <= 1}
                        className="w-7 h-7 items-center justify-center active:opacity-50"
                        style={{ opacity: l.qty <= 1 ? 0.35 : 1 }}
                        hitSlop={4}
                      >
                        <Minus size={15} color={designColors.text} />
                      </Pressable>
                      <Text className="text-text text-base font-semibold w-7 text-center">{l.qty}</Text>
                      <Pressable
                        onPress={() => setLineQty(l.uid, l.qty + 1)}
                        className="w-7 h-7 items-center justify-center active:opacity-50"
                        hitSlop={4}
                      >
                        <Plus size={15} color={designColors.text} />
                      </Pressable>
                    </View>
                    <Text className="text-text text-sm font-medium w-24 text-right">
                      {formatNaira(l.unitPriceKobo * l.qty)}
                    </Text>
                    <Pressable
                      onPress={() => removeLine(l.uid)}
                      className="w-8 h-8 items-center justify-center ml-1 active:opacity-50"
                      hitSlop={4}
                    >
                      <X size={16} color={designColors.textMuted} strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {!drafting && lines.length > 0 ? (
              <>
                <View className="flex-row items-center justify-between border-t border-border pt-3 mt-1">
                  <Text className="text-text text-base font-semibold">Subtotal</Text>
                  <Text className="text-text text-base font-semibold">{formatNaira(draftSubtotalKobo)}</Text>
                </View>
                <Pressable
                  onPress={createFromDraft}
                  disabled={creating}
                  className={"rounded-full items-center justify-center py-3.5 mt-3 " + (creating ? "bg-borderStrong" : "bg-text")}
                >
                  <Text className="text-white text-base font-semibold">
                    {creating ? "Creating..." : "Create order"}
                  </Text>
                </Pressable>
                <Text className="text-textMuted text-xs text-center mt-2">
                  Creates a pending (unpaid) order. Prices come from your catalog.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
