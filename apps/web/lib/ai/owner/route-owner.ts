/**
 * Owner-mode message pipeline (the webhook hands owner traffic here).
 *
 * Fast paths first (UNLINK, YES/CONFIRM, NO/CANCEL, HELP), then the brain.
 * Reads answer from the grounded context; a write becomes a server-composed
 * proposal that only a fresh YES executes. Every turn is stored in
 * owner_messages, never in the customer CRM.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, sendTypingIndicator } from "@/lib/whatsapp/send";
import { buildOwnerContext, buildSetupBlock } from "@/lib/ai/owner/context";
import { buildReplyCatalog } from "@/lib/ai/catalog";
import { draftOwnerReply } from "@/lib/ai/owner/manage-reply";
import { identifyProductFromMedia, downloadMediaBytes } from "@/lib/ai/owner/vision";
import {
  storeOwnerMessage,
  loadOwnerHistory,
  proposeOwnerAction,
  proposeStockFromVision,
  findPendingAction,
  executePendingAction,
  cancelPendingAction,
  findDraftProduct,
  updateDraftImage,
  startDraftProduct,
  fillDraftProduct,
  cancelDraftProduct,
  proposeDraftProduct,
  type DraftProduct,
} from "@/lib/ai/owner/owner-actions";
import { extractProductFieldsAI } from "@/lib/ai/owner/manage-reply";

type AdminClient = ReturnType<typeof createAdminClient>;

const HELP_TEXT =
  "Ask me anything about the shop: sales today, last 7 days, pending or recent orders, " +
  "stock, low stock, best sellers, prices, or your setup.\n\n" +
  "Change things in plain words:\n" +
  "- 'restock iPhone 17 Pro 512GB Black to 10' (or send a product photo with the count)\n" +
  "- 'set price of Samsung A26s to 250000'\n" +
  "- 'add product Phone Case 5000, 20 in stock'\n" +
  "- 'hide Pixel 9 Pro' / 'show Pixel 9 Pro again'\n" +
  "- 'mark #9F3C paid' / 'cancel #9F3C' (refs are shown with your orders)\n" +
  "- 'Refund policy: refunds within 7 days, item unopened'\n\n" +
  "I always ask you to reply YES before anything changes; NO cancels. " +
  "PENDING shows what is waiting, SETUP shows your setup checklist, UNLINK detaches this number. " +
  "Settings like delivery areas, fulfillment, and payments live in the app.";

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

// Add-intent on a photo caption: the owner wants this picture to become a NEW
// product, not to restock an existing one.
function hasAddIntent(text: string): boolean {
  return /\b(add|new|create|list|register|introduce)\b/i.test(text) ||
    /\bstock\s+this\s+as\b/i.test(text);
}

// A clean product-name guess from an add caption: drop the add verbs and
// filler so "Add this iPad Air white" -> "iPad Air white".
// "new photo for iPhone 17 Pro" style captions and replies. Deterministic on
// purpose so a photo swap never depends on a model call.
function parsePhotoTarget(text: string): string | null {
  const t = (text ?? "").trim().replace(/[.!?]+$/, "");
  if (!t) return null;
  const patterns = [
    /^(?:this is\s+)?(?:the\s+|a\s+)?new\s+(?:photo|picture|pic|image)\s+(?:for|of)\s+(.+)$/i,
    /^(?:use|set)\s+(?:this\s+)?(?:as\s+)?(?:the\s+)?(?:new\s+)?(?:photo|picture|pic|image)\s+(?:for|of)\s+(.+)$/i,
    /^(?:change|update|replace)\s+(?:the\s+)?(?:photo|picture|pic|image)\s+(?:for|of)\s+(.+)$/i,
    /^(?:change|update|replace)\s+(.+?)(?:'s)?\s+(?:photo|picture|pic|image)$/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name.length >= 2 && name.length <= 80) return name;
    }
  }
  return null;
}

function nameFromCaption(text: string): string | null {
  const cleaned = text
    .replace(/\b(?:add|new|create|list|register|introduce|product|please|this|that|the|a|an|as)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 80 ? cleaned : null;
}

// What is still missing from a draft, phrased for the owner.
function draftAsk(d: DraftProduct): string {
  const hasVariants = d.variants != null && d.variants.length >= 2;
  const missing: string[] = [];
  if (!d.name) missing.push("the name");
  if (d.priceKobo == null) missing.push("the price");
  if (!hasVariants && d.stock == null) missing.push("how many in stock");
  const have: string[] = [];
  if (d.name) have.push("name " + d.name);
  if (d.priceKobo != null) have.push("price NGN " + Math.round(d.priceKobo / 100).toLocaleString("en-NG"));
  if (hasVariants) have.push((d.variants ?? []).map((v) => v.label + " (" + String(v.stock) + ")").join(", "));
  else if (d.stock != null) have.push(String(d.stock) + " in stock");
  const sofar = have.length > 0 ? "Got " + have.join(", ") + ". " : "";
  if (missing.length === 1) return sofar + "What is " + missing[0] + "?";
  if (missing.length === 2) return sofar + "What is " + missing[0] + " and " + missing[1] + "?";
  return "Adding a new product from your photo. What is the name, price, and how many in stock? For example: iPad Air, 650000, 5 in stock, or with options: Samsung A76, 450000, 5 black and 3 white.";
}

// Upload product photo bytes via the service-role admin client (bypasses
// storage RLS, same as every other admin write). Path mirrors the app
// convention so the public URL resolves identically. Returns the path or null.
async function storeOwnerPhoto(
  admin: AdminClient,
  accessToken: string,
  mediaId: string,
  businessId: string,
): Promise<string | null> {
  const media = await downloadMediaBytes(mediaId, accessToken);
  if (!media) return null;
  const ext = media.mediaType === "image/png" ? "png" : media.mediaType === "image/webp" ? "webp" : "jpg";
  const path = businessId + "/" + String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10) + "." + ext;
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, media.bytes, { contentType: media.mediaType, upsert: false });
  if (error) {
    console.error("[owner/route] product photo upload failed", error.message);
    return null;
  }
  return path;
}

// Advance a photo-add draft with a free-text owner reply: extract fields, fill,
// then either propose (when complete) or ask for what is still missing.
async function advanceDraft(
  admin: AdminClient,
  businessId: string,
  apiKey: string,
  draft: DraftProduct,
  text: string,
  reply: (body: string) => Promise<void>,
): Promise<void> {
  // "new photo for iPhone 17 Pro" while a photo is held: this is a photo swap
  // for that product, not a new product.
  if (draft.imagePath) {
    const target = parsePhotoTarget(text);
    if (target) {
      await cancelDraftProduct(admin, businessId);
      const proposed = await proposeOwnerAction(admin, businessId, {
        kind: "set_product_photo",
        product: target,
        imagePath: draft.imagePath,
      });
      await reply(proposed.ok ? proposed.summary + "?\nReply YES to confirm or NO to cancel." : proposed.message);
      return;
    }
  }
  // A restock instruction (restock X to N, set stock of X to N) answered while
  // a photo is held: resolve the product and propose a stock change, do not try
  // to add it as a new product.
  const restock = text
    .trim()
    .match(/^(?:restock|set\s+stock(?:\s+of)?|update\s+stock(?:\s+of)?)\s+(.+?)\s+(?:to\s+)?(\d{1,6})\s*$/i);
  if (restock && restock[1] && restock[2]) {
    await cancelDraftProduct(admin, businessId);
    const proposed = await proposeOwnerAction(admin, businessId, {
      kind: "set_stock",
      product: restock[1].trim(),
      value: Number(restock[2]),
    });
    await reply(proposed.ok ? proposed.summary + "?\nReply YES to confirm or NO to cancel." : proposed.message);
    return;
  }
  const fields = await extractProductFieldsAI({
    apiKey,
    latest: text,
    known: { name: draft.name, priceNaira: draft.priceKobo != null ? Math.round(draft.priceKobo / 100) : null, stock: draft.stock },
  });
  const filled = await fillDraftProduct(admin, draft, fields);
  const hasVariants = filled.variants != null && filled.variants.length >= 2;
  if (filled.name && filled.priceKobo != null && (hasVariants || filled.stock != null)) {
    const proposed = await proposeDraftProduct(admin, businessId, filled);
    await reply(
      proposed.ok ? proposed.summary + "?\nReply YES to confirm or NO to cancel." : proposed.message,
    );
    return;
  }
  await reply(draftAsk(filled));
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
  params: { businessId: string; businessName: string; phoneE164: string; channelAccountId: string },
): Promise<void> {
  const { businessId, businessName, phoneE164, channelAccountId } = params;
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
  const setup = await buildSetupBlock(admin, businessId);
  const reply =
    "Linked. You now manage " + businessName + " from this chat.\n\n" +
    "Here is where your setup stands:\n\n" + setup + "\n\n" +
    "Tell me what to change in plain words; I always ask for a YES first. " +
    "Send HELP for everything I can do, or SETUP to see this checklist again.";
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
    inboundMessageId?: string | null;
    origin?: string | null;
  },
): Promise<void> {
  const { businessId, businessName, phoneE164, text, channelAccountId } = params;
  const imageMediaId = params.imageMediaId ?? null;

  const reply = async (body: string) => {
    await sendToOwner(admin, channelAccountId, phoneE164, body);
    await storeOwnerMessage(admin, businessId, "out", body);
  };

  // Loading behaviour: mark the inbound as read and show a typing indicator
  // while we work (vision and brain calls take a few seconds). Best-effort,
  // fire-and-forget; the indicator clears when our reply lands.
  if (params.inboundMessageId) {
    const inboundId = params.inboundMessageId;
    void loadChannel(admin, channelAccountId)
      .then((ch) =>
        ch
          ? sendTypingIndicator({
              phoneNumberId: ch.phoneNumberId,
              accessToken: ch.accessToken,
              messageId: inboundId,
            })
          : undefined,
      )
      .catch(() => undefined);
  }

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

    const addIntent = hasAddIntent(text);

    // Photo for an existing product: a caption like "new photo for iPhone 17
    // Pro" proposes a photo swap on the usual YES rail.
    const photoTarget = parsePhotoTarget(text);
    if (photoTarget) {
      const storedPath = await storeOwnerPhoto(admin, channel.accessToken, imageMediaId, businessId);
      if (!storedPath) {
        await reply("I could not save that photo right now. Try again shortly.");
        return;
      }
      await cancelDraftProduct(admin, businessId);
      const proposed = await proposeOwnerAction(admin, businessId, {
        kind: "set_product_photo",
        product: photoTarget,
        imagePath: storedPath,
      });
      await reply(proposed.ok ? proposed.summary + "?\nReply YES to confirm or NO to cancel." : proposed.message);
      return;
    }

    // Add-a-new-product by photo: store the image, seed a draft (name guessed
    // from the caption), and collect price + stock before anything saves.
    if (addIntent) {
      const storedPath = await storeOwnerPhoto(admin, channel.accessToken, imageMediaId, businessId);
      const seededName = nameFromCaption(text);
      const draft = await startDraftProduct(admin, businessId, { imagePath: storedPath, name: seededName });
      if (!draft) {
        await reply("I could not start that product right now. Try again shortly.");
        return;
      }
      // The caption may already carry price or stock; fold them in immediately.
      await advanceDraft(admin, businessId, apiKey, draft, text, reply);
      return;
    }

    // A new photo while a draft is open is a retake: swap the picture, keep
    // everything already collected, and keep the conversation moving.
    const activeDraft = await findDraftProduct(admin, businessId);
    if (activeDraft) {
      const storedPath = await storeOwnerPhoto(admin, channel.accessToken, imageMediaId, businessId);
      const swapped = storedPath ? await updateDraftImage(admin, activeDraft, storedPath) : activeDraft;
      if (text) {
        await advanceDraft(admin, businessId, apiKey, swapped, text, reply);
      } else {
        await reply("Got your new photo for this product. " + draftAsk(swapped));
      }
      return;
    }

    // Option A: a bare photo (no caption) never guesses. Hold it and ask what
    // to do, so a wrong vision match can never derail the owner. The next reply
    // routes itself: a name and price adds it (photo attached), restock X to N
    // restocks, new photo for X swaps a picture.
    if (!text || !text.trim()) {
      const storedPath = await storeOwnerPhoto(admin, channel.accessToken, imageMediaId, businessId);
      const draft = storedPath
        ? await startDraftProduct(admin, businessId, { imagePath: storedPath, name: null })
        : null;
      if (!draft) {
        await reply("I could not save that photo right now. Try again shortly.");
        return;
      }
      await reply(
        "Got your photo. What would you like to do with it?\n" +
          "- Add it as a new product: send a name and price, like iPhone 17 mini, 900000, 5 in stock\n" +
          "- Restock something you already sell: say restock Samsung A56 to 10\n" +
          "- Update a product photo: say new photo for Samsung A56",
      );
      return;
    }

    // A photo with a caption: snap-to-restock against the existing catalog.
    const catalog = await buildReplyCatalog(businessId);
    const identified = await identifyProductFromMedia({
      apiKey,
      accessToken: channel.accessToken,
      mediaId: imageMediaId,
      catalog,
    });
    if (!identified.ok) {
      // Hold the photo and flow straight into the add-product draft instead of
      // a dead end. The reply also names the photo-swap path.
      const storedPath = await storeOwnerPhoto(admin, channel.accessToken, imageMediaId, businessId);
      const seedName = text && /[a-z]/i.test(text) ? nameFromCaption(text) : null;
      const draft = storedPath
        ? await startDraftProduct(admin, businessId, { imagePath: storedPath, name: seedName })
        : null;
      if (!draft) {
        await reply("I could not read that photo right now. Try again shortly.");
        return;
      }
      await reply(
        "I do not recognize that product. " + draftAsk(draft) +
          " Or if it is a new photo for something I already sell, say so, like new photo for iPhone 17 Pro.",
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

  // A photo-add draft in flight takes the next free-text replies as its
  // answers, unless the owner types a control word (handled just below).
  const CONTROL = new Set([
    "unlink", "help", "menu", "setup", "pending", "status",
    "yes", "y", "yeah", "yep", "yup", "yh", "ok", "okay", "okk", "sure", "confirm",
    "confirmed", "proceed", "go", "do it", "send it", "approve", "approved",
    "no", "n", "nope", "nah", "cancel", "stop", "abort", "discard", "never mind", "nevermind",
  ]);
  if (!CONTROL.has(t)) {
    const draft = await findDraftProduct(admin, businessId);
    if (draft) {
      const draftApiKey = process.env.ANTHROPIC_API_KEY;
      if (!draftApiKey) {
        await reply("The assistant is not configured right now. Try again shortly.");
        return;
      }
      await advanceDraft(admin, businessId, draftApiKey, draft, text, reply);
      return;
    }
  }

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

  if (t === "setup") {
    const setup = await buildSetupBlock(admin, businessId);
    await reply(setup + "\n\nTell me in plain words and I will set it up.");
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
    const result = await executePendingAction(admin, businessId, { origin: params.origin ?? undefined });
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
    const draft = await findDraftProduct(admin, businessId);
    if (draft) {
      await cancelDraftProduct(admin, businessId);
      await reply("Cancelled. I dropped that new product.");
      return;
    }
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
