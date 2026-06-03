// ==================== COMMON TYPES ====================

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ==================== AUTH / USER ====================

export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "USER"
  | "ACCOUNTANT"
  | "HR_MANAGER"
  | "SALES_REP"
  | "PROCUREMENT_OFFICER";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
}

export interface AuthToken {
  userId: string;
  tenantId: string;
  role: UserRole;
  modules: string[];
  exp: number;
}

// ==================== TENANT / LICENSING ====================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  isActive: boolean;
}

export interface ModuleLicense {
  id: string;
  tenantId: string;
  moduleId: string;
  plan: "basic" | "pro" | "enterprise";
  maxUsers: number;
  isActive: boolean;
  expiresAt: string | null;
}

export type ModuleId =
  | "core"
  | "sales"
  | "inventory"
  | "accounting"
  | "hr"
  | "procurement"
  | "delivery";

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  description: string;
  port: number;
  healthEndpoint: string;
  subdomain: string;
  dependencies: ModuleId[];
}

// ==================== INVENTORY ====================

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";
  quantity: number;
  reference: string | null;
}

// ==================== SALES ====================

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  status: "DRAFT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  subtotal: number;
  tax: number;
  total: number;
  items: SalesOrderItem[];
}

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED";

export type OpportunityStage =
  | "PROSPECTING"
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export type SalesOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "INVOICED"
  | "CANCELLED";

export type SalesReturnStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

export interface SalesOrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ==================== ACCOUNTING ====================

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string | null;
  description: string | null;
  isPosted: boolean;
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  type: "RECEIVABLE" | "PAYABLE";
  customerId: string | null;
  vendorId: string | null;
  date: string;
  dueDate: string;
  total: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
}

// ==================== HR ====================

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  salary: number;
  isActive: boolean;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: "DRAFT" | "APPROVED" | "PAID";
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: "ANNUAL" | "SICK" | "PERSONAL" | "MATERNITY" | "PATERNITY" | "UNPAID";
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

// ==================== PROCUREMENT ====================

export interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: "DRAFT" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED";
  subtotal: number;
  tax: number;
  total: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ==================== INTER-SERVICE EVENTS ====================

export type ServiceEvent =
  | { type: "ORDER_CREATED"; payload: { orderId: string; items: { productId: string; qty: number }[] } }
  | { type: "ORDER_SHIPPED"; payload: { orderId: string } }
  | { type: "STOCK_UPDATED"; payload: { productId: string; warehouseId: string; quantity: number } }
  | { type: "STOCK_LOW"; payload: { productId: string; currentQty: number; reorderLevel: number } }
  | { type: "INVOICE_CREATED"; payload: { invoiceId: string; orderId?: string } }
  | { type: "PAYMENT_RECEIVED"; payload: { invoiceId: string; amount: number } }
  | { type: "PO_RECEIVED"; payload: { poId: string; items: { productId: string; qty: number }[] } }
  | { type: "EMPLOYEE_CREATED"; payload: { employeeId: string } }
  | { type: "PAYROLL_PROCESSED"; payload: { period: string; totalAmount: number } };

// ==================== GROCERY / DELIVERY ====================

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "AWAITING_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "INVOICED"
  | "CANCELLED"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED";

export type PaymentMethod = "COD" | "UPI" | "CARD" | "WALLET" | "SPLIT" | "CASH";

export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "PARTIAL";

export type BillStatus = "COMPLETED" | "HELD" | "CANCELLED";

export type BannerType = "HOME" | "PROMOTIONAL" | "CATEGORY" | "PRODUCT";

export type CouponType = "PERCENTAGE" | "FLAT_AMOUNT" | "FREE_DELIVERY";

export type DeliveryAssignmentStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export type AvailabilityStatus = "AVAILABLE" | "BUSY" | "OFF_DUTY";

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  imageUrl?: string;
}

export interface CartSummary {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

export interface CustomerAddress {
  id: string;
  tenantId: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  pincode: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Brand {
  id: string;
  tenantId: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface Banner {
  id: string;
  tenantId: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  type: BannerType;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface DeliveryZone {
  id: string;
  tenantId: string;
  name: string;
  pincodes: string[];
  deliveryFee: number;
  minOrderAmount: number;
  estimatedMins: number;
  isActive: boolean;
}

export interface DeliveryAssignment {
  id: string;
  tenantId: string;
  orderId: string;
  executiveId: string;
  status: DeliveryAssignmentStatus;
  assignedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface Bill {
  id: string;
  tenantId: string;
  billNumber: string;
  customerId: string | null;
  customerName: string | null;
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: BillStatus;
  billedBy: string;
  createdAt: string;
}
