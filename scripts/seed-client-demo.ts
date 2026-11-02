/**
 * Trustwood demo seed — configure groups + simple adhesive + buyer + OMS users.
 *
 *   pnpm clear:catalog && pnpm seed:demo
 *
 * Idempotent. Tenant default: trustwood-enterprise.
 *
 * Groups: TRUSTWOOD-BWP, TRUSTWOOD-BLOCKBOARD, TRUSTWOOD-LAMINATE, TRUSTWOOD-PHONE
 * Simple: TW-ADH-1L (no configure axes)
 * Buyer: buyer@trustwood.test / Buyer@12345
 */

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";
const TENANT_NAME = process.env.TENANT_NAME ?? "Trustwood Enterprise";

const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@simhapurifresh.com",
  password: process.env.ADMIN_PASSWORD ?? "Admin@123",
};
const PLATFORM = {
  email: process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local",
  password: process.env.PLATFORM_OWNER_PASSWORD || "Platform@123",
};

const ENTERPRISE_FEATURES = [
  "dashboard",
  "organization",
  "users",
  "oms",
  "quick_bill",
  "inventory",
  "accounting",
  "gst",
  "ar",
  "process_studio",
  "portal",
  "procurement",
  "delivery",
  "hr",
];

const DEMO_USERS = [
  { email: "sales@trustwood.test", password: "Sales@123", name: "Sales Executive", role: "SALES_EXECUTIVE" },
  { email: "pricing@oms.test", password: "Test@123", name: "Pricing Executive", role: "PRICING_EXECUTIVE" },
  { email: "dispatch@oms.test", password: "Test@123", name: "Dispatch Executive", role: "DISPATCH_EXECUTIVE" },
  { email: "delivery@oms.test", password: "Test@123", name: "Delivery Executive", role: "DELIVERY_EXECUTIVE" },
  { email: "accountant@oms.test", password: "Test@123", name: "Accountant", role: "ACCOUNTANT" },
] as const;

const BUYER = {
  email: "buyer@trustwood.test",
  password: "Buyer@12345",
  name: "Buyer Trustwood",
  phone: "+919876543210",
};

const MEDIA = {
  plywood: "/media/products/plywood-marine.jpg",
  blockboard: "/media/products/blockboard.jpg",
  timber: "/media/products/timber.jpg",
  laminate: "/media/products/laminate.jpg",
  adhesive: "/media/products/adhesive.jpg",
  phone: "/media/products/phone.jpg",
  hardware: "/media/products/hardware.jpg",
  warehouse: "/media/products/hardware.jpg",
  hero: "/media/products/hero-yard.jpg",
} as const;

/** Must match apps/inventory/src/lib/commercial-media.ts buildVariationKey */
function buildVariationKey(
  attributeOrder: string[],
  values: Record<string, string | number | undefined | null>
): string {
  return attributeOrder.map((a) => String(values[a] ?? "").trim()).join("|");
}

type Json = { data?: unknown; error?: string; meta?: unknown };

async function api(
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; role?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  if (opts.role) headers["x-user-role"] = opts.role;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function log(step: string, detail?: string) {
  console.log(`  ✓ ${step}${detail ? ` — ${detail}` : ""}`);
}
function warn(step: string, detail?: string) {
  console.log(`  ! ${step}${detail ? ` — ${detail}` : ""}`);
}

type Auth = { token: string; tenantId: string; role: string };

async function platformLogin(): Promise<string> {
  const plat = await api("POST", "/api/platform/auth", {
    body: { email: PLATFORM.email, password: PLATFORM.password },
  });
  if (plat.status !== 200 || !plat.json.data) {
    throw new Error(
      `Platform login failed (${plat.status}). Set PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_PASSWORD.`
    );
  }
  return (plat.json.data as { accessToken: string }).accessToken;
}

async function loginAdmin(): Promise<Auth> {
  const login = await api("POST", "/api/auth", {
    body: { action: "login", email: ADMIN.email, password: ADMIN.password, tenantSlug: TENANT },
  });
  if (login.status !== 200 || !login.json.data) {
    throw new Error(`Admin login failed: ${login.status} ${login.json.error ?? ""}`);
  }
  const data = login.json.data as {
    accessToken: string;
    tenant: { id: string };
    user: { role: string };
  };
  return {
    token: data.accessToken,
    tenantId: data.tenant.id,
    role: data.user.role ?? "ADMIN",
  };
}

async function ensureBrand(auth: Auth, name: string, brandByName: Map<string, string>) {
  if (brandByName.has(name)) return brandByName.get(name)!;
  const created = await api("POST", "/api/brands", { ...auth, body: { name } });
  const b = created.json.data as { id: string; name: string } | undefined;
  if (b?.id) {
    brandByName.set(b.name, b.id);
    log("Created brand", name);
    return b.id;
  }
  warn(`Brand ${name}`, `${created.status} ${created.json.error ?? ""}`);
  return undefined;
}

async function ensureCategory(auth: Auth, name: string, catByName: Map<string, string>) {
  if (catByName.has(name)) return catByName.get(name)!;
  const created = await api("POST", "/api/products/categories", {
    ...auth,
    body: { name },
  });
  const c = created.json.data as { id: string; name: string } | undefined;
  if (c?.id) {
    catByName.set(c.name, c.id);
    log("Created category", name);
    return c.id;
  }
  warn(`Category ${name}`, `${created.status} ${created.json.error ?? ""}`);
  return undefined;
}

async function ensureAttr(
  auth: Auth,
  def: {
    key: string;
    label: string;
    dataType: string;
    options?: string[];
    isIdentity?: boolean;
    categoryIds?: string[];
  }
) {
  const list = await api("GET", "/api/attribute-definitions", auth);
  const attrs = (list.json.data as { id: string; key: string; isIdentity?: boolean }[]) ?? [];
  const existing = attrs.find((a) => a.key === def.key);
  if (existing) {
    if (def.isIdentity && !existing.isIdentity) {
      await api("PATCH", `/api/attribute-definitions/${existing.id}`, {
        ...auth,
        body: { isIdentity: true },
      });
      log("Set isIdentity", def.key);
    } else {
      log("Attr exists", def.key);
    }
    return existing.id;
  }
  const created = await api("POST", "/api/attribute-definitions", {
    ...auth,
    body: {
      key: def.key,
      label: def.label,
      dataType: def.dataType,
      options: def.options,
      isIdentity: def.isIdentity ?? false,
      isVariantAxis: true,
      isFilterable: true,
      categoryIds: def.categoryIds,
    },
  });
  const id = (created.json.data as { id: string } | undefined)?.id;
  if (id) log("Created attr", def.key);
  else warn(`Attr ${def.key}`, `${created.status} ${created.json.error ?? ""}`);
  return id;
}

type EngineResult = {
  created?: { id: string; sku: string }[];
  skipped?: unknown[];
  summary?: { createdCount?: number; skippedCount?: number };
};

async function createGroup(
  auth: Auth,
  body: Record<string, unknown>
): Promise<{ ids: { id: string; sku: string }[]; created: number; skipped: number }> {
  const gen = await api("POST", "/api/products", { ...auth, body });
  const payload = gen.json.data as EngineResult | undefined;
  const created = payload?.summary?.createdCount ?? payload?.created?.length ?? 0;
  const skipped = payload?.summary?.skippedCount ?? payload?.skipped?.length ?? 0;
  const ids = payload?.created ?? [];
  if (gen.status === 201 || gen.status === 200) {
    log(`Group ${String(body.groupCode)}`, `${created} created, ${skipped} skipped`);
    for (const p of ids) log("  SKU", p.sku);
  } else {
    warn(
      `Group ${String(body.groupCode)}`,
      `${gen.status} ${gen.json.error ?? ""} ${JSON.stringify((gen.json as { issues?: unknown }).issues ?? "")}`
    );
  }
  return { ids, created, skipped };
}

async function receiveStock(
  auth: Auth,
  warehouseId: string,
  items: { productId: string; quantity: number }[]
) {
  if (!items.length) return;
  const recv = await api("POST", "/api/stock/receive", {
    ...auth,
    body: {
      items: items.map((i) => ({ ...i, warehouseId })),
      reference: `DEMO-SEED-${Date.now()}`,
      notes: "Trustwood demo opening stock",
    },
  });
  if (recv.status === 201 || recv.status === 200) log("Received stock", `${items.length} lines`);
  else warn("stock/receive", `${recv.status} ${recv.json.error ?? ""}`);
}

async function findProductBySku(auth: Auth, sku: string) {
  const paths = [
    `/api/products?sku=${encodeURIComponent(sku)}&limit=5&includeInactive=true`,
    `/api/products?search=${encodeURIComponent("Adhesive")}&limit=20&includeInactive=true`,
    `/api/products?limit=200&includeInactive=true`,
  ];
  for (const path of paths) {
    const res = await api("GET", path, auth);
    const hit = (
      (res.json.data as { id: string; sku: string; isActive?: boolean }[] | undefined) ?? []
    ).find((p) => p.sku === sku);
    if (hit) return hit;
  }
  return undefined;
}

async function ensureTrustwoodTenant() {
  const probe = await api("POST", "/api/auth", {
    body: { action: "login", email: ADMIN.email, password: ADMIN.password, tenantSlug: TENANT },
  });
  if (probe.status === 200) {
    log("Trustwood tenant ready", TENANT);
    return;
  }

  const platToken = await platformLogin();

  const created = await api("POST", "/api/platform/tenants", {
    token: platToken,
    body: {
      name: TENANT_NAME,
      slug: TENANT,
      plan: "starter",
      adminEmail: ADMIN.email,
      adminName: "Admin",
      adminPassword: ADMIN.password,
    },
  });
  if (created.status === 409) {
    log("Trustwood tenant exists", TENANT);
    return;
  }
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`Create tenant failed: ${created.status} ${created.json.error ?? ""}`);
  }

  const tenantId = (created.json.data as { tenantId?: string }).tenantId;
  log("Created Trustwood tenant", tenantId ?? TENANT);

  await api("PUT", `/api/platform/licenses/${tenantId}`, {
    token: platToken,
    body: {
      modules: [
        { moduleId: "core", plan: "basic", isActive: true },
        { moduleId: "sales", plan: "basic", isActive: true },
        { moduleId: "inventory", plan: "basic", isActive: true },
        { moduleId: "accounting", plan: "basic", isActive: true },
        { moduleId: "procurement", plan: "basic", isActive: true },
        { moduleId: "delivery", plan: "basic", isActive: true },
        { moduleId: "hr", plan: "basic", isActive: true },
      ],
    },
  });
  log("Trustwood licenses enabled");
}

async function ensureCapabilities(tenantId: string) {
  let platToken: string;
  try {
    platToken = await platformLogin();
  } catch (e) {
    warn("Capabilities skipped", e instanceof Error ? e.message : String(e));
    return;
  }
  for (const key of ["processStudio", "indiaGst"] as const) {
    const res = await api("PUT", `/api/platform/tenants/${tenantId}/capabilities`, {
      token: platToken,
      body: { key, enabled: true },
    });
    if (res.status === 200) log("Capability enabled", key);
    else warn(`Capability ${key}`, `${res.status} ${res.json.error ?? ""}`);
  }
}

async function ensureEnterprisePlan(tenantId: string) {
  let platToken: string;
  try {
    platToken = await platformLogin();
  } catch (e) {
    warn("Plan grant skipped", e instanceof Error ? e.message : String(e));
    return;
  }

  const created = await api("POST", "/api/billing/plans", {
    token: platToken,
    body: {
      code: "enterprise_monthly",
      name: "Enterprise",
      billingInterval: "MONTHLY",
      amountPaise: 100_000,
      includedSeats: 25,
      featureCodes: ENTERPRISE_FEATURES,
    },
  });
  if (created.status === 201) log("Enterprise plan created");
  else if (created.status !== 409) {
    warn("Enterprise plan", `${created.status} ${created.json.error ?? ""}`);
  }

  const grant = await api("POST", `/api/platform/tenants/${tenantId}/billing/grant`, {
    token: platToken,
    body: { planCode: "enterprise_monthly" },
  });
  if (grant.status === 200) {
    log("Enterprise plan granted");
    return;
  }
  warn("Enterprise grant", `${grant.status} ${grant.json.error ?? ""}`);
  const fallback = await api("POST", `/api/platform/tenants/${tenantId}/billing/grant`, {
    token: platToken,
    body: { planCode: "growth_monthly" },
  });
  if (fallback.status === 200) log("Growth plan granted (fallback)");
  else warn("Growth grant", `${fallback.status} ${fallback.json.error ?? ""}`);
}

async function ensureSimpleAdhesive(
  auth: Auth,
  adhesiveId: string | undefined,
  twBrand: string | undefined
): Promise<{ id: string; sku: string } | null> {
  if (!adhesiveId || !twBrand) {
    warn("Adhesive prerequisites", `category=${!!adhesiveId} brand=${!!twBrand}`);
    return null;
  }

  let existing = await findProductBySku(auth, "TW-ADH-1L");
  if (existing?.isActive === false) {
    const patched = await api("PATCH", `/api/products/${existing.id}`, {
      ...auth,
      body: { isActive: true },
    });
    if (patched.status === 200) {
      log("Reactivated Adhesive", "TW-ADH-1L");
      existing = { ...existing, isActive: true };
    } else {
      warn("Reactivate Adhesive", `${patched.status} ${patched.json.error ?? ""}`);
    }
  }
  if (existing) {
    await api("PATCH", `/api/products/${existing.id}`, {
      ...auth,
      body: { imageUrls: [MEDIA.adhesive], isActive: true },
    });
    log("Adhesive exists", "TW-ADH-1L");
    return existing;
  }

  const created = await api("POST", "/api/products", {
    ...auth,
    body: {
      sku: "TW-ADH-1L",
      name: "Trustwood Adhesive 1L",
      categoryId: adhesiveId,
      brandId: twBrand,
      unit: "pcs",
      pricingBasis: "PER_EACH",
      sellPrice: 350,
      costPrice: 220,
      imageUrls: [MEDIA.adhesive],
      reorderLevel: 10,
    },
  });
  if (created.status === 409) {
    const conflict = await findProductBySku(auth, "TW-ADH-1L");
    if (conflict) {
      if (conflict.isActive === false) {
        await api("PATCH", `/api/products/${conflict.id}`, {
          ...auth,
          body: { isActive: true },
        });
        log("Reactivated Adhesive after 409", "TW-ADH-1L");
      } else {
        log("Adhesive exists (409)", "TW-ADH-1L");
      }
      return conflict;
    }
  }
  const id = (created.json.data as { id: string } | undefined)?.id;
  if (id) {
    log("Created Adhesive", "TW-ADH-1L");
    return { id, sku: "TW-ADH-1L" };
  }
  warn("Adhesive", `${created.status} ${created.json.error ?? ""}`);
  return null;
}

async function reactivateDemoSkus(auth: Auth, warehouseId: string) {
  const list = await api("GET", "/api/products?limit=100&includeInactive=true", auth);
  const rows =
    (list.json.data as {
      id: string;
      sku: string;
      name?: string;
      isActive?: boolean;
      groupCode?: string | null;
    }[]) ?? [];
  const stock: { productId: string; quantity: number }[] = [];
  let n = 0;
  let images = 0;
  for (const p of rows) {
    const demo =
      p.sku.startsWith("TW-") ||
      (p.groupCode != null && p.groupCode.startsWith("TRUSTWOOD-"));
    if (!demo) continue;
    if (p.isActive === false) {
      const patched = await api("PATCH", `/api/products/${p.id}`, {
        ...auth,
        body: { isActive: true },
      });
      if (patched.status === 200) {
        n++;
        log("Reactivated", p.sku);
      } else warn(`Reactivate ${p.sku}`, `${patched.status}`);
    }
    const img = demoImageForSku(p.sku, p.name);
    if (img) {
      const patched = await api("PATCH", `/api/products/${p.id}`, {
        ...auth,
        body: { imageUrls: [img] },
      });
      if (patched.status === 200) images++;
    }
    stock.push({ productId: p.id, quantity: 50 });
  }
  if (n) log("Reactivated demo SKUs", String(n));
  if (images) log("Refreshed demo images", String(images));
  if (stock.length) await receiveStock(auth, warehouseId, stock);
  return n;
}

function demoImageForSku(sku: string, name?: string): string | null {
  const hay = `${sku} ${name ?? ""}`;
  if (/ADH|adhesive/i.test(hay)) return MEDIA.adhesive;
  if (/PHONE|phone/i.test(hay)) return MEDIA.phone;
  if (/LAM|laminate/i.test(hay)) return MEDIA.laminate;
  if (/BLK|blockboard/i.test(hay)) return MEDIA.blockboard;
  if (/BWP|BWR|ply/i.test(hay)) return MEDIA.plywood;
  if (/TW-/i.test(sku)) return MEDIA.plywood;
  return null;
}

async function seedBuyer(auth: Auth) {
  // register-customer via gateway auth
  const reg = await api("POST", "/api/auth?action=register-customer", {
    body: {
      name: BUYER.name,
      email: BUYER.email,
      password: BUYER.password,
      phone: BUYER.phone,
      tenantSlug: TENANT,
    },
  });
  if (reg.status === 200 || reg.status === 201) {
    log("Buyer registered", BUYER.email);
  } else if (
    String(reg.json.error ?? "").toLowerCase().includes("exist") ||
    reg.status === 409
  ) {
    const refreshed = await api("POST", `/api/tenants/${auth.tenantId}/users`, {
      ...auth,
      body: {
        action: "create",
        email: BUYER.email,
        name: BUYER.name,
        password: BUYER.password,
        role: "CUSTOMER",
      },
    });
    if (refreshed.status === 200 || refreshed.status === 201) log("Buyer password refreshed", BUYER.email);
    else log("Buyer exists", BUYER.email);
  } else {
    // try login to confirm
    const login = await api("POST", "/api/auth", {
      body: {
        action: "login",
        email: BUYER.email,
        password: BUYER.password,
        tenantSlug: TENANT,
      },
    });
    if (login.status === 200) log("Buyer login ok", BUYER.email);
    else warn("Buyer seed", `${reg.status} ${reg.json.error ?? ""} / login ${login.status}`);
  }

  // Ensure Sales customer profile linked
  const buyerLogin = await api("POST", "/api/auth", {
    body: {
      action: "login",
      email: BUYER.email,
      password: BUYER.password,
      tenantSlug: TENANT,
    },
  });
  if (buyerLogin.status === 200 && buyerLogin.json.data) {
    const bd = buyerLogin.json.data as {
      accessToken: string;
      tenant: { id: string };
      user: { role: string };
    };
    const me = await api("POST", "/api/customers/me", {
      token: bd.accessToken,
      tenantId: bd.tenant.id,
      role: bd.user.role,
      body: { name: BUYER.name, email: BUYER.email, phone: BUYER.phone },
    });
    if (me.status === 200 || me.status === 201) log("Buyer Sales profile", "linked");
    else warn("Buyer Sales profile", `${me.status} ${me.json.error ?? ""}`);
  }
}

async function main() {
  console.log(`\n=== Trustwood demo seed @ ${BASE} tenant=${TENANT} ===\n`);

  await ensureTrustwoodTenant();

  let auth = await loginAdmin();
  log("Admin logged in", `${auth.tenantId} role=${auth.role}`);

  await ensureEnterprisePlan(auth.tenantId);
  await ensureCapabilities(auth.tenantId);
  auth = await loginAdmin();
  log("Admin session refreshed", "processStudio + indiaGst on token");

  const adminRefresh = await api("POST", `/api/tenants/${auth.tenantId}/users`, {
    ...auth,
    body: {
      action: "create",
      email: ADMIN.email,
      name: "Admin",
      password: ADMIN.password,
      role: "ADMIN",
    },
  });
  if (adminRefresh.status === 200 || adminRefresh.status === 201) log("Admin password confirmed");
  else warn("Admin password refresh", `${adminRefresh.status} ${adminRefresh.json.error ?? ""}`);

  // Staff users
  const existingUsers = await api("GET", `/api/tenants/${auth.tenantId}/users?limit=100`, auth);
  const members = (existingUsers.json.data as { user?: { email: string }; role: string }[]) ?? [];
  const emails = new Set(members.map((m) => m.user?.email?.toLowerCase()).filter(Boolean));
  for (const u of DEMO_USERS) {
    const created = await api("POST", `/api/tenants/${auth.tenantId}/users`, {
      ...auth,
      body: {
        action: "create",
        email: u.email,
        name: u.name,
        password: u.password,
        role: u.role,
      },
    });
    if (created.status === 201 || created.status === 200) {
      log(emails.has(u.email.toLowerCase()) ? "User password refreshed" : "Created user", `${u.email} → ${u.role}`);
    } else warn(`Create user ${u.email}`, `${created.status} ${created.json.error ?? ""}`);
  }

  // Plywood industry template
  const tpl = await api("POST", "/api/attribute-templates", {
    ...auth,
    body: { templateId: "industry.plywood", createCategories: true },
  });
  if (tpl.status === 200 || tpl.status === 201) log("Applied industry.plywood template");
  else warn("attribute-templates", `${tpl.status} ${tpl.json.error ?? ""}`);

  const catsRes = await api("GET", "/api/products/categories?limit=50", auth);
  const categories = (catsRes.json.data as { id: string; name: string }[]) ?? [];
  const catByName = new Map(categories.map((c) => [c.name, c.id]));

  // Fallback category list endpoint
  if (!catByName.size) {
    const alt = await api("GET", "/api/categories?limit=50", auth);
    for (const c of (alt.json.data as { id: string; name: string }[]) ?? []) {
      catByName.set(c.name, c.id);
    }
  }

  for (const name of ["Plywood", "Blockboard", "Laminates", "Phones", "Adhesives"]) {
    await ensureCategory(auth, name, catByName);
  }

  const brandsRes = await api("GET", "/api/brands?limit=50", auth);
  const brands = (brandsRes.json.data as { id: string; name: string }[]) ?? [];
  const brandByName = new Map(brands.map((b) => [b.name, b.id]));
  for (const name of ["Trustwood", "Century", "Merino"]) {
    await ensureBrand(auth, name, brandByName);
  }

  const plywoodId = catByName.get("Plywood");
  const blockId = catByName.get("Blockboard");
  const lamId = catByName.get("Laminates");
  const phoneId = catByName.get("Phones");
  const adhesiveId = catByName.get("Adhesives") ?? catByName.get("Plywood");
  const twBrand = brandByName.get("Trustwood");
  const centuryBrand = brandByName.get("Century") ?? twBrand;
  const merinoBrand = brandByName.get("Merino") ?? twBrand;

  // Identity attrs for wood + laminate finish + phone
  for (const key of ["grade", "thickness_mm", "size"] as const) {
    await ensureAttr(auth, {
      key,
      label: key,
      dataType: "SELECT",
      isIdentity: true,
    });
  }
  await ensureAttr(auth, {
    key: "finish",
    label: "Finish",
    dataType: "SELECT",
    options: ["Glossy", "Matt"],
    isIdentity: true,
    categoryIds: lamId ? [lamId] : undefined,
  });
  await ensureAttr(auth, {
    key: "color",
    label: "Color",
    dataType: "SELECT",
    options: ["Black", "Blue"],
    isIdentity: true,
    categoryIds: phoneId ? [phoneId] : undefined,
  });
  await ensureAttr(auth, {
    key: "storage_gb",
    label: "Storage",
    dataType: "SELECT",
    options: ["128", "256"],
    isIdentity: true,
    categoryIds: phoneId ? [phoneId] : undefined,
  });

  const stockItems: { productId: string; quantity: number }[] = [];
  let groupsCreated = 0;
  let productsCreated = 0;

  // --- TRUSTWOOD-BWP (PER_AREA) — images by size ---
  if (plywoodId && (twBrand || centuryBrand)) {
    const sizeOrder = ["size"];
    const r = await createGroup(auth, {
      categoryId: plywoodId,
      brandId: twBrand ?? centuryBrand,
      axes: { grade: ["BWP"], thickness_mm: ["18"], size: ["8x4", "7x3"] },
      skuTemplate: "TW-BWP-{thickness_mm}-{size}",
      nameTemplate: "Trustwood BWP {thickness_mm}mm {size}",
      productName: "Trustwood BWP Plywood",
      groupCode: "TRUSTWOOD-BWP",
      groupName: "Trustwood BWP Plywood",
      pricingBasis: "PER_AREA",
      pricingUom: "sq_ft",
      baseRate: 85,
      media: {
        images: [MEDIA.plywood],
        variation: {
          type: "CONFIGURATION",
          attributes: sizeOrder,
          values: {
            [buildVariationKey(sizeOrder, { size: "8x4" })]: [MEDIA.plywood],
            [buildVariationKey(sizeOrder, { size: "7x3" })]: [MEDIA.plywood],
          },
        },
      },
    });
    groupsCreated++;
    productsCreated += r.created;
    for (const p of r.ids) stockItems.push({ productId: p.id, quantity: /7x3/i.test(p.sku) ? 40 : 80 });
  }

  // --- TRUSTWOOD-BLOCKBOARD ---
  if (blockId && (twBrand || centuryBrand)) {
    const sizeOrder = ["size"];
    const r = await createGroup(auth, {
      categoryId: blockId,
      brandId: twBrand ?? centuryBrand,
      axes: { grade: ["BWR", "Commercial"], thickness_mm: ["18", "19"], size: ["8x4", "6x3"] },
      skuTemplate: "TW-BLK-{grade}-{thickness_mm}-{size}",
      nameTemplate: "Trustwood Blockboard {grade} {thickness_mm}mm {size}",
      productName: "Trustwood Blockboard",
      groupCode: "TRUSTWOOD-BLOCKBOARD",
      groupName: "Trustwood Blockboard",
      pricingBasis: "PER_AREA",
      pricingUom: "sq_ft",
      baseRate: 50,
      media: {
        images: [MEDIA.blockboard],
        variation: {
          type: "CONFIGURATION",
          attributes: sizeOrder,
          values: {
            [buildVariationKey(sizeOrder, { size: "8x4" })]: [MEDIA.blockboard],
            [buildVariationKey(sizeOrder, { size: "6x3" })]: [MEDIA.blockboard],
          },
        },
      },
    });
    groupsCreated++;
    productsCreated += r.created;
    for (const p of r.ids) stockItems.push({ productId: p.id, quantity: 60 });
  }

  // --- TRUSTWOOD-LAMINATE — images by finish ---
  if (lamId && (twBrand || merinoBrand)) {
    const finishOrder = ["finish"];
    const r = await createGroup(auth, {
      categoryId: lamId,
      brandId: twBrand ?? merinoBrand,
      axes: { finish: ["Glossy", "Matt"], thickness_mm: ["1"], size: ["8x4"] },
      skuTemplate: "TW-LAM-{finish}-{thickness_mm}-{size}",
      nameTemplate: "Trustwood Laminate {finish} {thickness_mm}mm {size}",
      productName: "Trustwood Laminates",
      groupCode: "TRUSTWOOD-LAMINATE",
      groupName: "Trustwood Laminates",
      pricingBasis: "PER_AREA",
      pricingUom: "sq_ft",
      baseRate: 12,
      media: {
        images: [MEDIA.laminate],
        variation: {
          type: "CONFIGURATION",
          attributes: finishOrder,
          values: {
            [buildVariationKey(finishOrder, { finish: "Glossy" })]: [MEDIA.laminate],
            [buildVariationKey(finishOrder, { finish: "Matt" })]: [MEDIA.laminate],
          },
        },
      },
    });
    groupsCreated++;
    productsCreated += r.created;
    for (const p of r.ids) stockItems.push({ productId: p.id, quantity: 200 });
  }

  // --- TRUSTWOOD-PHONE — PER_EACH, images by color ---
  if (phoneId && twBrand) {
    const colorOrder = ["color"];
    const r = await createGroup(auth, {
      categoryId: phoneId,
      brandId: twBrand,
      axes: { color: ["Black", "Blue"], storage_gb: ["128", "256"] },
      skuTemplate: "TW-PHONE-{color}-{storage_gb}",
      nameTemplate: "Trustwood Phone {color} {storage_gb}GB",
      productName: "Trustwood Phone",
      groupCode: "TRUSTWOOD-PHONE",
      groupName: "Trustwood Phone",
      pricingBasis: "PER_EACH",
      sellPrice: 49999,
      baseRate: 49999,
      pricingPolicy: {
        type: "CONFIGURATION",
        attribute: "storage_gb",
        values: { "128": 49999, "256": 59999 },
      },
      media: {
        images: [MEDIA.phone],
        variation: {
          type: "CONFIGURATION",
          attributes: colorOrder,
          values: {
            [buildVariationKey(colorOrder, { color: "Black" })]: [MEDIA.phone],
            [buildVariationKey(colorOrder, { color: "Blue" })]: [MEDIA.phone],
          },
        },
      },
    });
    groupsCreated++;
    productsCreated += r.created;
    for (const p of r.ids) stockItems.push({ productId: p.id, quantity: 25 });
  }

  // --- Simple Adhesive (no axes) — search/reactivate/create ---
  const adhesive = await ensureSimpleAdhesive(auth, adhesiveId, twBrand);
  if (adhesive) stockItems.push({ productId: adhesive.id, quantity: 100 });

  // Warehouse + stock
  let warehouseId: string | undefined;
  const whRes = await api("GET", "/api/warehouses?limit=20", auth);
  const warehouses = (whRes.json.data as { id: string; name: string }[]) ?? [];
  warehouseId = warehouses[0]?.id;
  if (!warehouseId) {
    const created = await api("POST", "/api/warehouses", {
      ...auth,
      body: { name: "Main Warehouse", location: "Demo Yard" },
    });
    warehouseId = (created.json.data as { id: string } | undefined)?.id;
  }
  if (!warehouseId) throw new Error("No warehouse");
  log("Warehouse", warehouseId);

  // Soft-deleted demo SKUs block re-create (409) — reactivate instead
  const reactivated = await reactivateDemoSkus(auth, warehouseId);
  if (reactivated > 0) productsCreated += reactivated;

  await receiveStock(auth, warehouseId, stockItems);

  // For skipped SKUs (re-seed), still stock by group search
  const all = await api("GET", "/api/products?limit=200", auth);
  const allProducts = (all.json.data as { id: string; sku: string; groupCode?: string }[]) ?? [];
  const needStock = allProducts.filter(
    (p) =>
      p.groupCode?.startsWith("TRUSTWOOD-") ||
      p.sku === "TW-ADH-1L"
  );
  if (needStock.length && stockItems.length === 0) {
    await receiveStock(
      auth,
      warehouseId,
      needStock.map((p) => ({ productId: p.id, quantity: 50 }))
    );
  }

  await seedBuyer(auth);

  const adhesiveCheck = await findProductBySku(auth, "TW-ADH-1L");
  if (!adhesiveCheck?.id) {
    throw new Error("TW-ADH-1L missing after seed — portal E2E requires this SKU");
  }
  log("Verified Adhesive", "TW-ADH-1L");

  // Workflow, forms, print widgets, OMS trading pack
  const forms = await api("POST", "/api/workflow-forms", { ...auth, body: { action: "seed" } });
  if (forms.status === 200 || forms.status === 201) {
    const n = Array.isArray(forms.json.data) ? forms.json.data.length : 0;
    log("Starter forms seeded", `${n} versions`);
  } else warn("workflow-forms seed", `${forms.status} ${forms.json.error ?? ""}`);

  const templates = await api("POST", "/api/workflow-templates", { ...auth, body: { action: "seed" } });
  if (templates.status === 200 || templates.status === 201) {
    const n = Array.isArray(templates.json.data) ? templates.json.data.length : 0;
    log("SO_STANDARD template seeded", `${n} versions`);
  } else warn("workflow-templates seed", `${templates.status} ${templates.json.error ?? ""}`);

  const docs = await api("POST", "/api/workflow-documents", { ...auth, body: { action: "seed" } });
  if (docs.status === 200 || docs.status === 201) {
    const n = Array.isArray(docs.json.data) ? docs.json.data.length : 0;
    log("Tax invoice document seeded", `${n} versions`);
  } else warn("workflow-documents seed", `${docs.status} ${docs.json.error ?? ""}`);

  const oms = await api("POST", "/api/order-workflows", {
    ...auth,
    body: { templateId: "workflow.oms_trading", setDefault: true },
  });
  if (oms.status === 200 || oms.status === 201) log("OMS Trading workflow set as default");
  else warn("order-workflows", `${oms.status} ${oms.json.error ?? ""}`);

  const upgrade = await api("POST", "/api/workflow-forms", {
    ...auth,
    body: { action: "upgrade-starters", dryRun: false },
  });
  if (upgrade.status === 200) log("Starter forms upgraded to latest widgets");
  else warn("upgrade-starters", `${upgrade.status} ${upgrade.json.error ?? ""}`);

  await api("PUT", `/api/tenants/${auth.tenantId}/settings`, {
    ...auth,
    body: {
      "logistics.porter.enabled": "true",
      "logistics.porter.bookUrl": "https://porter.in/",
    },
  });
  log("Porter logistics settings");

  console.log(`\n--- seed summary ---`);
  console.log(`Groups touched:   ${groupsCreated}`);
  console.log(`Products created: ${productsCreated} (plus skips if re-run)`);
  console.log(`Buyer:            ${BUYER.email} / ${BUYER.password}`);
  console.log(`Done.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
