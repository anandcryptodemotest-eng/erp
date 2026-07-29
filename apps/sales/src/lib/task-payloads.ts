import { z } from "zod";

export const reviewSchema = z.object({
  remarks: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        remarks: z.string().optional(),
      })
    )
    .optional(),
});

export const stockVerifySchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        availableQty: z.number().nonnegative(),
      })
    )
    .min(1),
  remarks: z.string().optional(),
});

export const pricingSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        purchasePrice: z.number().nonnegative().optional(),
        unitPrice: z.number().nonnegative().optional(),
        discount: z.number().nonnegative().optional(),
        taxRate: z.number().nonnegative().optional(),
      })
    )
    .optional(),
  discountAmount: z.number().nonnegative().optional(),
  transportationCharge: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  remarks: z.string().optional(),
});

export const dispatchSchema = z.object({
  assignedDriverId: z.string().optional(),
  vehicleInfo: z.string().optional(),
  trackingNumber: z.string().optional(),
  dispatchRemarks: z.string().optional(),
  dispatchedAt: z.string().datetime().optional(),
});

export const PRICE_EDIT_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "PRICING_EXECUTIVE",
]);
