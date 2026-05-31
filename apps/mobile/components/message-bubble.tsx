import { Text, View } from "react-native";

import { formatMessageTime } from "../lib/format";
import type { MessageRow } from "../lib/conversations";

interface Props {
  message: MessageRow;
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === "out";

  const mediaLabel = (() => {
    if (!message.media_type) return null;
    switch (message.media_type) {
      case "image": return "Photo";
      case "video": return "Video";
      case "audio": return "Voice note";
      case "document": return "Document";
      case "sticker": return "Sticker";
      default: return "Attachment";
    }
  })();

  return (
    <View className={"max-w-[80%] mb-3 " + (isOutbound ? "self-end" : "self-start")}>
      <View className={"rounded-2xl px-3.5 py-2 " + (isOutbound ? "bg-primary" : "bg-surface-muted")}>
        {mediaLabel ? (
          <Text className={"text-[11px] font-semibold uppercase mb-1 " + (isOutbound ? "text-white" : "text-textMuted")}>
            {mediaLabel}
          </Text>
        ) : null}
        {message.body_text ? (
          <Text className={"text-sm leading-5 " + (isOutbound ? "text-white" : "text-text")}>
            {message.body_text}
          </Text>
        ) : !mediaLabel ? (
          <Text className={"text-sm italic " + (isOutbound ? "text-white" : "text-textMuted")}>(empty)</Text>
        ) : null}
      </View>
      <Text className={"text-textMuted text-[10.5px] mt-1 px-1 " + (isOutbound ? "self-end" : "self-start")}>
        {formatMessageTime(message.sent_at)}
        {isOutbound && message.meta_status ? " · " + message.meta_status : ""}
      </Text>
    </View>
  );
}
