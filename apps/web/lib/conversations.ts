import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationStatus = "open" | "closed";
export type MessageDirection = "in" | "out";
export type MessageSenderRole = "customer" | "vendor" | "ai";

export interface ConversationListItem {
  id: string;
  customer_name: string | null;
  contact_phone_e164: string | null;
  channel: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_direction: MessageDirection | null;
  unread_count: number;
  status: ConversationStatus;
}

export interface ConversationHeader {
  id: string;
  business_id: string;
  customer_name: string | null;
  contact_phone_e164: string | null;
  channel: string;
  status: ConversationStatus;
  unread_count: number;
}

export interface MessageRow {
  id: string;
  direction: MessageDirection;
  sender_role: MessageSenderRole;
  body_text: string | null;
  media_url: string | null;
  media_type: string | null;
  sent_at: string;
  meta_status: string | null;
}

/**
 * Inbox list for a business, newest activity first.
 */
export async function listConversations(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ConversationListItem[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, contact_phone_e164, channel, last_message_at, last_message_preview, last_message_direction, unread_count, status,
       customer:customers(name)`,
    )
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[conversations] list failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      id: row.id,
      customer_name: customer?.name ?? null,
      contact_phone_e164: row.contact_phone_e164,
      channel: row.channel,
      last_message_at: row.last_message_at,
      last_message_preview: row.last_message_preview,
      last_message_direction: row.last_message_direction,
      unread_count: row.unread_count,
      status: row.status,
    };
  });
}

/**
 * Resolve a single conversation, scoped to a business so a leaked id from
 * another tenant cannot be opened.
 */
export async function getConversationHeader(
  supabase: SupabaseClient,
  conversationId: string,
  businessId: string,
): Promise<ConversationHeader | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, business_id, contact_phone_e164, channel, status, unread_count,
       customer:customers(name)`,
    )
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return null;
  const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer;
  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: customer?.name ?? null,
    contact_phone_e164: data.contact_phone_e164,
    channel: data.channel,
    status: data.status,
    unread_count: data.unread_count,
  };
}

/**
 * Thread messages oldest-first for natural chat reading order.
 */
export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, sender_role, body_text, media_url, media_type, sent_at, meta_status")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[conversations] messages failed", error);
    return [];
  }
  return data as MessageRow[];
}

/**
 * Zero the unread badge. Idempotent. Pass the businessId so a malicious
 * id from another tenant cannot be marked-read remotely.
 */
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  businessId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId)
    .eq("business_id", businessId);
  if (error) console.error("[conversations] mark-read failed", error);
}

/**
 * Build a short preview string from a raw inbound WhatsApp message.
 * Returns a non-empty string suitable for the inbox list.
 */
export function previewFromIncoming(message: {
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { filename?: string };
}): string {
  switch (message.type) {
    case "text":
      return (message.text?.body ?? "Message").slice(0, 80);
    case "image":
      return message.image?.caption ? "Photo: " + message.image.caption.slice(0, 60) : "Photo";
    case "video":
      return message.video?.caption ? "Video: " + message.video.caption.slice(0, 60) : "Video";
    case "audio":
      return "Voice note";
    case "document":
      return message.document?.filename ? "File: " + message.document.filename.slice(0, 60) : "Document";
    case "sticker":
      return "Sticker";
    case "location":
      return "Location";
    case "contacts":
      return "Contact card";
    default:
      return "Message";
  }
}
