import { View, Text, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import type { ConversationListItem } from "../lib/conversations";

// Compact chat-list time: today shows HH:MM, this week the weekday, older the
// date. Avoids Intl for Hermes safety.
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function chatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours();
    const m = d.getMinutes();
    const hh = ((h + 11) % 12) + 1;
    return hh + ":" + (m < 10 ? "0" + m : String(m)) + " " + (h < 12 ? "AM" : "PM");
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return DOW[d.getDay()] ?? "";
  return d.getDate() + " " + (MON[d.getMonth()] ?? "");
}

function channelLabel(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (!channel) return "";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function compactNaira(kobo: number): string {
  const naira = Math.round((kobo ?? 0) / 100);
  if (naira >= 1000000) {
    const m = naira / 1000000;
    return "\u20A6" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
  }
  if (naira >= 1000) {
    const k = naira / 1000;
    return "\u20A6" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return "\u20A6" + String(naira);
}

type Props = { conversation: ConversationListItem };

export function ConversationRow({ conversation: c }: Props) {
  const router = useRouter();
  const name = c.customer_name ?? c.contact_phone_e164 ?? "Customer";
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const unread = c.unread_count > 0;
  const preview = c.last_message_preview
    ? (c.last_message_direction === "out" ? "You: " + c.last_message_preview : c.last_message_preview)
    : "No messages yet";

  return (
    <Pressable
      onPress={() => router.push(("/conversations/" + c.id) as Href)}
      className="flex-row items-center px-4 py-3.5 active:opacity-70"
    >
      <View className="w-12 h-12 rounded-full bg-surface-muted items-center justify-center mr-3">
        <Text className="text-text text-lg font-semibold">{initial}</Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className={"flex-1 text-base text-text " + (unread ? "font-semibold" : "font-medium")} numberOfLines={1}>
            {name}
          </Text>
          <Text className={"text-xs ml-2 " + (unread ? "text-primary font-semibold" : "text-textMuted")}>
            {chatTime(c.last_message_at)}
          </Text>
        </View>

        <View className="flex-row items-center mt-0.5">
          <Text className={"flex-1 text-sm " + (unread ? "text-textSecondary" : "text-textMuted")} numberOfLines={1}>
            {preview}
          </Text>
          {unread ? (
            <View
              className="bg-primary items-center justify-center ml-2"
              style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10 }}
            >
              <Text className="text-white text-xs font-semibold">
                {c.unread_count > 99 ? "99+" : String(c.unread_count)}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center mt-1">
          {c.channel ? <Text className="text-textMuted text-xs">{channelLabel(c.channel)}</Text> : null}
          {c.unpaid_count > 0 ? (
            <View className={"bg-amber-50 rounded-full px-2 py-0.5 " + (c.channel ? "ml-2" : "")}>
              <Text className="text-amber-700 text-[11px] font-semibold">{"Unpaid " + compactNaira(c.unpaid_kobo)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
