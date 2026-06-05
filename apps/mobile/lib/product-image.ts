import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

// Standard base64 -> bytes, inlined to avoid a dependency. The manipulator
// returns the compressed JPEG as base64; we decode to a Uint8Array because
// React Native Blob handling is unreliable for Supabase Storage uploads.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64.length; i += 1) LOOKUP[B64.charCodeAt(i)] = i;

function base64ToBytes(b64: string): Uint8Array {
  let len = Math.floor((b64.length * 3) / 4);
  if (b64.charAt(b64.length - 1) === "=") len -= 1;
  if (b64.charAt(b64.length - 2) === "=") len -= 1;
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = LOOKUP[b64.charCodeAt(i)] ?? 0;
    const e2 = LOOKUP[b64.charCodeAt(i + 1)] ?? 0;
    const e3 = LOOKUP[b64.charCodeAt(i + 2)] ?? 0;
    const e4 = LOOKUP[b64.charCodeAt(i + 3)] ?? 0;
    if (p < len) { bytes[p] = (e1 << 2) | (e2 >> 4); p += 1; }
    if (p < len) { bytes[p] = ((e2 & 15) << 4) | (e3 >> 2); p += 1; }
    if (p < len) { bytes[p] = ((e3 & 3) << 6) | e4; p += 1; }
  }
  return bytes;
}

export type ProductImageResult =
  | { status: "ok"; path: string; localUri: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

// Pick from the photo library, downscale the long edge to 1280px, recompress
// to JPEG, and upload to product-images under {businessId}/... so the storage
// owner policy passes. Returns the stored path plus a local uri for instant
// preview. Storage enforces a 2 MB cap and jpeg/png/webp only; 1280px at q0.75
// lands far under that and keeps uploads light on slow connections.
export async function pickAndUploadProductImage(
  businessId: string,
): Promise<ProductImageResult> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled) return { status: "cancelled" };
  const asset = picked.assets?.[0];
  if (!asset) return { status: "error", message: "No image was selected." };

  try {
    const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
    const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (longEdge > 1280) {
      ctx.resize(landscape ? { width: 1280 } : { height: 1280 });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
    if (!out.base64) return { status: "error", message: "Could not process the image." };

    const bytes = base64ToBytes(out.base64);
    const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) return { status: "error", message: error.message };
    return { status: "ok", path, localUri: out.uri };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not upload the image.";
    return { status: "error", message };
  }
}

export function productImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data?.publicUrl ?? null;
}
