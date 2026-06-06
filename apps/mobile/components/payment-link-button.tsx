import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Share } from "react-native";
import { useRouter, type Href } from "expo-router";
import { MessageCircle, ArrowRight, Share2 } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { supabase } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { initPaymentLink } from "../lib/payments";
import { sendReply } from "../lib/messages";

type Props = {
  orderId: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotalKobo: number;
};

// Resolve the customer's WhatsApp thread by phone. RLS scopes conversations to
// the signed-in owner's business, so no explicit business_id filter is needed.
async function resolveConversationId(phoneE164: string): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_phone_e164", phoneE164)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data as { id: string }).id : null;
}

export function PaymentLinkButton({ orderId, customerName, customerPhone, subtotalKobo }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [sentConversationId, setSentConversationId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const buildMessage = (url: string) => {
    const who = customerName ? "Hi " + customerName + ", " : "Hi, ";
    return who + "here is your secure payment link for " + formatNaira(subtotalKobo) + ": " + url;
  };

  // Create the link once, then try to auto-send into the customer's live
  // WhatsApp chat. If there is no chat or the 24h window has closed we do not
  // dead-end: keep the link so the vendor can share it through any channel.
  const onSend = async () => {
    setProblem(null);
    setNote(null);
    setLoading(true);

    const init = await initPaymentLink(orderId);
    if (!init.ok) {
      setLoading(false);
      setProblem(init.error);
      return;
    }
    setPayUrl(init.payUrl);

    const phone = (customerPhone ?? "").trim();
    const conversationId = phone ? await resolveConversationId(phone) : null;

    if (conversationId) {
      const result = await sendReply(conversationId, buildMessage(init.payUrl));
      if (result.ok) {
        setLoading(false);
        setSentConversationId(conversationId);
        return;
      }
      setNote(
        "Could not auto-send to WhatsApp (" + result.error +
          "). If the customer has not messaged in 24h, WhatsApp needs an approved template. Share the link below instead.",
      );
    } else {
      setNote(
        phone
          ? "No live WhatsApp chat with this customer, so I could not auto-send. Share the link below."
          : "This customer has no phone on file. Share the link below.",
      );
    }
    setLoading(false);
  };

  const onShare = async (url: string) => {
    try {
      await Share.share({ message: buildMessage(url) });
    } catch {
      // Sheet dismissed or unavailable; nothing to do.
    }
  };

  // WhatsApp auto-send succeeded.
  if (sentConversationId) {
    return (
      <View style={{ gap: 8 }}>
        <View className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex-row items-center">
          <MessageCircle size={18} color="#15803D" />
          <Text className="text-green-700 text-sm font-medium ml-2">Payment link sent in chat</Text>
        </View>
        <Pressable
          onPress={() => router.push(("/conversations/" + sentConversationId) as Href)}
          className="bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
        >
          <Text className="text-text text-base font-semibold mr-2">View conversation</Text>
          <ArrowRight size={18} color={designColors.text} />
        </Pressable>
      </View>
    );
  }

  // Link created but not auto-sent: show it and let the vendor share it anywhere.
  if (payUrl) {
    return (
      <View style={{ gap: 8 }}>
        {note ? <Text className="text-textMuted text-sm px-1">{note}</Text> : null}
        <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
          <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Payment link</Text>
          <Text className="text-text text-sm" numberOfLines={2}>{payUrl}</Text>
        </View>
        <Pressable
          onPress={() => onShare(payUrl)}
          className="bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
        >
          <Share2 size={18} color="#FFFFFF" />
          <Text className="text-white text-base font-semibold ml-2">Share payment link</Text>
        </Pressable>
      </View>
    );
  }

  // Initial state.
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={onSend}
        disabled={loading}
        className="bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
      >
        {loading ? (
          <ActivityIndicator color={designColors.primary} />
        ) : (
          <>
            <MessageCircle size={18} color={designColors.primary} />
            <Text className="text-primary text-base font-semibold ml-2">Send payment link</Text>
          </>
        )}
      </Pressable>
      {problem ? <Text className="text-textMuted text-sm px-1">{problem}</Text> : null}
    </View>
  );
}
