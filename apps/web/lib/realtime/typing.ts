/**
 * Fire-and-forget "BizBot is composing" signal over Supabase Realtime broadcast.
 *
 * Sent from the autonomous reply path (server-side, service role) on topic
 * bizbot:{conversationId}. The mobile thread subscribes to the same topic and
 * shows or hides the typing dots. Best-effort only: any failure is swallowed,
 * and the client keeps a short safety timeout, so a missed "stop" cannot hang
 * the UI. This never touches the DB and never affects whether a reply is sent.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function broadcastTyping(
  conversationId: string,
  state: "start" | "stop",
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `bizbot:${conversationId}`,
            event: "typing",
            payload: { state },
          },
        ],
      }),
    });
  } catch (e) {
    console.error("[realtime/typing] broadcast failed", e);
  }
}
