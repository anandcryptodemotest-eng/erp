import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@erp/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().optional(),
});

// POST /api/auth/login
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "register") {
    return handleRegister(request);
  }
  return handleLogin(request);
}

async function handleLogin(request: Request) {
  try {
    const body = await request.json();
    const { email, password, tenantSlug } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenants: {
          where: { isActive: true },
          include: {
            tenant: {
              include: { licenses: { where: { isActive: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Determine tenant context
    let tenantUser = user.tenants[0]; // Default to first tenant
    if (tenantSlug) {
      const found = user.tenants.find((tu) => tu.tenant.slug === tenantSlug);
      if (found) tenantUser = found;
    }

    if (!tenantUser) {
      return NextResponse.json({ error: "No tenant access" }, { status: 403 });
    }

    const modules = tenantUser.tenant.licenses.map((l) => l.moduleId);

    const token = await createToken({
      userId: user.id,
      tenantId: tenantUser.tenantId,
      role: tenantUser.role as "ADMIN" | "USER" | "MANAGER",
      modules,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: tenantUser.role,
      },
      tenant: {
        id: tenantUser.tenant.id,
        name: tenantUser.tenant.name,
        slug: tenantUser.tenant.slug,
      },
      modules,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleRegister(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, tenantSlug } = registerSchema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    // Auto-create a default tenant for new users
    const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    const tenant = await prisma.tenant.create({
      data: { name: `${name}'s Organization`, slug: `${slug}-org` },
    });
    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" },
    });
    await prisma.moduleLicense.create({
      data: { tenantId: tenant.id, moduleId: "core", plan: "basic" },
    });

    // If tenant slug provided, add user to that tenant
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) {
        await prisma.tenantUser.create({
          data: { tenantId: tenant.id, userId: user.id, role: "USER" },
        });
      }
    }

    return NextResponse.json(
      { message: "User created", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("[register] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
