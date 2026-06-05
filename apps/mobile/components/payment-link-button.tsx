import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";
import { MessageCircle, ArrowRight } from "lucide-react-native";
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
  const [sentConversationId, setSentConversationId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const buildMessage = (url: string) => {
    const who = customerName ? "Hi " + customerName + ", " : "Hi, ";
    return who + "here is your secure payment link for " + formatNaira(subtotalKobo) + ": " + url;
  };

  const onSend = async () => {
    setProblem(null);
    setLoading(true);

    const phone = (customerPhone ?? "").trim();
    if (!phone) {
      setLoading(false);
      setProblem("This customer has no phone on file, so there is no WhatsApp chat to send into.");
      return;
    }

    const conversationId = await resolveConversationId(phone);
    if (!conversationId) {
      setLoading(false);
      setProblem("No WhatsApp chat with this customer yet. The link can only be sent as a reply to a live chat.");
      return;
    }

    const init = await initPaymentLink(orderId);
    if (!init.ok) {
      setLoading(false);
      setProblem(init.error);
      return;
    }

    const result = await sendReply(conversationId, buildMessage(init.payUrl));
    setLoading(false);
    if (!result.ok) {
      setProblem(
        "Could not send to the chat (" + result.error +
          "). If the customer has not messaged in the last 24h, WhatsApp needs an approved template - that is a separate step.",
      );
      return;
    }
    setSentConversationId(conversationId);
  };

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
