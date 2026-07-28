import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { verifyToken, extractToken } from "@erp/auth";

export const runtime = "nodejs";

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/home/erp/data/uploads";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * POST /api/uploads/product-image
 * multipart field: file
 * Returns: { data: { url } } where url is publicly served via nginx /uploads/...
 */
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (auth.role !== "ADMIN" && auth.role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be between 1 byte and 2 MB" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_ROOT, "products", tenantId);
  await mkdir(dir, { recursive: true, mode: 0o755 });

  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
  const abs = path.join(dir, name);
  await writeFile(abs, buf, { mode: 0o644 });

  const url = `/uploads/products/${tenantId}/${name}`;
  return NextResponse.json({ data: { url, size: file.size, contentType: file.type } }, { status: 201 });
}
