import type { MessageRow } from "@/lib/conversations";

interface Props {
  message: MessageRow;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === "out";

  const wrapClass = isOutbound
    ? "ml-auto items-end"
    : "mr-auto items-start";

  const bubbleClass = isOutbound
    ? "bg-brand-primary text-white"
    : "bg-surface-muted text-foreground";

  // Media-only messages display a type label when there is no caption.
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
    <li className={"flex max-w-[80%] flex-col gap-1 " + wrapClass}>
      <div className={"rounded-2xl px-3.5 py-2 text-sm leading-snug " + bubbleClass}>
        {mediaLabel ? (
          <p className={"text-[11px] font-semibold uppercase tracking-wide " + (isOutbound ? "text-white/70" : "text-text-muted")}>
            {mediaLabel}
          </p>
        ) : null}
        {message.body_text ? (
          <p className={mediaLabel ? "mt-1 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
            {message.body_text}
          </p>
        ) : !mediaLabel ? (
          <p className={isOutbound ? "italic text-white/70" : "italic text-text-muted"}>(empty)</p>
        ) : null}
      </div>
      <p className="px-1 text-[10.5px] text-text-muted tabular-nums">
        {formatTime(message.sent_at)}
        {isOutbound && message.meta_status ? " - " + message.meta_status : ""}
      </p>
    </li>
  );
}
