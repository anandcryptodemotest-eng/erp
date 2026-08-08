import { registerWidget } from "../registry";
import { StatSummaryWidget } from "./stat-summary";
import { RevenueTrendWidget } from "./revenue-trend";
import { OrderStatusWidget } from "./order-status";
import { LowStockWidget } from "./low-stock";
import { DeliveryPerformanceWidget, OutstandingInvoicesWidget } from "./delivery-outstanding";
import { TopProductsWidget, RecentMovementsWidget } from "./products-movements";
import { MyOrdersWidget, MonthlySpendingWidget } from "./customer";
import {
  OpsKpiRowWidget,
  RecentActivityWidget,
  SreqOrderTableWidget,
  MyTasksListWidget,
  RecentCustomersWidget,
  PriceOpsWidget,
  RecentProductsWidget,
} from "./ops-role";

/** Register all built-in widgets. Call once at app startup. */
export function registerDashboardWidgets() {
  registerWidget({
    id: "stat-summary",
    name: "Summary",
    description: "Revenue, order count and average order value",
    category: "summary",
    requiredModule: "sales",
    dataSource: "/api/reports/sales",
    component: StatSummaryWidget,
    defaultWidth: 12,
    defaultHeight: 2,
  });
  registerWidget({
    id: "revenue-trend",
    name: "Revenue trend",
    description: "Daily order revenue area chart",
    category: "sales",
    requiredModule: "sales",
    requiredCapability: "sales:reports:read",
    dataSource: "/api/reports/sales",
    component: RevenueTrendWidget,
    defaultWidth: 8,
    defaultHeight: 4,
  });
  registerWidget({
    id: "order-status",
    name: "Orders by status",
    description: "Distribution of order states",
    category: "sales",
    requiredModule: "sales",
    requiredCapability: "sales:orders:read",
    dataSource: "/api/reports/sales",
    component: OrderStatusWidget,
    defaultWidth: 4,
    defaultHeight: 4,
  });
  registerWidget({
    id: "low-stock",
    name: "Low stock",
    description: "Items below reorder threshold",
    category: "inventory",
    requiredModule: "inventory",
    requiredCapability: "inventory:reports:read",
    dataSource: "/api/reports/stock?lowStockThreshold=10",
    component: LowStockWidget,
    defaultWidth: 6,
    defaultHeight: 4,
  });
  registerWidget({
    id: "recent-movements",
    name: "Recent stock movements",
    description: "Latest inventory changes",
    category: "inventory",
    requiredModule: "inventory",
    requiredCapability: "inventory:reports:read",
    dataSource: "/api/reports/stock?lowStockThreshold=10",
    component: RecentMovementsWidget,
    defaultWidth: 6,
    defaultHeight: 4,
  });
  registerWidget({
    id: "delivery-performance",
    name: "Delivery performance",
    description: "Assignments and success rate",
    category: "delivery",
    requiredModule: "delivery",
    requiredCapability: "delivery:reports:read",
    dataSource: "/api/reports/delivery",
    component: DeliveryPerformanceWidget,
    defaultWidth: 6,
    defaultHeight: 4,
  });
  registerWidget({
    id: "outstanding-invoices",
    name: "Outstanding invoices",
    description: "Open receivables and mismatches",
    category: "accounting",
    requiredModule: "accounting",
    requiredCapability: "accounting:reports:read",
    dataSource: "/api/reports/reconciliation",
    component: OutstandingInvoicesWidget,
    defaultWidth: 6,
    defaultHeight: 3,
  });
  registerWidget({
    id: "top-products",
    name: "Top products",
    description: "Best sellers by units sold",
    category: "sales",
    requiredModule: "sales",
    requiredCapability: "sales:reports:read",
    dataSource: "/api/reports/sales",
    component: TopProductsWidget,
    defaultWidth: 6,
    defaultHeight: 3,
  });
  registerWidget({
    id: "my-orders",
    name: "My orders",
    description: "Your recent purchase requests",
    category: "customer",
    requiredModule: "sales",
    requiredCapability: "sales:orders:read",
    dataSource: "/api/sales-requests?limit=5",
    component: MyOrdersWidget,
    defaultWidth: 12,
    defaultHeight: 4,
  });
  registerWidget({
    id: "monthly-spending",
    name: "Monthly spending",
    description: "Your spending over the last 6 months",
    category: "customer",
    requiredModule: "sales",
    requiredCapability: "sales:orders:read",
    dataSource: "/api/sales-requests?limit=200",
    component: MonthlySpendingWidget,
    defaultWidth: 8,
    defaultHeight: 4,
  });
  registerWidget({
    id: "ops-kpi-row",
    name: "Role KPIs",
    description: "Attention metrics for the signed-in role",
    category: "summary",
    dataSource: "/api/dashboard/ops-summary",
    component: OpsKpiRowWidget,
    defaultWidth: 12,
    defaultHeight: 2,
    configurableProperties: [
      {
        key: "variant",
        label: "KPI set",
        kind: "select",
        defaultValue: "admin",
        options: [
          { label: "Admin", value: "admin" },
          { label: "Sales", value: "sales" },
          { label: "Pricing", value: "pricing" },
          { label: "Dispatch", value: "dispatch" },
          { label: "Delivery", value: "delivery" },
          { label: "Accountant", value: "accountant" },
          { label: "Catalog", value: "catalog" },
        ],
      },
    ],
  });
  registerWidget({
    id: "recent-activity",
    name: "Recent activity",
    description: "Latest SREQs, orders and tasks",
    category: "summary",
    requiredModule: "sales",
    dataSource: "/api/dashboard/ops-summary",
    component: RecentActivityWidget,
    defaultWidth: 12,
    defaultHeight: 3,
  });
  registerWidget({
    id: "sreq-order-table",
    name: "Recent requests & orders",
    description: "Click through to Order Desk",
    category: "sales",
    requiredModule: "sales",
    dataSource: "/api/dashboard/ops-summary",
    component: SreqOrderTableWidget,
    defaultWidth: 8,
    defaultHeight: 4,
  });
  registerWidget({
    id: "my-tasks-list",
    name: "My tasks",
    description: "Open workflow tasks — complete on Order Desk",
    category: "sales",
    requiredModule: "sales",
    dataSource: "/api/dashboard/ops-summary",
    component: MyTasksListWidget,
    defaultWidth: 6,
    defaultHeight: 4,
  });
  registerWidget({
    id: "recent-customers",
    name: "Recent customers",
    description: "Latest customer records",
    category: "sales",
    requiredModule: "sales",
    dataSource: "/api/dashboard/ops-summary",
    component: RecentCustomersWidget,
    defaultWidth: 12,
    defaultHeight: 3,
  });
  registerWidget({
    id: "price-ops",
    name: "Price lists",
    description: "Active price lists",
    category: "inventory",
    requiredModule: "inventory",
    dataSource: "/api/dashboard/ops-summary",
    component: PriceOpsWidget,
    defaultWidth: 8,
    defaultHeight: 5,
  });
  registerWidget({
    id: "recent-products",
    name: "Catalog snapshot",
    description: "Recent products",
    category: "inventory",
    requiredModule: "inventory",
    dataSource: "/api/dashboard/ops-summary",
    component: RecentProductsWidget,
    defaultWidth: 6,
    defaultHeight: 4,
  });
}