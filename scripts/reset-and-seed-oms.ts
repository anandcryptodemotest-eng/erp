/**
 * Wipe all ERP service DBs and seed a clean OMS multi-user demo.
 *
 * Run (services can stay up):
 *   pnpm --filter @erp/scripts reset:oms
 *
 * Users (tenant: simhapuri-fresh / password Admin@123 for admin, Test@123 for others):
 *   admin@simhapurifresh.com     ADMIN
 *   sales@oms.test               SALES_EXECUTIVE
 *   pricing@oms.test             PRICING_EXECUTIVE
 *   dispatch@oms.test            DISPATCH_EXECUTIVE
 *   delivery@oms.test            DELIVERY_EXECUTIVE
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function parseEnv(filePath: string): Record<string, string> {
  try {
    const text = readFileSync(filePath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const gatewayEnv = parseEnv(resolve(root, "apps/gateway/.env"));
const inventoryEnv = parseEnv(resolve(root, "apps/inventory/.env"));
const salesEnv = parseEnv(resolve(root, "apps/sales/.env"));
const procurementEnv = parseEnv(resolve(root, "apps/procurement/.env"));
const accountingEnv = parseEnv(resolve(root, "apps/accounting/.env"));

function requireUrl(env: Record<string, string>, label: string): string {
  const url = env["DATABASE_URL"];
  if (!url) throw new Error(`Missing DATABASE_URL for ${label}`);
  return url;
}

const { PrismaClient: GatewayPrisma } = await import("../apps/gateway/src/generated/prisma/index.js");
const { PrismaClient: InventoryPrisma } = await import("../apps/inventory/src/generated/prisma/index.js");
const { PrismaClient: SalesPrisma } = await import("../apps/sales/src/generated/prisma/index.js");
const { PrismaClient: ProcurementPrisma } = await import("../apps/procurement/src/generated/prisma/index.js");

let AccountingPrisma: new (args?: { datasources?: { db?: { url: string } } }) => {
  $disconnect: () => Promise<void>;
  $executeRawUnsafe: (q: string) => Promise<unknown>;
} | null = null;
try {
  AccountingPrisma = (await import("../apps/accounting/src/generated/prisma/index.js")).PrismaClient;
} catch {
  AccountingPrisma = null;
}

const gwDb = new GatewayPrisma({ datasources: { db: { url: requireUrl(gatewayEnv, "gateway") } } });
const invDb = new InventoryPrisma({ datasources: { db: { url: requireUrl(inventoryEnv, "inventory") } } });
const salesDb = new SalesPrisma({ datasources: { db: { url: requireUrl(salesEnv, "sales") } } });
const procDb = new ProcurementPrisma({
  datasources: { db: { url: requireUrl(procurementEnv, "procurement") } },
});
const accDb = AccountingPrisma
  ? new AccountingPrisma({ datasources: { db: { url: requireUrl(accountingEnv, "accounting") } } })
  : null;

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function wipe() {
  console.log("\n[1/4] Wiping databases…");

  // Sales (child tables first via cascade where defined)
  await salesDb.orderDocument.deleteMany();
  await salesDb.orderModification.deleteMany();
  await salesDb.salesReturnItem.deleteMany();
  await salesDb.salesReturn.deleteMany();
  await salesDb.salesOrderItem.deleteMany();
  await salesDb.salesOrder.deleteMany();
  await salesDb.orderWorkflowStep.deleteMany();
  await salesDb.orderWorkflow.deleteMany();
  await salesDb.quoteItem.deleteMany();
  await salesDb.quote.deleteMany();
  await salesDb.activity.deleteMany();
  await salesDb.opportunity.deleteMany();
  await salesDb.lead.deleteMany();
  await salesDb.customerAddress.deleteMany();
  await salesDb.customer.deleteMany();
  log("sales wiped");

  await procDb.vendorMessage.deleteMany();
  await procDb.vendorRequestItem.deleteMany();
  await procDb.vendorRequest.deleteMany();
  await procDb.productVendor.deleteMany();
  await procDb.purchaseReturnItem.deleteMany();
  await procDb.purchaseReturn.deleteMany();
  await procDb.purchaseOrderItem.deleteMany();
  await procDb.purchaseOrder.deleteMany();
  await procDb.vendor.deleteMany();
  log("procurement wiped");

  await invDb.productAttributeIndex.deleteMany();
  await invDb.attributeCategoryLink.deleteMany();
  await invDb.productAttributeDefinition.deleteMany();
  await invDb.stockReservation.deleteMany();
  await invDb.stockMovement.deleteMany();
  await invDb.warehouseStock.deleteMany();
  await invDb.priceListItem.deleteMany();
  await invDb.priceList.deleteMany();
  try {
    await invDb.$executeRawUnsafe(`DELETE FROM "BOMLine"`);
    await invDb.$executeRawUnsafe(`DELETE FROM "BOM"`);
  } catch {
    /* optional models */
  }
  await invDb.productVariant.deleteMany();
  await invDb.product.deleteMany();
  await invDb.productCategory.deleteMany();
  await invDb.brand.deleteMany();
  await invDb.warehouse.deleteMany();
  log("inventory wiped");

  if (accDb) {
    try {
      await accDb.$executeRawUnsafe(`
        DO $$ DECLARE r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `);
      log("accounting wiped");
    } catch (e) {
      log(`accounting wipe skipped: ${e instanceof Error ? e.message : e}`);
    }
  }

  await gwDb.userBranch.deleteMany().catch(() => undefined);
  await gwDb.branch.deleteMany().catch(() => undefined);
  await gwDb.refreshToken.deleteMany();
  await gwDb.passwordResetToken.deleteMany().catch(() => undefined);
  await gwDb.notification.deleteMany().catch(() => undefined);
  await gwDb.invitation.deleteMany().catch(() => undefined);
  await gwDb.tenantSetting.deleteMany().catch(() => undefined);
  await gwDb.moduleLicense.deleteMany();
  await gwDb.tenantUser.deleteMany();
  await gwDb.fCMToken.deleteMany().catch(() => undefined);
  await gwDb.banner.deleteMany().catch(() => undefined);
  await gwDb.coupon.deleteMany().catch(() => undefined);
  await gwDb.user.deleteMany();
  await gwDb.tenant.deleteMany();
  log("gateway wiped");
}

async function seedGateway() {
  console.log("\n[2/4] Seeding gateway (tenant + users)…");
  const tenant = await gwDb.tenant.create({
    data: {
      name: "Trust Wood",
      slug: "simhapuri-fresh",
      plan: "enterprise",
    },
  });

  const passwordAdmin = await bcrypt.hash("Admin@123", 10);
  const passwordUser = await bcrypt.hash("Test@123", 10);

  const personas: { email: string; name: string; role: string; password: string }[] = [
    { email: "admin@simhapurifresh.com", name: "Org Admin", role: "ADMIN", password: passwordAdmin },
    { email: "sales@oms.test", name: "Sales Executive", role: "SALES_EXECUTIVE", password: passwordUser },
    { email: "pricing@oms.test", name: "Pricing Executive", role: "PRICING_EXECUTIVE", password: passwordUser },
    { email: "dispatch@oms.test", name: "Dispatch Executive", role: "DISPATCH_EXECUTIVE", password: passwordUser },
    { email: "delivery@oms.test", name: "Delivery Executive", role: "DELIVERY_EXECUTIVE", password: passwordUser },
    { email: "customer@oms.test", name: "BuildRight Buyer", role: "CUSTOMER", password: passwordUser },
  ];

  const userIds: Record<string, string> = {};
  for (const p of personas) {
    const user = await gwDb.user.create({
      data: {
        email: p.email,
        name: p.name,
        password: p.password,
        role: p.role,
      },
    });
    await gwDb.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: p.role },
    });
    userIds[p.role] = user.id;
    log(`${p.role}: ${p.email}`);
  }

  for (const moduleId of ["sales", "inventory", "accounting", "hr", "procurement", "delivery"]) {
    await gwDb.moduleLicense.create({
      data: {
        tenantId: tenant.id,
        moduleId,
        plan: "enterprise",
        maxUsers: 50,
        isActive: true,
      },
    });
  }

  return { tenantId: tenant.id, userIds };
}

async function seedCatalog(tenantId: string) {
  console.log("\n[3/4] Seeding catalog (plywood attrs + product + vendor)…");

  await invDb.warehouse.create({
    data: {
      id: "seed-warehouse-main",
      tenantId,
      name: "Main Warehouse",
      location: "HQ",
    },
  });

  const brand = await invDb.brand.create({
    data: { tenantId, name: "Greenply" },
  });

  const category = await invDb.productCategory.create({
    data: { id: "seed-cat-plywood", tenantId, name: "Plywood" },
  });

  const attrs = [
    {
      key: "thickness_mm",
      label: "Thickness",
      dataType: "NUMBER",
      unit: "mm",
      isRequired: true,
      sortOrder: 1,
      options: undefined as string[] | undefined,
    },
    {
      key: "size",
      label: "Size",
      dataType: "SELECT",
      unit: null as string | null,
      isRequired: true,
      sortOrder: 2,
      options: ["8x4", "7x3", "6x3"],
    },
    {
      key: "grade",
      label: "Grade",
      dataType: "SELECT",
      unit: null,
      isRequired: true,
      sortOrder: 3,
      options: ["MR", "BWR", "BWP"],
    },
  ];

  for (const a of attrs) {
    const def = await invDb.productAttributeDefinition.create({
      data: {
        tenantId,
        key: a.key,
        label: a.label,
        dataType: a.dataType,
        unit: a.unit,
        options: a.options,
        isRequired: a.isRequired,
        isFilterable: true,
        showOnLabel: true,
        sortOrder: a.sortOrder,
        categoryLinks: { create: [{ tenantId, categoryId: category.id }] },
      },
    });
    log(`attr ${def.key}`);
  }

  const product = await invDb.product.create({
    data: {
      tenantId,
      sku: "PLY-BWR-18-8X4",
      name: "Marine Plywood 18mm 8x4",
      categoryId: category.id,
      brandId: brand.id,
      unit: "sheet",
      costPrice: 1200,
      sellPrice: 1600,
      reorderLevel: 10,
      isFeatured: true,
      imageUrls: ["/products/plywood-marine.jpg", "/products/timber.jpg"],
      customAttributes: { thickness_mm: 18, size: "8x4", grade: "BWR" },
      hsnCode: "441231",
      taxCode: "GST_18",
      taxRate: 0.18,
      hsnConfidence: "MANUAL",
      taxApprovalStatus: "APPROVED",
    },
  });

  await invDb.productAttributeIndex.createMany({
    data: [
      { tenantId, productId: product.id, key: "thickness_mm", valueNum: 18, valueText: "18" },
      { tenantId, productId: product.id, key: "size", valueText: "8x4" },
      { tenantId, productId: product.id, key: "grade", valueText: "BWR" },
    ],
  });

  await invDb.warehouseStock.create({
    data: {
      tenantId,
      productId: product.id,
      warehouseId: "seed-warehouse-main",
      quantity: 100,
    },
  });

  const vendor = await procDb.vendor.create({
    data: {
      tenantId,
      name: "Timber Supplies Co",
      contactPerson: "Ravi",
      phone: "919876543210",
      whatsappNumber: "919876543210",
      email: "vendor@timber.test",
      leadTimeDays: 3,
    },
  });

  await procDb.productVendor.create({
    data: {
      tenantId,
      productId: product.id,
      vendorId: vendor.id,
      priority: 1,
      isPreferred: true,
      leadTimeDays: 3,
    },
  });

  log(`product ${product.sku}, vendor ${vendor.name}`);
  return { productId: product.id, productName: product.name, sellPrice: product.sellPrice };
}

async function seedSales(
  tenantId: string,
  adminUserId: string,
  customerPortalUserId: string,
  catalog: { productId: string }
) {
  console.log("\n[4/4] Seeding sales (customer + OMS Trading workflow)…");

  const customer = await salesDb.customer.create({
    data: {
      tenantId,
      name: "BuildRight Contractors",
      email: "buyer@buildright.test",
      phone: "919123456789",
      city: "Hyderabad",
      portalUserId: customerPortalUserId,
      addresses: {
        create: {
          tenantId,
          label: "Site Office",
          line1: "12 Industrial Estate",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500032",
          isDefault: true,
        },
      },
    },
  });

  // OMS Trading workflow (same steps as platform template)
  const steps = [
    { key: "submit", label: "Submit for review", action: "submit", fromStatuses: ["DRAFT"], toStatus: "PENDING_SALES_REVIEW", sortOrder: 10, roleHint: "SALES_EXECUTIVE", uiPanel: "none" },
    { key: "sales_review", label: "Complete sales review", action: "review", fromStatuses: ["PENDING_SALES_REVIEW", "SUBMITTED", "DRAFT"], toStatus: "REVIEWED", sortOrder: 20, roleHint: "SALES_EXECUTIVE", uiPanel: "none" },
    { key: "stock_verify", label: "Verify stock", action: "verify-stock", fromStatuses: ["REVIEWED", "STOCK_VERIFIED"], toStatus: null, resolverKey: "stock_verify", sortOrder: 30, roleHint: "SALES_EXECUTIVE", uiPanel: "stock" },
    { key: "request_vendors", label: "Request vendors", action: "request-vendors", fromStatuses: ["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"], toStatus: "VENDOR_REQUESTED", sortOrder: 35, roleHint: "SALES_EXECUTIVE", uiPanel: "none" },
    { key: "start_pricing", label: "Start pricing", action: "start-pricing", fromStatuses: ["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"], toStatus: "PRICING_PENDING", sortOrder: 40, roleHint: "PRICING_EXECUTIVE", uiPanel: "none" },
    { key: "complete_pricing", label: "Complete pricing", action: "complete-pricing", fromStatuses: ["PRICING_PENDING", "PRICING_COMPLETED"], toStatus: "PRICING_COMPLETED", sortOrder: 50, roleHint: "PRICING_EXECUTIVE", uiPanel: "pricing" },
    { key: "ready_dispatch", label: "Ready for dispatch", action: "ready-dispatch", fromStatuses: ["PRICING_COMPLETED"], toStatus: "READY_FOR_DISPATCH", sortOrder: 60, roleHint: "DISPATCH_EXECUTIVE", uiPanel: "none" },
    { key: "dispatch", label: "Dispatch", action: "dispatch", fromStatuses: ["READY_FOR_DISPATCH", "PRICING_COMPLETED"], toStatus: "DISPATCHED", sortOrder: 70, roleHint: "DISPATCH_EXECUTIVE", uiPanel: "dispatch" },
    { key: "deliver", label: "Mark delivered", action: "deliver-oms", fromStatuses: ["DISPATCHED", "OUT_FOR_DELIVERY"], toStatus: "DELIVERED", sortOrder: 80, roleHint: "DELIVERY_EXECUTIVE", uiPanel: "none" },
    { key: "close", label: "Close order", action: "close", fromStatuses: ["DELIVERED", "INVOICED"], toStatus: "CLOSED", sortOrder: 90, roleHint: "DELIVERY_EXECUTIVE", uiPanel: "document", isTerminal: true },
  ];

  const workflow = await salesDb.orderWorkflow.create({
    data: {
      tenantId,
      templateId: "workflow.oms_trading",
      code: "OMS_TRADING",
      name: "OMS Trading",
      description: "Default trading lifecycle",
      isDefault: true,
      isActive: true,
      steps: {
        create: steps.map((s) => ({
          tenantId,
          key: s.key,
          label: s.label,
          action: s.action,
          fromStatuses: s.fromStatuses,
          toStatus: s.toStatus,
          resolverKey: s.resolverKey ?? null,
          sortOrder: s.sortOrder,
          roleHint: s.roleHint,
          uiPanel: s.uiPanel,
          isTerminal: s.isTerminal ?? false,
          allowCancel: true,
        })),
      },
    },
  });

  log(`customer ${customer.name} (portal linked), workflow ${workflow.code}`);
  return { customerId: customer.id, workflowId: workflow.id, adminUserId, catalog };
}

async function main() {
  console.log("\n=== OMS Reset + Seed ===\n");
  try {
    await wipe();
    const { tenantId, userIds } = await seedGateway();
    const catalog = await seedCatalog(tenantId);
    await seedSales(tenantId, userIds.ADMIN, userIds.CUSTOMER, catalog);

    console.log("\n=== Done — clean slate ready ===\n");
    console.log("  Admin UI:     http://localhost:3010/login");
    console.log("  Customer UI:  http://localhost:3007/login");
    console.log("  Tenant:       simhapuri-fresh");
    console.log("  Admin:        admin@simhapurifresh.com / Admin@123");
    console.log("  Sales:        sales@oms.test / Test@123");
    console.log("  Pricing:      pricing@oms.test / Test@123");
    console.log("  Dispatch:     dispatch@oms.test / Test@123");
    console.log("  Delivery:     delivery@oms.test / Test@123");
    console.log("  Customer:     customer@oms.test / Test@123  (BuildRight portal)\n");
    console.log("  Catalog: PLY-BWR-18-8X4 (Greenply) + Timber Supplies Co vendor");
    console.log("  Workflow: OMS Trading (default)\n");
    console.log("  Run E2E:  pnpm e2e:oms\n");
  } finally {
    await gwDb.$disconnect();
    await invDb.$disconnect();
    await salesDb.$disconnect();
    await procDb.$disconnect();
    if (accDb) await accDb.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
