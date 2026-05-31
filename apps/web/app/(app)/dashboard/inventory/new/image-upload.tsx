"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { getProductImageUrl } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  businessId: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  onCleared: () => void;
  onError: (message: string) => void;
  onUploadingChange: (uploading: boolean) => void;
};

export function ImageUpload({
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
  const [dragOver, setDragOver] = useState(false);

  const previewUrl =
    localPreview ?? (currentPath ? getProductImageUrl(currentPath) : null);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      onError("Image is larger than 2 MB. Please choose a smaller file.");
      return;
    }

    // Immediate local preview
    const reader = new FileReader();
    reader.onloadend = () => setLocalPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    onUploadingChange(true);

    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${businessId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  if (previewUrl) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="group relative block aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl bg-surface-muted ring-1 ring-black/[0.06] transition-shadow hover:ring-black/[0.12]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Product preview"
            className="size-full object-cover"
          />
          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-black/0 text-transparent transition-all group-hover:bg-black/40 group-hover:text-white">
              <span className="text-xs font-medium">Tap to replace</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={uploading}
          aria-label="Remove image"
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
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      disabled={uploading}
      className={`flex aspect-square w-full max-w-[200px] flex-col items-center justify-center gap-2 rounded-2xl text-text-secondary ring-1 ring-dashed transition-all hover:text-foreground ${
        dragOver
          ? "bg-brand-soft ring-brand-primary/40"
          : "bg-surface-muted/50 ring-black/[0.12] hover:bg-surface-muted hover:ring-black/[0.2]"
      }`}
    >
      {uploading ? (
        <Loader2 size={24} className="animate-spin" />
      ) : (
        <>
          <ImagePlus size={24} strokeWidth={1.75} />
          <span className="text-xs font-medium">Tap to upload</span>
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
