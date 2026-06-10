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
import { buildReplyCatalog } from "@/lib/ai/catalog";
import { draftOwnerReply } from "@/lib/ai/owner/manage-reply";
import { identifyProductFromMedia } from "@/lib/ai/owner/vision";
import {
  storeOwnerMessage,
  loadOwnerHistory,
  proposeOwnerAction,
  proposeStockFromVision,
  findPendingAction,
  executePendingAction,
  cancelPendingAction,
} from "@/lib/ai/owner/owner-actions";

type AdminClient = ReturnType<typeof createAdminClient>;

const HELP_TEXT =
  "You can ask: sales today, last 7 days, recent orders, pending orders, " +
  "stock or low stock, best sellers, or how many of a product are left.\n" +
  "To change things: 'restock iPhone 17 Pro 512GB Black to 10' or " +
  "'set price of Samsung A26s to 250000', or just send a product photo with " +
  "the new count. I will ask you to reply YES before anything changes. NO " +
  "cancels. PENDING shows what is waiting. UNLINK detaches this number.";

// Confirm/cancel are an explicit allow-list: forgiving of how owners actually
// type, but a free-form sentence never counts as a confirmation.
const YES_WORDS = new Set([
  "yes", "y", "yeah", "yep", "yup", "yh", "ok", "okay", "okk", "sure", "confirm",
  "confirmed", "proceed", "go", "go ahead", "do it", "send it", "approve", "approved",
]);
const NO_WORDS = new Set([
  "no", "n", "nope", "nah", "cancel", "stop", "abort", "discard", "never mind", "nevermind",
]);

// Extract a single new-total quantity from an owner caption like "restock to
// 12", "12", or "make it 12". Returns null when there is no clear number.
function quantityFromText(text: string): number | null {
  const m = text.match(/(\d{1,6})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function loadChannel(
  admin: AdminClient,
  channelAccountId: string,
): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const { data } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token")
    .eq("id", channelAccountId)
    .maybeSingle();
  const ch = (data ?? null) as { meta_phone_number_id?: string | null; access_token?: string | null } | null;
  if (!ch?.meta_phone_number_id || !ch?.access_token) return null;
  return { phoneNumberId: ch.meta_phone_number_id, accessToken: ch.access_token };
}

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

export async function handleOwnerLinkExpired(
  admin: AdminClient,
  params: { businessId: string; phoneE164: string; channelAccountId: string },
): Promise<void> {
  const { businessId, phoneE164, channelAccountId } = params;
  await storeOwnerMessage(admin, businessId, "in", "LINK (expired code)");
  const reply =
    "That link code has expired. Open the 1Man.Biz app, generate a fresh code under Manage by WhatsApp, and send it here within 15 minutes.";
  await sendToOwner(admin, channelAccountId, phoneE164, reply);
  await storeOwnerMessage(admin, businessId, "out", reply);
}

export async function handleOwnerMessage(
  admin: AdminClient,
  params: {
    businessId: string;
    businessName: string;
    phoneE164: string;
    text: string;
    channelAccountId: string;
    imageMediaId?: string | null;
  },
): Promise<void> {
  const { businessId, businessName, phoneE164, text, channelAccountId } = params;
  const imageMediaId = params.imageMediaId ?? null;

  const reply = async (body: string) => {
    await sendToOwner(admin, channelAccountId, phoneE164, body);
    await storeOwnerMessage(admin, businessId, "out", body);
  };

  // ----- Photo: snap-to-restock -----
  // The owner sends a product picture, optionally with the new count in the
  // caption. Vision matches it to a catalog product; the quantity comes from
  // the caption (never guessed). With a number -> a stock proposal; without
  // one -> confirm the product and ask for the count.
  if (imageMediaId) {
    await storeOwnerMessage(admin, businessId, "in", text ? "(photo) " + text : "(photo)");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await reply("The assistant is not configured right now. Try again shortly.");
      return;
    }
    const channel = await loadChannel(admin, channelAccountId);
    if (!channel) {
      await reply("I could not read that photo right now. Please type the change instead.");
      return;
    }
    const catalog = await buildReplyCatalog(businessId);
    const identified = await identifyProductFromMedia({
      apiKey,
      accessToken: channel.accessToken,
      mediaId: imageMediaId,
      catalog,
    });
    if (!identified.ok) {
      await reply(
        "I could not match that photo to a product. You can type the change instead, like 'restock iPhone 17 Pro 512GB Black to 10'.",
      );
      return;
    }
    const qty = quantityFromText(text);
    const labelled =
      identified.match.product + (identified.match.variant ? " - " + identified.match.variant : "");
    if (qty === null) {
      await reply(
        "That looks like " + labelled + ". How many are in stock now? Reply with the number, like 'restock to 12'.",
      );
      return;
    }
    const proposed = await proposeStockFromVision(admin, businessId, identified.match, qty);
    await reply(
      proposed.ok ? proposed.summary + "?\nReply YES to confirm or NO to cancel." : proposed.message,
    );
    return;
  }

  if (!text) {
    await storeOwnerMessage(admin, businessId, "in", "(non-text message)");
    await reply("I can read text and product photos here. Send a photo to restock, or type what you need.");
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

  if (t === "pending" || t === "status") {
    const pending = await findPendingAction(admin, businessId);
    await reply(
      pending
        ? "Waiting on your confirmation:\n" + pending.summary + "?\nReply YES to confirm or NO to cancel."
        : "Nothing is pending.",
    );
    return;
  }

  if (YES_WORDS.has(t)) {
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

  if (NO_WORDS.has(t)) {
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
