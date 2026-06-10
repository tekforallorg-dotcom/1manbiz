/**
 * Owner-mode message pipeline (the webhook hands owner traffic here).
 *
 * Fast paths first (UNLINK, YES/CONFIRM, NO/CANCEL, HELP), then the brain.
 * Reads answer from the grounded context; a write becomes a server-composed
 * proposal that only a fresh YES executes. Every turn is stored in
 * owner_messages, never in the customer CRM.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { buildOwnerContext } from "@/lib/ai/owner/context";
import { draftOwnerReply } from "@/lib/ai/owner/manage-reply";
import {
  storeOwnerMessage,
  loadOwnerHistory,
  proposeOwnerAction,
  executePendingAction,
  cancelPendingAction,
} from "@/lib/ai/owner/owner-actions";

type AdminClient = ReturnType<typeof createAdminClient>;

const HELP_TEXT =
  "You can ask: sales today, last 7 days, recent orders, pending orders, " +
  "stock or low stock, best sellers, or how many of a product are left.\n" +
  "To change things: 'restock iPhone 17 Pro 512GB Black to 10' or " +
  "'set price of Samsung A26s to 250000'. I will ask you to reply YES before " +
  "anything changes. NO cancels. UNLINK detaches this number.";

async function sendToOwner(
  admin: AdminClient,
  channelAccountId: string,
  toE164: string,
  body: string,
): Promise<void> {
  const { data } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token")
    .eq("id", channelAccountId)
    .maybeSingle();
  const ch = (data ?? null) as { meta_phone_number_id?: string | null; access_token?: string | null } | null;
  if (!ch?.meta_phone_number_id || !ch?.access_token) {
    console.warn("[owner/route] channel not sendable", channelAccountId);
    return;
  }
  const sent = await sendWhatsAppText({
    phoneNumberId: ch.meta_phone_number_id,
    accessToken: ch.access_token,
    toE164,
    body,
  });
  if (!sent.ok) console.error("[owner/route] send failed", sent.error);
}

export async function handleOwnerLink(
  admin: AdminClient,
  params: { businessId: string; phoneE164: string; channelAccountId: string },
): Promise<void> {
  const { businessId, phoneE164, channelAccountId } = params;
  const { error } = await admin
    .from("businesses")
    .update({
      owner_phone: phoneE164,
      owner_phone_verified_at: new Date().toISOString(),
      owner_link_code: null,
    })
    .eq("id", businessId);
  if (error) {
    console.error("[owner/route] link update failed", error.message);
    return;
  }
  await storeOwnerMessage(admin, businessId, "in", "LINK (code accepted)");
  const reply =
    "Linked. This number now manages your shop.\n\n" + HELP_TEXT;
  await sendToOwner(admin, channelAccountId, phoneE164, reply);
  await storeOwnerMessage(admin, businessId, "out", reply);
  console.log("[owner/route] owner linked", { businessId });
}

export async function handleOwnerMessage(
  admin: AdminClient,
  params: {
    businessId: string;
    businessName: string;
    phoneE164: string;
    text: string;
    channelAccountId: string;
  },
): Promise<void> {
  const { businessId, businessName, phoneE164, text, channelAccountId } = params;

  const reply = async (body: string) => {
    await sendToOwner(admin, channelAccountId, phoneE164, body);
    await storeOwnerMessage(admin, businessId, "out", body);
  };

  if (!text) {
    await storeOwnerMessage(admin, businessId, "in", "(non-text message)");
    await reply("I can only read text here for now.");
    return;
  }

  await storeOwnerMessage(admin, businessId, "in", text);
  const t = text.trim().toLowerCase();

  if (t === "unlink") {
    await admin
      .from("businesses")
      .update({ owner_phone: null, owner_phone_verified_at: null })
      .eq("id", businessId);
    await reply("Unlinked. This number no longer manages the shop. Generate a new link code in the app to reconnect.");
    console.log("[owner/route] owner unlinked", { businessId });
    return;
  }

  if (t === "help" || t === "menu") {
    await reply(HELP_TEXT);
    return;
  }

  if (t === "yes" || t === "y" || t === "confirm") {
    const result = await executePendingAction(admin, businessId);
    if (result === null) {
      await reply("Nothing pending to confirm.");
    } else if (result.ok) {
      await reply("Done. " + result.summary + ".");
      console.log("[owner/route] action executed", { businessId, summary: result.summary });
    } else {
      await reply(result.message);
    }
    return;
  }

  if (t === "no" || t === "cancel") {
    const cancelled = await cancelPendingAction(admin, businessId);
    await reply(cancelled ? "Cancelled. Nothing was changed." : "Nothing pending to cancel.");
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[owner/route] ANTHROPIC_API_KEY not set");
    await reply("The assistant is not configured right now. Try again shortly.");
    return;
  }

  const [context, history] = await Promise.all([
    buildOwnerContext(admin, businessId),
    loadOwnerHistory(admin, businessId, 10),
  ]);
  // The just-stored inbound is the last history row; drop it so the prompt
  // shows it once, as the latest owner line.
  const priorHistory = history.slice(0, -1);

  const drafted = await draftOwnerReply({
    apiKey,
    businessName,
    context,
    history: priorHistory,
    latest: text,
  });
  if (!drafted.ok) {
    await reply("I could not process that right now. Try again shortly.");
    return;
  }

  if (drafted.draft.action) {
    const proposed = await proposeOwnerAction(admin, businessId, drafted.draft.action);
    if (proposed.ok) {
      // The owner confirms the server's words, never the model's.
      await reply(proposed.summary + "?\nReply YES to confirm or NO to cancel.");
    } else {
      await reply(proposed.message);
    }
    return;
  }

  await reply(drafted.draft.reply);
}
