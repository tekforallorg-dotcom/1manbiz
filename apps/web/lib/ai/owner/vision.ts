/**
 * Owner-mode vision: match a product photo to the live catalog.
 *
 * The owner snaps a product and (optionally) says the new count. We download
 * the WhatsApp media with the channel token, send the image plus the exact
 * catalog names to Haiku, and ask ONLY which catalog product it is (and a
 * variant choice when the product has options). Vision never sets a quantity
 * or a price; the number always comes from the owner's words. The returned
 * product/variant strings are matched server-side against the catalog the same
 * way every other owner action is, so a hallucinated name simply fails to
 * resolve and the owner is asked to type it.
 */

import { renderCatalogBlock, type ReplyCatalogProduct } from "@/lib/ai/catalog";

const VISION_MODEL = "claude-haiku-4-5-20251001";
const GRAPH_BASE = "https://graph.facebook.com/v22.0";

export interface VisionMatch {
  product: string;
  variant?: string;
}

function extractText(data: unknown): string {
  const content = (data as Record<string, unknown>).content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") out += b.text;
    }
  }
  return out.trim();
}

function safeJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Resolve a WhatsApp media id to bytes, then base64. Two calls: GET /{id}
// returns a short-lived URL, which we then fetch with the same bearer token.
async function downloadMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const metaRes = await fetch(GRAPH_BASE + "/" + encodeURIComponent(mediaId), {
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store",
    });
    if (!metaRes.ok) {
      console.error("[owner/vision] media meta failed", metaRes.status);
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const binRes = await fetch(meta.url, {
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store",
    });
    if (!binRes.ok) {
      console.error("[owner/vision] media binary failed", binRes.status);
      return null;
    }
    const buf = Buffer.from(await binRes.arrayBuffer());
    const mediaType = meta.mime_type || binRes.headers.get("content-type") || "image/jpeg";
    // Guard against oversized payloads (Anthropic image limit is generous, but
    // we keep owner snaps sane).
    if (buf.byteLength > 4 * 1024 * 1024) {
      console.warn("[owner/vision] media too large", buf.byteLength);
      return null;
    }
    return { base64: buf.toString("base64"), mediaType: mediaType.split(";")[0] ?? "image/jpeg" };
  } catch (e) {
    console.error("[owner/vision] download threw", e);
    return null;
  }
}

export async function identifyProductFromMedia(params: {
  apiKey: string;
  accessToken: string;
  mediaId: string;
  catalog: ReplyCatalogProduct[];
}): Promise<{ ok: true; match: VisionMatch } | { ok: false; error: string }> {
  const { apiKey, accessToken, mediaId, catalog } = params;
  if (catalog.length === 0) return { ok: false, error: "no catalog" };

  const media = await downloadMedia(mediaId, accessToken);
  if (!media) return { ok: false, error: "media download failed" };

  const system =
    "You identify which catalog product appears in a photo for a shop owner. " +
    "You are given the shop's CATALOG (exact product names, their Options, and Choices). " +
    "Look at the image and pick the SINGLE best-matching catalog product.\n" +
    "- Use ONLY names that appear in the CATALOG; never invent one.\n" +
    "- If the product has Options and the photo clearly shows a specific choice (a colour, say), set \"variant\" to the exact Choices label; if you cannot tell the choice from the photo, omit \"variant\".\n" +
    "- If nothing in the catalog matches the photo, set product to an empty string.\n" +
    "- Never guess a quantity or price. You only identify the product.\n\n" +
    "Respond with ONLY this JSON, no prose, no fences:\n" +
    "{\"product\":\"<exact CATALOG name or empty>\",\"variant\":\"<exact Choices label, omit if unknown or no Options>\"}";

  const user =
    "CATALOG:\n" + renderCatalogBlock(catalog) + "\n\nIdentify the product in the attached photo.";

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 300,
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: media.mediaType, data: media.base64 },
              },
              { type: "text", text: user },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    console.error("[owner/vision] anthropic threw", e);
    return { ok: false, error: "vision unreachable" };
  }
  if (!res.ok) {
    console.error("[owner/vision] anthropic non-200", res.status);
    return { ok: false, error: "vision error" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "vision unreadable" };
  }

  const parsed = safeJson(extractText(data));
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "vision not JSON" };
  const p = parsed as Record<string, unknown>;
  const product = typeof p.product === "string" ? p.product.trim() : "";
  const variant = typeof p.variant === "string" ? p.variant.trim() : "";
  if (!product) return { ok: false, error: "no match" };
  return { ok: true, match: variant ? { product, variant } : { product } };
}
