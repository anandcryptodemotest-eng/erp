/**
 * Client demo seed — multi-category plywood industry catalog + OMS users + workflow.
 *
 * Primary Platform v1.0 story: POST /api/products (axes) → SIMPLE SKUs (Century BWP plywood).
 * Also seeds legacy flat SKUs and an optional VARIANT family (retail demo).
 *
 *   pnpm seed:demo
 *
 * Idempotent: safe to re-run. Tenant default: trustwood-enterprise.
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

const BRANDS = ["Greenply", "Century", "Kitply", "Merino"] as const;

type ProductSpec = {
  sku: string;
  name: string;
  category: "Plywood" | "Blockboard" | "Laminates";
  brand: (typeof BRANDS)[number];
  costPrice: number;
  sellPrice: number;
  customAttributes: Record<string, string | number>;
  qty: number;
};

/** Derive sq ft from size like "8x4" (feet). */
function areaSqFt(size: unknown): number | null {
  if (typeof size !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(size.trim());
  if (!m) return null;
  const a = Number(m[1]) * Number(m[2]);
  return Number.isFinite(a) && a > 0 ? a : null;
}

function pricingFields(spec: ProductSpec) {
  const area = areaSqFt(spec.customAttributes.size);
  if (!area) return { pricingBasis: "PER_EACH" as const };
  return {
    pricingBasis: "PER_AREA" as const,
    pricingUom: "sq_ft",
    baseRate: Math.round((spec.sellPrice / area) * 10000) / 10000,
  };
}

const PRODUCTS: ProductSpec[] = [
  {
    sku: "PLY-BWR-18-8X4",
    name: "Marine Ply 18mm BWR 8x4",
    category: "Plywood",
    brand: "Greenply",
    costPrice: 1200,
    sellPrice: 1450,
    customAttributes: { thickness_mm: 18, size: "8x4", grade: "BWR" },
    qty: 120,
  },
  // Century BWP 18mm sizes come from POST /api/products with axes (primary Platform v1.0 story).
  {
    sku: "PLY-MR-12-8X4",
    name: "Commercial Ply 12mm MR 8x4",
    category: "Plywood",
    brand: "Kitply",
    costPrice: 780,
    sellPrice: 950,
    customAttributes: { thickness_mm: 12, size: "8x4", grade: "MR" },
    qty: 150,
  },
  {
    sku: "PLY-BWR-16-7X3",
    name: "Structural Ply 16mm BWR 7x3",
    category: "Plywood",
    brand: "Greenply",
    costPrice: 980,
    sellPrice: 1180,
    customAttributes: { thickness_mm: 16, size: "7x3", grade: "BWR" },
    qty: 90,
  },
  {
    sku: "BLK-COM-19-8X4",
    name: "Blockboard 19mm Commercial 8x4",
    category: "Blockboard",
    brand: "Century",
    costPrice: 1100,
    sellPrice: 1320,
    customAttributes: { thickness_mm: 19, size: "8x4", grade: "Commercial" },
    qty: 60,
  },
  {
    sku: "BLK-BWR-18-8X4",
    name: "Blockboard 18mm BWR 8x4",
    category: "Blockboard",
    brand: "Greenply",
    costPrice: 1250,
    sellPrice: 1490,
    customAttributes: { thickness_mm: 18, size: "8x4", grade: "BWR" },
    qty: 55,
  },
  {
    sku: "LAM-GLOSS-1MM-8X4",
    name: "Laminate Glossy 1mm 8x4",
    category: "Laminates",
    brand: "Merino",
    costPrice: 320,
    sellPrice: 420,
    customAttributes: { thickness_mm: 1, size: "8x4", finish: "Glossy" },
    qty: 200,
  },
  {
    sku: "LAM-MATTE-1MM-8X4",
    name: "Laminate Matt 1mm 8x4",
    category: "Laminates",
    brand: "Merino",
    costPrice: 300,
    sellPrice: 390,
    customAttributes: { thickness_mm: 1, size: "8x4", finish: "Matt" },
    qty: 200,
  },
];

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

async function main() {
  console.log(`\n=== Client demo seed @ ${BASE} tenant=${TENANT} ===\n`);

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
  const token = data.accessToken;
  const tenantId = data.tenant.id;
  const role = data.user.role ?? "ADMIN";
  const auth = { token, tenantId, role };
  log("Admin logged in", `${tenantId} role=${role}`);

  // Users
  const existingUsers = await api("GET", `/api/tenants/${tenantId}/users?limit=100`, auth);
  const members = (existingUsers.json.data as { user?: { email: string }; role: string }[]) ?? [];
  const emails = new Set(members.map((m) => m.user?.email?.toLowerCase()).filter(Boolean));

  for (const u of DEMO_USERS) {
    if (emails.has(u.email.toLowerCase())) {
      log(`User exists`, `${u.email} (${u.role})`);
      continue;
    }
    const created = await api("POST", `/api/tenants/${tenantId}/users`, {
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
      log(`Created user`, `${u.email} → ${u.role}`);
    } else {
      warn(`Create user ${u.email}`, `${created.status} ${created.json.error ?? ""}`);
    }
  }

  // Industry template → categories + attrs
  const tpl = await api("POST", "/api/attribute-templates", {
    ...auth,

    body: { templateId: "industry.plywood", createCategories: true },
  });
  if (tpl.status === 200 || tpl.status === 201) {
    log("Applied industry.plywood template");
  } else {
    warn("attribute-templates", `${tpl.status} ${tpl.json.error ?? ""}`);
  }

  const catsRes = await api("GET", "/api/categories?limit=50", auth);
  const categories = (catsRes.json.data as { id: string; name: string }[]) ?? [];
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  for (const name of ["Plywood", "Blockboard", "Laminates"]) {
    if (!catByName.has(name)) warn(`Missing category`, name);
    else log(`Category`, `${name}=${catByName.get(name)}`);
  }

  // Brands
  const brandsRes = await api("GET", "/api/brands?limit=50", auth);
  const brands = (brandsRes.json.data as { id: string; name: string }[]) ?? [];
  const brandByName = new Map(brands.map((b) => [b.name, b.id]));
  for (const name of BRANDS) {
    if (brandByName.has(name)) {
      log(`Brand exists`, name);
      continue;
    }
    const created = await api("POST", "/api/brands", {
      ...auth,
      body: { name },
    });
    const b = created.json.data as { id: string; name: string } | undefined;
    if (b?.id) {
      brandByName.set(b.name, b.id);
      log(`Created brand`, name);
    } else {
      warn(`Brand ${name}`, `${created.status} ${created.json.error ?? ""}`);
    }
  }

  // Ensure identity attrs for fingerprint duplicate detection (brand + isIdentity attrs)
  const IDENTITY_KEYS = ["grade", "thickness_mm", "size"] as const;
  const attrsRes = await api("GET", "/api/attribute-definitions", auth);
  const attrDefs =
    (attrsRes.json.data as { id: string; key: string; isIdentity?: boolean }[]) ?? [];
  for (const key of IDENTITY_KEYS) {
    const def = attrDefs.find((a) => a.key === key);
    if (!def) {
      warn(`Missing attribute`, key);
      continue;
    }
    if (def.isIdentity) {
      log(`Identity attr`, key);
      continue;
    }
    const patched = await api("PATCH", `/api/attribute-definitions/${def.id}`, {
      ...auth,
      body: { isIdentity: true },
    });
    if (patched.status === 200) log(`Set isIdentity`, key);
    else warn(`isIdentity ${key}`, `${patched.status} ${patched.json.error ?? ""}`);
  }

  // Primary Platform v1.0 story: Multiple Products generate → SIMPLE SKUs
  const plywoodCatId = catByName.get("Plywood");
  const centuryBrandId = brandByName.get("Century");
  let generatedCreated = 0;
  let generatedSkipped = 0;
  const generatedProductIds: { id: string; sku: string }[] = [];

  if (plywoodCatId && centuryBrandId) {
    const gen = await api("POST", "/api/products", {
      ...auth,
      body: {
        categoryId: plywoodCatId,
        brandId: centuryBrandId,
        axes: {
          grade: ["BWP"],
          thickness_mm: ["18"],
          size: ["8x4", "7x3"],
        },
        skuTemplate: "PLY-{brand}-{grade}-{thickness_mm}-{size}",
        nameTemplate: "{brand} {grade} {thickness_mm}mm {size}",
        productName: "Century BWP Plywood",
        groupCode: "CENTURY-BWP",
        groupName: "Century BWP Plywood",
        pricingBasis: "PER_AREA",
        pricingUom: "sq_ft",
        baseRate: 85,
      },
    });
    // Prefer engine façade when available; generate remains compat
    // (seed historically used /api/products/generate — still valid)
    const payload = gen.json.data as
      | {
          created?: { id: string; sku: string }[];
          skipped?: { sku: string; existingSku?: string }[];
          summary?: { createdCount?: number; skippedCount?: number; willCreate?: number; duplicates?: number };
        }
      | undefined;
    generatedCreated = payload?.summary?.createdCount ?? payload?.created?.length ?? 0;
    generatedSkipped = payload?.summary?.skippedCount ?? payload?.skipped?.length ?? 0;
    for (const p of payload?.created ?? []) generatedProductIds.push({ id: p.id, sku: p.sku });
    if (gen.status === 201 || gen.status === 200) {
      log(
        "POST /api/products (PRIMARY)",
        `${generatedCreated} created, ${generatedSkipped} skipped (Century BWP plywood)`
      );
      for (const p of payload?.created ?? []) log(`  SIMPLE SKU`, p.sku);
    } else {
      warn(
        "POST /api/products",
        `${gen.status} ${gen.json.error ?? ""} ${JSON.stringify((gen.json as { issues?: unknown }).issues ?? "")}`
      );
    }

    // Ensure existing Century BWP plywood SKUs share the customer catalog group
    const groupPatch = await api("GET", "/api/products?search=BWP&limit=50", auth);
    const bwpProducts = (groupPatch.json.data as { id: string; sku: string; groupCode?: string | null }[]) ?? [];
    for (const p of bwpProducts) {
      if (p.groupCode === "CENTURY-BWP") continue;
      if (!/BWP/i.test(p.sku) && !/ply/i.test(p.sku)) continue;
      const patched = await api("PATCH", `/api/products/${p.id}`, {
        ...auth,
        body: { groupCode: "CENTURY-BWP", groupName: "Century BWP Plywood" },
      });
      if (patched.status === 200) log(`groupCode set`, p.sku);
    }
  } else {
    warn("products create skipped", "missing Plywood category or Century brand");
  }

  // Warehouse
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
    if (warehouseId) log("Created warehouse", warehouseId);
    else throw new Error(`Warehouse create failed: ${created.status} ${created.json.error}`);
  } else {
    log("Warehouse", `${warehouses[0].name}=${warehouseId}`);
  }

  // Products + stock (legacy multi-brand flat catalog; Century BWP sizes come from generate above)
  const prodList = await api("GET", "/api/products?limit=100", auth);
  const existingProducts = (prodList.json.data as { id: string; sku: string }[]) ?? [];
  const bySku = new Map(existingProducts.map((p) => [p.sku, p.id]));

  const receiveItems: { productId: string; warehouseId: string; quantity: number }[] = [];

  for (const p of generatedProductIds) {
    bySku.set(p.sku, p.id);
  }
  // Stock generated Century BWP SIMPLE SKUs (created this run or already present)
  const generatedSkus = new Set(generatedProductIds.map((p) => p.sku));
  for (const p of existingProducts) {
    if (/^PLY-C-BWP-18-(8X4|7X3)$/i.test(p.sku)) generatedSkus.add(p.sku);
  }
  for (const sku of generatedSkus) {
    const productId = bySku.get(sku);
    if (!productId) continue;
    receiveItems.push({
      productId,
      warehouseId: warehouseId!,
      quantity: /7X3/i.test(sku) ? 40 : 80,
    });
  }

  for (const spec of PRODUCTS) {
    const categoryId = catByName.get(spec.category);
    const brandId = brandByName.get(spec.brand);
    if (!categoryId || !brandId) {
      warn(`Skip ${spec.sku}`, `missing category=${spec.category} or brand=${spec.brand}`);
      continue;
    }

    let productId = bySku.get(spec.sku);
    const pricing = pricingFields(spec);
    if (!productId) {
      const created = await api("POST", "/api/products", {
        ...auth,
        body: {
          sku: spec.sku,
          name: spec.name,
          unit: "pcs",
          categoryId,
          brandId,
          costPrice: spec.costPrice,
          sellPrice: spec.sellPrice,
          ...pricing,
          reorderLevel: 10,
          hsnCode: spec.category === "Laminates" ? "4823" : "4412",
          customAttributes: spec.customAttributes,
        },
      });
      productId = (created.json.data as { id: string } | undefined)?.id;
      if (!productId) {
        warn(`Product ${spec.sku}`, `${created.status} ${created.json.error ?? ""}`);
        continue;
      }
      log(`Created product`, `${spec.sku} [${spec.category}] ${pricing.pricingBasis}`);
    } else {
      await api("PATCH", `/api/products/${productId}`, {
        ...auth,
        body: { sellPrice: spec.sellPrice, ...pricing },
      });
      log(`Product exists (pricing refreshed)`, spec.sku);
    }

    receiveItems.push({ productId, warehouseId: warehouseId!, quantity: spec.qty });
  }

  // Optional retail demo: VARIANT family (secondary to SIMPLE generate above)
  const familySku = "PLY-BWP-18-FAMILY";
  let familyId = bySku.get(familySku);
  const plywoodCat = catByName.get("Plywood");
  const centuryId = brandByName.get("Century");
  if (plywoodCat && centuryId) {
    if (!familyId) {
      const created = await api("POST", "/api/products", {
        ...auth,
        body: {
          sku: familySku,
          name: "BWP Plywood 18 mm",
          unit: "pcs",
          categoryId: plywoodCat,
          brandId: centuryId,
          costPrice: null,
          sellPrice: null,
          pricingBasis: "PER_AREA",
          pricingUom: "sq_ft",
          baseRate: 50,
          productStructure: "VARIANT",
          variantAxes: ["size"],
          reorderLevel: 10,
          hsnCode: "4412",
          customAttributes: { thickness_mm: 18, grade: "BWP" },
        },
      });
      familyId = (created.json.data as { id: string } | undefined)?.id;
      if (familyId) log("Created VARIANT family", familySku);
      else warn("VARIANT family", `${created.status} ${created.json.error ?? ""}`);
    } else {
      await api("PATCH", `/api/products/${familyId}`, {
        ...auth,
        body: {
          productStructure: "VARIANT",
          variantAxes: ["size"],
          pricingBasis: "PER_AREA",
          pricingUom: "sq_ft",
          baseRate: 50,
          sellPrice: null,
        },
      });
      log("VARIANT family exists", familySku);
    }

    if (familyId) {
      const gen = await api("POST", `/api/products/${familyId}/variants`, {
        ...auth,
        body: {
          generate: true,
          axes: { size: ["8x4", "7x3"] },
          costPrice: 1400,
        },
      });
      const variants =
        (gen.json.data as { id: string; sku: string; attributes?: { size?: string } }[]) ?? [];
      if (variants.length) {
        log("Generated variants", variants.map((v) => v.sku).join(", "));
        const variantReceive = variants.map((v) => ({
          productId: familyId!,
          warehouseId: warehouseId!,
          variantId: v.id,
          quantity: v.attributes?.size === "7x3" ? 40 : 80,
        }));
        const recvV = await api("POST", "/api/stock/receive", {
          ...auth,
          body: {
            items: variantReceive,
            reference: `DEMO-VARIANT-${Date.now()}`,
            notes: "Variant opening stock",
          },
        });
        if (recvV.status === 201 || recvV.status === 200) {
          log("Received variant stock", `${variantReceive.length} variants`);
        } else {
          warn("variant stock/receive", `${recvV.status} ${recvV.json.error ?? ""}`);
        }
      } else {
        warn("variant generate", `${gen.status} ${gen.json.error ?? ""}`);
      }
    }
  }

  if (receiveItems.length) {
    const recv = await api("POST", "/api/stock/receive", {
      ...auth,
      body: {
        items: receiveItems,
        reference: `DEMO-SEED-${Date.now()}`,
        notes: "Client demo opening stock",
      },
    });
    if (recv.status === 201 || recv.status === 200) {
      log("Received stock", `${receiveItems.length} SKUs`);
    } else {
      warn("stock/receive", `${recv.status} ${recv.json.error ?? ""}`);
    }
  }

  // Workflow + forms
  const formsSeed = await api("POST", "/api/workflow-forms", {
    ...auth,

    body: { action: "seed" },
  });
  log("Forms seed", `${formsSeed.status}`);

  const wfSeed = await api("POST", "/api/workflow-templates", {
    ...auth,

    body: { action: "seed" },
  });
  log("Workflow templates seed", `${wfSeed.status}`);

  const bind = await api("POST", "/api/order-workflows", {
    ...auth,

    body: { templateId: "workflow.oms_trading", setDefault: true },
  });
  log("OMS trading binding", `${bind.status}`);

  console.log(`\n=== Demo seed complete ===`);
  console.log(`Admin:  ${BASE}  (tenant ${TENANT})`);
  console.log(
    `PRIMARY: POST /api/products → ${generatedCreated} created, ${generatedSkipped} skipped (Century BWP plywood)`
  );
  console.log(`Also: ${PRODUCTS.length} legacy flat SKUs + optional VARIANT family`);
  console.log(`See docs/DEMO-WALKTHROUGH.md for the client click-path.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
