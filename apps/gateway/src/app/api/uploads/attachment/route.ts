import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { verifyToken, extractToken } from "@erp/auth";

export const runtime = "nodejs";

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/home/erp/data/uploads";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

function extFor(mime: string, originalName: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "txt";
  if (mime === "image/jpeg") return "jpg";
  const fromName = originalName.split(".").pop();
  return fromName && fromName.length <= 5 ? fromName : "bin";
}

/**
 * POST /api/uploads/attachment
 * multipart field: file
 * Returns: { data: { id, url, name, mimeType, size } }
 */
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

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
    return NextResponse.json(
      { error: "Allowed types: JPG, PNG, WebP, PDF, plain text" },
      { status: 400 }
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 5 MB" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_ROOT, "attachments", tenantId);
  await mkdir(dir, { recursive: true, mode: 0o755 });

  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const name = `${id}.${extFor(file.type, file.name)}`;
  const abs = path.join(dir, name);
  await writeFile(abs, buf, { mode: 0o644 });

  const url = `/uploads/attachments/${tenantId}/${name}`;
  return NextResponse.json(
    {
      data: {
        id,
        url,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      },
    },
    { status: 201 }
  );
}
