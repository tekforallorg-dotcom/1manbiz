import { supabase } from "./supabase";

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

export async function fetchConversations(businessId: string): Promise<ConversationListItem[]> {
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

  return (data ?? []).map((row: any) => {
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

export async function fetchConversationHeader(
  conversationId: string,
  businessId: string,
): Promise<ConversationHeader | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, business_id, contact_phone_e164, channel, status,
       customer:customers(name)`,
    )
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return null;
  const customerRaw = (data as any).customer;
  const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw;
  return {
    id: data.id,
    business_id: data.business_id,
    customer_name: customer?.name ?? null,
    contact_phone_e164: data.contact_phone_e164,
    channel: data.channel,
    status: data.status,
  };
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
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

export async function markConversationRead(
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
