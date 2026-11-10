"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/format";

export type UploadKind = "id-front" | "id-back" | "farmer" | "bank-card" | "signature";

/** Shrinks a photo to max 1600px on the long side, JPEG 0.82 — plenty for reading an ID, small enough for a field network. */
export async function compressImage(file: File | Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export async function uploadBlob(blob: Blob, kind: UploadKind, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

export function PhotoInput({
  label,
  kind,
  value,
  onChange,
  error,
  hint,
  required,
}: {
  label: string;
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setLocalError(null);
    try {
      const small = await compressImage(file);
      const url = await uploadBlob(small, kind, `${kind}.jpg`);
      onChange(url);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const err = error || localError;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
      </span>
      <div className={cx("relative overflow-hidden rounded-lg border bg-white", err ? "border-danger" : "border-stone-300", "aspect-[4/3]")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-500 hover:bg-stone-50"
            disabled={busy}
          >
            <CameraIcon />
            <span className="text-sm font-medium">{busy ? "Uploading…" : "Take photo"}</span>
          </button>
        )}
        {busy && value && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-medium">Uploading…</div>}
      </div>
      <div className="flex items-center justify-between gap-2">
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : <p className="text-sm text-stone-500">{hint}</p>}
        {value && (
          <button type="button" onClick={() => input.current?.click()} className="text-sm font-medium text-cane-700 hover:underline shrink-0" disabled={busy}>
            Retake
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={kind === "bank-card" ? undefined : "environment"}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
