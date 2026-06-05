import { useState } from "react";
import {
  View, Text, Pressable, ActivityIndicator, Alert, Linking, Share,
} from "react-native";
import { MessageCircle, Link2 } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { formatNaira } from "../lib/format";
import { initPaymentLink } from "../lib/payments";

type Props = {
  orderId: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotalKobo: number;
};

export function PaymentLinkButton({ orderId, customerName, customerPhone, subtotalKobo }: Props) {
  const [loading, setLoading] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const buildMessage = (url: string) => {
    const who = customerName ? "Hi " + customerName + ", " : "Hi, ";
    return who + "here is your secure payment link for " + formatNaira(subtotalKobo) + ": " + url;
  };

  const sendViaWhatsApp = async (url: string) => {
    const digits = (customerPhone ?? "").replace(/[^0-9]/g, "");
    const text = encodeURIComponent(buildMessage(url));
    const waUrl = digits.length >= 7 ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    try {
      await Linking.openURL(waUrl);
    } catch {
      try {
        await Share.share({ message: buildMessage(url) });
      } catch {
        /* user dismissed the share sheet */
      }
    }
  };

  const shareLink = async (url: string) => {
    try {
      await Share.share({ message: buildMessage(url) });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const createAndSend = async () => {
    setLoading(true);
    const result = await initPaymentLink(orderId);
    setLoading(false);
    if (!result.ok) {
      Alert.alert("Payment link", result.error);
      return;
    }
    setPayUrl(result.payUrl);
    await sendViaWhatsApp(result.payUrl);
  };

  if (payUrl) {
    return (
      <View style={{ gap: 8 }}>
        <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Payment link</Text>
          <Text className="text-text text-sm mt-1" numberOfLines={1}>{payUrl}</Text>
        </View>
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={() => sendViaWhatsApp(payUrl)}
            className="flex-1 bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          >
            <MessageCircle size={18} color="#FFFFFF" />
            <Text className="text-white text-base font-semibold ml-2">WhatsApp</Text>
          </Pressable>
          <Pressable
            onPress={() => shareLink(payUrl)}
            className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
          >
            <Link2 size={18} color={designColors.text} />
            <Text className="text-text text-base font-semibold ml-2">Share</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={createAndSend}
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
  );
}
