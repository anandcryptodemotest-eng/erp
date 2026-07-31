import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/tenants/:slug — public branding for admin login.
 * No secrets; 404 if unknown or inactive.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const { slug: raw } = await params;
  const slug = raw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      settings: {
        where: { key: { in: ["brand.displayName", "brand.accent", "brand.logo", "brand.theme"] } },
        select: { key: true, value: true },
      },
    },
  });

  if (!tenant || !tenant.isActive) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const settings = Object.fromEntries(tenant.settings.map((s) => [s.key, s.value]));
  const displayName = settings["brand.displayName"]?.trim() || tenant.name;

  return NextResponse.json({
    data: {
      slug: tenant.slug,
      displayName,
      active: true,
      branding: {
        logo: settings["brand.logo"] || null,
        accent: settings["brand.accent"] || "#c8922a",
        theme: settings["brand.theme"] || "light",
      },
    },
  });
}
