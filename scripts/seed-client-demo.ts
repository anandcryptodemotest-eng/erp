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

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";

const ADMIN = { email: "admin@simhapurifresh.com", password: "Admin@123" };

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
  timber: "/media/products/timber.jpg",
  laminate: "/media/products/laminate.jpg",
  warehouse: "/media/products/warehouse.jpg",
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

async function reactivateDemoSkus(auth: Auth, warehouseId: string) {
  const list = await api("GET", "/api/products?limit=100&includeInactive=true", auth);
  const rows =
    (list.json.data as { id: string; sku: string; isActive?: boolean; groupCode?: string | null }[]) ??
    [];
  const stock: { productId: string; quantity: number }[] = [];
  let n = 0;
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
    stock.push({ productId: p.id, quantity: 50 });
  }
  if (n) log("Reactivated demo SKUs", String(n));
  if (stock.length) await receiveStock(auth, warehouseId, stock);
  return n;
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
  const auth: Auth = {
    token: data.accessToken,
    tenantId: data.tenant.id,
    role: data.user.role ?? "ADMIN",
  };
  log("Admin logged in", `${auth.tenantId} role=${auth.role}`);

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
            [buildVariationKey(sizeOrder, { size: "7x3" })]: [MEDIA.timber],
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
        images: [MEDIA.timber],
        variation: {
          type: "CONFIGURATION",
          attributes: sizeOrder,
          values: {
            [buildVariationKey(sizeOrder, { size: "8x4" })]: [MEDIA.timber],
            [buildVariationKey(sizeOrder, { size: "6x3" })]: [MEDIA.warehouse],
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
            [buildVariationKey(finishOrder, { finish: "Matt" })]: [MEDIA.hero],
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
        images: [MEDIA.warehouse],
        variation: {
          type: "CONFIGURATION",
          attributes: colorOrder,
          values: {
            [buildVariationKey(colorOrder, { color: "Black" })]: [MEDIA.warehouse],
            [buildVariationKey(colorOrder, { color: "Blue" })]: [MEDIA.hero],
          },
        },
      },
    });
    groupsCreated++;
    productsCreated += r.created;
    for (const p of r.ids) stockItems.push({ productId: p.id, quantity: 25 });
  }

  // --- Simple Adhesive (no axes) ---
  if (adhesiveId && twBrand) {
    const list = await api("GET", "/api/products?search=TW-ADH-1L&limit=5", auth);
    const existing = ((list.json.data as { id: string; sku: string }[]) ?? []).find(
      (p) => p.sku === "TW-ADH-1L"
    );
    if (existing) {
      log("Adhesive exists", "TW-ADH-1L");
      stockItems.push({ productId: existing.id, quantity: 100 });
    } else {
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
          imageUrls: [MEDIA.warehouse],
          reorderLevel: 10,
        },
      });
      const id = (created.json.data as { id: string } | undefined)?.id;
      if (id) {
        log("Created Adhesive", "TW-ADH-1L");
        productsCreated++;
        stockItems.push({ productId: id, quantity: 100 });
      } else {
        warn("Adhesive", `${created.status} ${created.json.error ?? ""}`);
      }
    }
  }

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

  // Workflow
  await api("POST", "/api/workflow-forms", { ...auth, body: { action: "seed" } });
  await api("POST", "/api/workflow-templates", { ...auth, body: { action: "seed" } });
  await api("POST", "/api/order-workflows", {
    ...auth,
    body: { templateId: "workflow.oms_trading", setDefault: true },
  });
  log("Workflow + forms seeded");

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
