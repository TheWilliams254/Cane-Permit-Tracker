import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024; // photos are compressed client-side to well under this

const KINDS = new Set(["id-front", "id-back", "farmer", "bank-card", "signature"]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (session.role !== "SCOUT" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only scouts upload photos." }, { status: 403 });
  }
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!hasBlob && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "File storage is not configured (BLOB_READ_WRITE_TOKEN)." }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: "Unknown photo type." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only JPEG, PNG or WebP images are accepted." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large." }, { status: 413 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  if (!hasBlob) {
    // Local development without a Blob store: keep the image inline. Never used in production.
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return NextResponse.json({ url: `data:${file.type};base64,${b64}` });
  }
  const blob = await put(`entries/${kind}/${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ url: blob.url });
}
