-- 0012_conversations_messages.sql
-- Creates conversations + messages tables for WhatsApp/Instagram inbox.
-- Per-business RLS via business_members membership lookup.

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  channel_account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  contact_phone_e164 text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_message_direction text CHECK (last_message_direction IN ('in', 'out')),
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id)
);

CREATE INDEX IF NOT EXISTS conversations_business_recent_idx
  ON conversations (business_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  sender_role text NOT NULL CHECK (sender_role IN ('customer', 'vendor', 'ai')),
  body_text text,
  media_url text,
  media_type text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  meta_message_id text UNIQUE,
  meta_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON messages (conversation_id, sent_at ASC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Members of the business can see their conversations.
CREATE POLICY conversations_select ON conversations
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

-- Members can update (e.g. mark read, close).
CREATE POLICY conversations_update ON conversations
  FOR UPDATE TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

-- Inserts/deletes happen via service-role only (webhook).
-- No INSERT/DELETE policies for authenticated.

CREATE POLICY messages_select ON messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
      )
    )
  );

-- Outbound replies (3G.C) need INSERT for authenticated members.
CREATE POLICY messages_insert ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
      )
    )
  );
