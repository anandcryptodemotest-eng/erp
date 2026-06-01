import type { NextConfig } from "next";

const SALES_URL       = process.env.SALES_SERVICE_URL       ?? "http://localhost:3001";
const INVENTORY_URL   = process.env.INVENTORY_SERVICE_URL   ?? "http://localhost:3002";
const ACCOUNTING_URL  = process.env.ACCOUNTING_SERVICE_URL  ?? "http://localhost:3003";
const HR_URL          = process.env.HR_SERVICE_URL          ?? "http://localhost:3004";
const PROCUREMENT_URL = process.env.PROCUREMENT_SERVICE_URL ?? "http://localhost:3005";
const DELIVERY_URL    = process.env.DELIVERY_SERVICE_URL    ?? "http://localhost:3006";

const nextConfig: NextConfig = {
  transpilePackages: ["@erp/ui", "@erp/types", "@erp/auth", "@erp/config"],
  async rewrites() {
    return [
      // ── Sales ──────────────────────────────────────────────────────────
      { source: "/api/customers/:path*",     destination: `${SALES_URL}/api/customers/:path*` },
      { source: "/api/orders/:path*",        destination: `${SALES_URL}/api/orders/:path*` },
      { source: "/api/orders",               destination: `${SALES_URL}/api/orders` },
      { source: "/api/quotes/:path*",        destination: `${SALES_URL}/api/quotes/:path*` },
      { source: "/api/quotes",               destination: `${SALES_URL}/api/quotes` },
      { source: "/api/leads/:path*",         destination: `${SALES_URL}/api/leads/:path*` },
      { source: "/api/leads",                destination: `${SALES_URL}/api/leads` },
      { source: "/api/returns/:path*",       destination: `${SALES_URL}/api/returns/:path*` },
      { source: "/api/returns",              destination: `${SALES_URL}/api/returns` },
      { source: "/api/bills/:path*",         destination: `${ACCOUNTING_URL}/api/bills/:path*` },
      { source: "/api/bills",                destination: `${ACCOUNTING_URL}/api/bills` },
      { source: "/api/shifts/:path*",        destination: `${ACCOUNTING_URL}/api/shifts/:path*` },
      { source: "/api/shifts",               destination: `${ACCOUNTING_URL}/api/shifts` },

      // ── Inventory ──────────────────────────────────────────────────────
      { source: "/api/products/:path*",      destination: `${INVENTORY_URL}/api/products/:path*` },
      { source: "/api/products",             destination: `${INVENTORY_URL}/api/products` },
      { source: "/api/categories/:path*",    destination: `${INVENTORY_URL}/api/products/categories/:path*` },
      { source: "/api/categories",           destination: `${INVENTORY_URL}/api/products/categories` },
      { source: "/api/warehouses/:path*",    destination: `${INVENTORY_URL}/api/warehouses/:path*` },
      { source: "/api/warehouses",           destination: `${INVENTORY_URL}/api/warehouses` },
      { source: "/api/stock/:path*",         destination: `${INVENTORY_URL}/api/stock/:path*` },
      { source: "/api/stock",                destination: `${INVENTORY_URL}/api/stock` },
      { source: "/api/price-lists/:path*",   destination: `${INVENTORY_URL}/api/price-lists/:path*` },
      { source: "/api/price-lists",          destination: `${INVENTORY_URL}/api/price-lists` },

      // ── Accounting ────────────────────────────────────────────────────
      { source: "/api/accounts/:path*",      destination: `${ACCOUNTING_URL}/api/accounts/:path*` },
      { source: "/api/accounts",             destination: `${ACCOUNTING_URL}/api/accounts` },
      { source: "/api/journals/:path*",      destination: `${ACCOUNTING_URL}/api/journals/:path*` },
      { source: "/api/journals",             destination: `${ACCOUNTING_URL}/api/journals` },
      { source: "/api/invoices/:path*",      destination: `${ACCOUNTING_URL}/api/invoices/:path*` },
      { source: "/api/invoices",             destination: `${ACCOUNTING_URL}/api/invoices` },
      { source: "/api/credit-notes/:path*",  destination: `${ACCOUNTING_URL}/api/credit-notes/:path*` },
      { source: "/api/credit-notes",         destination: `${ACCOUNTING_URL}/api/credit-notes` },
      { source: "/api/debit-notes/:path*",   destination: `${ACCOUNTING_URL}/api/debit-notes/:path*` },
      { source: "/api/debit-notes",          destination: `${ACCOUNTING_URL}/api/debit-notes` },
      { source: "/api/tax-rates/:path*",     destination: `${ACCOUNTING_URL}/api/tax-rates/:path*` },
      { source: "/api/tax-rates",            destination: `${ACCOUNTING_URL}/api/tax-rates` },

      // ── HR ────────────────────────────────────────────────────────────
      { source: "/api/employees/:path*",     destination: `${HR_URL}/api/employees/:path*` },
      { source: "/api/employees",            destination: `${HR_URL}/api/employees` },
      { source: "/api/payroll/:path*",       destination: `${HR_URL}/api/payroll/:path*` },
      { source: "/api/payroll",              destination: `${HR_URL}/api/payroll` },
      { source: "/api/leaves/:path*",        destination: `${HR_URL}/api/leave/:path*` },
      { source: "/api/leaves",               destination: `${HR_URL}/api/leave` },
      { source: "/api/tax-slabs/:path*",     destination: `${HR_URL}/api/tax-slabs/:path*` },
      { source: "/api/tax-slabs",            destination: `${HR_URL}/api/tax-slabs` },

      // ── Procurement ───────────────────────────────────────────────────
      { source: "/api/vendors/:path*",             destination: `${PROCUREMENT_URL}/api/vendors/:path*` },
      { source: "/api/vendors",                    destination: `${PROCUREMENT_URL}/api/vendors` },
      { source: "/api/purchase-orders/:path*",     destination: `${PROCUREMENT_URL}/api/purchase-orders/:path*` },
      { source: "/api/purchase-orders",            destination: `${PROCUREMENT_URL}/api/purchase-orders` },
      { source: "/api/purchase-returns/:path*",    destination: `${PROCUREMENT_URL}/api/returns/:path*` },
      { source: "/api/purchase-returns",           destination: `${PROCUREMENT_URL}/api/returns` },

      // ── Delivery ──────────────────────────────────────────────────────
      { source: "/api/delivery-zones/:path*",      destination: `${DELIVERY_URL}/api/delivery-zones/:path*` },
      { source: "/api/delivery-zones",             destination: `${DELIVERY_URL}/api/delivery-zones` },
      { source: "/api/assignments/:path*",         destination: `${DELIVERY_URL}/api/assignments/:path*` },
      { source: "/api/assignments",                destination: `${DELIVERY_URL}/api/assignments` },
      { source: "/api/delivery-executives/:path*", destination: `${DELIVERY_URL}/api/delivery-executives/:path*` },
      { source: "/api/delivery-executives",        destination: `${DELIVERY_URL}/api/delivery-executives` },
    ];
  },
};

export default nextConfig;
