/**
 * Seed script for Simhapuri Fresh ERP
 * Run: pnpm --filter @erp/scripts seed
 *
 * Creates:
 *  - Tenant: Simhapuri Fresh (slug: simhapuri-fresh)
 *  - Admin user: admin@simhapurifresh.com / Admin@123
 *  - Module licenses for all 6 modules
 *  - Default warehouse in inventory
 *  - Grocery product categories + 4 sample products with stock
 *  - Chart of Accounts (core accounts for payroll, AR, AP, bank)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Parse .env files
// ---------------------------------------------------------------------------
function parseEnv(filePath: string): Record<string, string> {
  try {
    const text = readFileSync(filePath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const gatewayEnv     = parseEnv(resolve(root, "apps/gateway/.env"));
const inventoryEnv   = parseEnv(resolve(root, "apps/inventory/.env"));
const accountingEnv  = parseEnv(resolve(root, "apps/accounting/.env"));

// Set env vars so Prisma clients can read them
process.env["DATABASE_URL"] = gatewayEnv["DATABASE_URL"]!;

// ---------------------------------------------------------------------------
// Import Prisma clients
// ---------------------------------------------------------------------------
const { PrismaClient: GatewayPrisma }    = await import("../apps/gateway/src/generated/prisma/index.js");
const { PrismaClient: InventoryPrisma }  = await import("../apps/inventory/src/generated/prisma/index.js");
const { PrismaClient: AccountingPrisma } = await import("../apps/accounting/src/generated/prisma/index.js");

const gwDb = new GatewayPrisma({
  datasources: { db: { url: gatewayEnv["DATABASE_URL"] } },
});
const invDb = new InventoryPrisma({
  datasources: { db: { url: inventoryEnv["DATABASE_URL"] } },
});
const accDb = new AccountingPrisma({
  datasources: { db: { url: accountingEnv["DATABASE_URL"] } },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`  [seed] ${msg}`);
}

// ---------------------------------------------------------------------------
// Seed gateway: tenant + admin user + module licenses
// ---------------------------------------------------------------------------
async function seedGateway() {
  log("Creating tenant...");
  const tenant = await gwDb.tenant.upsert({
    where:  { slug: "simhapuri-fresh" },
    update: {},
    create: {
      name: "Simhapuri Fresh",
      slug: "simhapuri-fresh",
      plan: "enterprise",
    },
  });
  log(`  Tenant: ${tenant.id}`);

  log("Creating admin user...");
  const password = await bcrypt.hash("Admin@123", 10);
  const user = await gwDb.user.upsert({
    where:  { email: "admin@simhapurifresh.com" },
    update: {},
    create: {
      email:    "admin@simhapurifresh.com",
      name:     "Admin",
      password,
      role:     "ADMIN",
    },
  });
  log(`  User: ${user.id}`);

  log("Linking user to tenant...");
  await gwDb.tenantUser.upsert({
    where:  { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: { tenantId: tenant.id, userId: user.id, role: "ADMIN" },
  });

  log("Creating module licenses...");
  const modules = ["sales", "inventory", "accounting", "hr", "procurement", "delivery"];
  for (const moduleId of modules) {
    await gwDb.moduleLicense.upsert({
      where:  { tenantId_moduleId: { tenantId: tenant.id, moduleId } },
      update: {},
      create: {
        tenantId: tenant.id,
        moduleId,
        plan:     "enterprise",
        maxUsers: 50,
        isActive: true,
      },
    });
  }
  log(`  Licenses created for: ${modules.join(", ")}`);

  return { tenantId: tenant.id, userId: user.id };
}

// ---------------------------------------------------------------------------
// Seed inventory: warehouse + categories + products
// ---------------------------------------------------------------------------
async function seedInventory(tenantId: string) {
  log("Creating warehouse...");
  const warehouse = await invDb.warehouse.upsert({
    where:  { id: "seed-warehouse-main" },
    update: {},
    create: {
      id:       "seed-warehouse-main",
      tenantId,
      name:     "Main Store",
      location: "Simhapuri Fresh HQ",
    },
  });
  log(`  Warehouse: ${warehouse.id}`);

  log("Creating product categories...");
  const categories: Record<string, string> = {};
  for (const [key, name] of [
    ["vegetables", "Vegetables"],
    ["fruits",     "Fruits"],
    ["dairy",      "Dairy & Eggs"],
    ["staples",    "Staples & Grains"],
  ]) {
    const cat = await invDb.productCategory.upsert({
      where:  { id: `seed-cat-${key}` },
      update: {},
      create: {
        id:       `seed-cat-${key}`,
        tenantId,
        name,
      },
    });
    categories[key] = cat.id;
  }

  log("Creating sample products...");
  const products = [
    { key: "tomato", sku: "VEG-001", name: "Tomato",       categoryKey: "vegetables", cost: 20,  sell: 30,  unit: "kg",  barcode: "8901234560001" },
    { key: "banana", sku: "FRT-001", name: "Banana",       categoryKey: "fruits",     cost: 25,  sell: 40,  unit: "dozen", barcode: "8901234560002" },
    { key: "milk",   sku: "DRY-001", name: "Full Cream Milk", categoryKey: "dairy",  cost: 55,  sell: 70,  unit: "L",   barcode: "8901234560003" },
    { key: "rice",   sku: "STA-001", name: "Basmati Rice", categoryKey: "staples",    cost: 80,  sell: 110, unit: "kg",  barcode: "8901234560004" },
  ];

  for (const p of products) {
    const product = await invDb.product.upsert({
      where:  { tenantId_sku: { tenantId, sku: p.sku } },
      update: {},
      create: {
        tenantId,
        sku:         p.sku,
        name:        p.name,
        category:    { connect: { id: categories[p.categoryKey] } },
        barcode:     p.barcode,
        unit:        p.unit,
        costPrice:   p.cost,
        sellPrice:   p.sell,
        reorderLevel: 20,
        weight:       1,
        weightUnit:  p.unit === "kg" ? "kg" : undefined,
      },
    });

    // Add opening stock
    await invDb.warehouseStock.upsert({
      where:  { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: {},
      create: {
        tenantId,
        productId:   product.id,
        warehouseId: warehouse.id,
        quantity:    500,
        reservedQty: 0,
      },
    });
    log(`  Product: ${p.name} (stock: 500 ${p.unit})`);
  }

  return { warehouseId: warehouse.id };
}

// ---------------------------------------------------------------------------
// Seed accounting: Chart of Accounts
// ---------------------------------------------------------------------------
async function seedAccounting(tenantId: string) {
  log("Creating Chart of Accounts...");

  const accounts = [
    // Assets
    { code: "1000", name: "Current Assets",        type: "ASSET",     parentCode: null },
    { code: "1010", name: "Cash & Bank",            type: "ASSET",     parentCode: "1000" },
    { code: "1020", name: "Accounts Receivable",    type: "ASSET",     parentCode: "1000" },
    { code: "1030", name: "Inventory",              type: "ASSET",     parentCode: "1000" },
    // Liabilities
    { code: "2000", name: "Current Liabilities",    type: "LIABILITY",  parentCode: null },
    { code: "2010", name: "Accounts Payable",       type: "LIABILITY",  parentCode: "2000" },
    { code: "2100", name: "Salary Payable",         type: "LIABILITY",  parentCode: "2000" },
    { code: "2110", name: "TDS Payable",            type: "LIABILITY",  parentCode: "2000" },
    { code: "2120", name: "Deductions Payable",     type: "LIABILITY",  parentCode: "2000" },
    // Equity
    { code: "3000", name: "Equity",                 type: "EQUITY",    parentCode: null },
    { code: "3010", name: "Owner's Capital",        type: "EQUITY",    parentCode: "3000" },
    // Revenue
    { code: "4000", name: "Revenue",                type: "REVENUE",   parentCode: null },
    { code: "4010", name: "Sales Revenue",          type: "REVENUE",   parentCode: "4000" },
    // Expenses
    { code: "5000", name: "Expenses",               type: "EXPENSE",   parentCode: null },
    { code: "5010", name: "Cost of Goods Sold",     type: "EXPENSE",   parentCode: "5000" },
    { code: "6000", name: "Salary Expense",         type: "EXPENSE",   parentCode: "5000" },
    { code: "6010", name: "Operating Expenses",     type: "EXPENSE",   parentCode: "5000" },
  ];

  // First pass: create top-level accounts (no parent)
  const idByCode: Record<string, string> = {};
  for (const acc of accounts.filter(a => a.parentCode === null)) {
    const record = await accDb.chartOfAccount.upsert({
      where:  { tenantId_code: { tenantId, code: acc.code } },
      update: {},
      create: { tenantId, code: acc.code, name: acc.name, type: acc.type },
    });
    idByCode[acc.code] = record.id;
    log(`  CoA: ${acc.code} ${acc.name}`);
  }

  // Second pass: create child accounts
  for (const acc of accounts.filter(a => a.parentCode !== null)) {
    const record = await accDb.chartOfAccount.upsert({
      where:  { tenantId_code: { tenantId, code: acc.code } },
      update: {},
      create: {
        tenantId,
        code:     acc.code,
        name:     acc.name,
        type:     acc.type,
        parentId: idByCode[acc.parentCode!],
      },
    });
    idByCode[acc.code] = record.id;
    log(`  CoA: ${acc.code} ${acc.name}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n=== Simhapuri Fresh ERP — Seed Script ===\n");

  try {
    console.log("[ Gateway: tenant + user + licenses ]");
    const { tenantId } = await seedGateway();

    console.log("\n[ Inventory: warehouse + categories + products ]");
    await seedInventory(tenantId);

    console.log("\n[ Accounting: chart of accounts ]");
    await seedAccounting(tenantId);

    console.log("\n=== Seed complete! ===");
    console.log(`\n  Login at http://localhost:3000`);
    console.log(`  Email:    admin@simhapurifresh.com`);
    console.log(`  Password: Admin@123`);
    console.log(`  Tenant:   simhapuri-fresh\n`);
  } finally {
    await gwDb.$disconnect();
    await invDb.$disconnect();
    await accDb.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
