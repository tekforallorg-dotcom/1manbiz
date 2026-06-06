import { Text, View } from "react-native";
import { Bot, Check, CheckCheck, Clock } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";
import { formatMessageTime } from "../lib/format";
import type { MessageRow } from "../lib/conversations";

interface Props {
  message: MessageRow;
  prev?: MessageRow | null;
}

function mediaLabelFor(t: string | null): string | null {
  if (!t) return null;
  switch (t) {
    case "image": return "Photo";
    case "video": return "Video";
    case "audio": return "Voice note";
    case "document": return "Document";
    case "sticker": return "Sticker";
    default: return "Attachment";
  }
}

// Delivery state under outbound bubbles, from meta_status: clock while sending,
// one check sent, double check delivered, green double check read.
function StatusTick({ status }: { status: string | null }) {
  if (!status) return null;
  const ml = { marginLeft: 4 } as const;
  if (status === "read") return <CheckCheck size={13} color={designColors.primary} strokeWidth={2.5} style={ml} />;
  if (status === "delivered") return <CheckCheck size={13} color={designColors.textMuted} strokeWidth={2.5} style={ml} />;
  if (status === "sent") return <Check size={13} color={designColors.textMuted} strokeWidth={2.5} style={ml} />;
  if (status === "sending") return <Clock size={11} color={designColors.textMuted} strokeWidth={2} style={ml} />;
  if (status === "failed") return <Text className="text-danger text-[10.5px] ml-1">Failed</Text>;
  return null;
}

export function MessageBubble({ message, prev }: Props) {
  const isOutbound = message.direction === "out";
  const isAI = message.sender_role === "ai";
  const sameSideAsPrev = !!prev && prev.direction === message.direction;
  // One BizBot label at the top of a run of AI messages, like a sender name.
  const startsAiRun = isAI && (!prev || prev.sender_role !== "ai");
  // Tight grouping: small gap within a side's run, full gap when the side flips.
  const marginTop = !prev ? 4 : sameSideAsPrev ? 3 : 12;
  const mediaLabel = mediaLabelFor(message.media_type);

  return (
    <View
      className={"max-w-[78%] " + (isOutbound ? "self-end items-end" : "self-start items-start")}
      style={{ marginTop }}
    >
      {startsAiRun ? (
        <View className="flex-row items-center mb-1 px-1">
          <Bot size={13} color={designColors.primary} strokeWidth={2} />
          <Text className="text-primary text-[11px] font-semibold ml-1">BizBot</Text>
        </View>
      ) : null}

      <View className={"rounded-2xl px-3.5 py-2.5 " + (isOutbound ? "bg-primary" : "bg-surface-muted")}>
        {mediaLabel ? (
          <Text className={"text-[11px] font-semibold uppercase mb-1 " + (isOutbound ? "text-white" : "text-textMuted")}>
            {mediaLabel}
          </Text>
        ) : null}
        {message.body_text ? (
          <Text className={"text-[15px] leading-[21px] " + (isOutbound ? "text-white" : "text-text")}>
            {message.body_text}
          </Text>
        ) : !mediaLabel ? (
          <Text className={"text-[15px] italic " + (isOutbound ? "text-white" : "text-textMuted")}>(empty)</Text>
        ) : null}
      </View>

      <View className="flex-row items-center mt-1 px-1">
        <Text className="text-textMuted text-[10.5px]">{formatMessageTime(message.sent_at)}</Text>
        {isOutbound ? <StatusTick status={message.meta_status} /> : null}
      </View>
    </View>
  );
}
