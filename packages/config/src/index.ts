import type { ModuleInfo, ModuleId } from "@erp/types";

export { ServiceClient, serviceClient } from "./service-client";

/**
 * Service registry - defines all microservices and their configuration.
 * Each module runs as an independent service on its own port.
 */
export const services: Record<ModuleId, ModuleInfo> = {
  core: {
    id: "core",
    name: "Gateway & Core",
    description: "Authentication, tenant management, and API gateway",
    port: 3000,
    healthEndpoint: "/api/health",
    subdomain: "app",
    dependencies: [],
  },
  sales: {
    id: "sales",
    name: "Sales & CRM",
    description: "Customer management, sales orders, and revenue tracking",
    port: 3001,
    healthEndpoint: "/api/health",
    subdomain: "sales",
    dependencies: ["core", "inventory"],
  },
  inventory: {
    id: "inventory",
    name: "Inventory Management",
    description: "Products, stock levels, warehouses, and stock movements",
    port: 3002,
    healthEndpoint: "/api/health",
    subdomain: "inventory",
    dependencies: ["core"],
  },
  accounting: {
    id: "accounting",
    name: "Accounting & Finance",
    description: "Chart of accounts, journal entries, invoices, and payments",
    port: 3003,
    healthEndpoint: "/api/health",
    subdomain: "accounting",
    dependencies: ["core"],
  },
  hr: {
    id: "hr",
    name: "HR & Payroll",
    description: "Employee management, payroll processing, and leave management",
    port: 3004,
    healthEndpoint: "/api/health",
    subdomain: "hr",
    dependencies: ["core"],
  },
  procurement: {
    id: "procurement",
    name: "Procurement",
    description: "Vendor management, purchase orders, and receiving",
    port: 3005,
    healthEndpoint: "/api/health",
    subdomain: "procurement",
    dependencies: ["core", "inventory"],
  },
};

/**
 * Get the URL of a service by its module ID
 */
export function getServiceUrl(moduleId: ModuleId): string {
  const service = services[moduleId];
  const baseUrl = process.env[`${moduleId.toUpperCase()}_SERVICE_URL`];
  return baseUrl || `http://localhost:${service.port}`;
}

/**
 * Get all service URLs for environment injection
 */
export function getAllServiceUrls(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(services).map(([id, svc]) => [
      `${id.toUpperCase()}_SERVICE_URL`,
      `http://localhost:${svc.port}`,
    ])
  );
}
