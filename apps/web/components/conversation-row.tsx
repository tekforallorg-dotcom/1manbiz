import Link from "next/link";

import { relativeTimeShort } from "@/lib/format";
import type { ConversationListItem } from "@/lib/conversations";

interface Props {
  conversation: ConversationListItem;
}

export function ConversationRow({ conversation }: Props) {
  const display = conversation.customer_name
    ?? conversation.contact_phone_e164
    ?? "Customer";

  const preview = conversation.last_message_preview ?? "";
  const isOutbound = conversation.last_message_direction === "out";
  const hasUnread = conversation.unread_count > 0;

  return (
    <li>
      <Link
        href={"/dashboard/conversations/" + conversation.id}
        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-muted sm:px-6"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-primary">
          {display.slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className={"truncate text-sm font-semibold " + (hasUnread ? "text-foreground" : "text-text-secondary")}>
              {display}
            </p>
            <p className={"shrink-0 text-[11px] tabular-nums " + (hasUnread ? "font-semibold text-brand-primary" : "text-text-muted")}>
              {relativeTimeShort(conversation.last_message_at)}
            </p>
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <p className={"truncate text-sm " + (hasUnread ? "font-medium text-foreground" : "text-text-muted")}>
              {isOutbound ? "You: " : ""}{preview}
            </p>
            {hasUnread ? (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-primary px-1.5 text-[10.5px] font-semibold text-white tabular-nums">
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
