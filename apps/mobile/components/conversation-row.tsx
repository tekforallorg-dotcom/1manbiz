import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { relativeTimeShort } from "../lib/format";
import type { ConversationListItem } from "../lib/conversations";

interface Props {
  conversation: ConversationListItem;
}

export function ConversationRow({ conversation }: Props) {
  const router = useRouter();
  const display = conversation.customer_name
    ?? conversation.contact_phone_e164
    ?? "Customer";
  const preview = conversation.last_message_preview ?? "";
  const isOutbound = conversation.last_message_direction === "out";
  const hasUnread = conversation.unread_count > 0;

  return (
    <Pressable
      onPress={() => router.push(`/conversations/${conversation.id}` as any)}
      className="flex-row items-center px-4 py-3 active:bg-surface-muted border-b border-border"
    >
      <View className="w-10 h-10 rounded-full bg-primarySoft items-center justify-center mr-3">
        <Text className="text-primary text-sm font-semibold">{display.slice(0, 1).toUpperCase()}</Text>
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline justify-between">
          <Text
            numberOfLines={1}
            className={"text-sm font-semibold flex-1 " + (hasUnread ? "text-text" : "text-textSecondary")}
          >
            {display}
          </Text>
          <Text className={"text-[11px] ml-2 " + (hasUnread ? "text-primary font-semibold" : "text-textMuted")}>
            {relativeTimeShort(conversation.last_message_at)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-0.5">
          <Text
            numberOfLines={1}
            className={"text-sm flex-1 " + (hasUnread ? "text-text font-medium" : "text-textMuted")}
          >
            {isOutbound ? "You: " : ""}{preview}
          </Text>
          {hasUnread ? (
            <View className="bg-primary rounded-full min-w-[20px] h-5 px-1.5 ml-2 items-center justify-center">
              <Text className="text-white text-[10.5px] font-semibold">
                {conversation.unread_count > 99 ? "99+" : String(conversation.unread_count)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
