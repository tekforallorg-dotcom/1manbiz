"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 1 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function getLogoUrl(path: string | null | undefined): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${path}`;
}

type Props = {
  businessId: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  onCleared: () => void;
  onError: (message: string) => void;
  onUploadingChange: (uploading: boolean) => void;
};

export function LogoUpload({
  businessId,
  currentPath,
  onUploaded,
  onCleared,
  onError,
  onUploadingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl =
    localPreview ?? (currentPath ? getLogoUrl(currentPath) : null);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      onError("Image is larger than 1 MB. Please choose a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setLocalPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    onUploadingChange(true);

    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${businessId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("business-logos")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    setUploading(false);
    onUploadingChange(false);

    if (error) {
      setLocalPreview(null);
      onError(error.message || "Upload failed. Please try again.");
      return;
    }

    onUploaded(path);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLocalPreview(null);
    onCleared();
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClick() {
    inputRef.current?.click();
  }

  if (previewUrl) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="group relative block size-32 overflow-hidden rounded-2xl bg-surface-muted ring-1 ring-black/[0.06] transition-shadow hover:ring-black/[0.12]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Logo preview"
            className="size-full object-cover"
          />
          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-black/0 text-transparent transition-all group-hover:bg-black/40 group-hover:text-white">
              <span className="text-xs font-medium">Replace</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={uploading}
          aria-label="Remove logo"
          className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-white text-text-secondary ring-1 ring-black/[0.08] transition-colors hover:text-foreground disabled:opacity-50"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={uploading}
      className="flex size-32 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-muted/50 text-text-secondary ring-1 ring-dashed ring-black/[0.12] transition-all hover:bg-surface-muted hover:text-foreground hover:ring-black/[0.2]"
    >
      {uploading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <>
          <ImagePlus size={20} strokeWidth={1.75} />
          <span className="text-xs font-medium">Upload</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </button>
  );
}
