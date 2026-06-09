import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
import { base64ToBytes } from "./product-image";

export type LogoUploadResult =
  | { status: "ok"; path: string; localUri: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

// Pick a square-ish image from the library, downscale the long edge to 512px,
// recompress to JPEG, and upload to the business-logos bucket under
// {businessId}/... so the storage owner policy passes. Mirrors the web logo
// upload (same bucket); the logo path is persisted to businesses.logo_path by
// the caller on Save. Returns the stored path plus a local uri for instant
// preview.
export async function pickAndUploadBusinessLogo(
  businessId: string,
): Promise<LogoUploadResult> {
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
    if (longEdge > 512) {
      ctx.resize(landscape ? { width: 512 } : { height: 512 });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    if (!out.base64) return { status: "error", message: "Could not process the image." };

    const bytes = base64ToBytes(out.base64);
    const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const { error } = await supabase.storage
      .from("business-logos")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) return { status: "error", message: error.message };
    return { status: "ok", path, localUri: out.uri };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not upload the image.";
    return { status: "error", message };
  }
}
