import { z } from "zod";
import { canCompleteDispatch } from "@erp/types";

export const reviewSchema = z.object({
  remarks: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().positive(), // Float: supports weight-based lines (e.g. 0.5 kg)
        unitPrice: z.number().nonnegative(),
        remarks: z.string().optional(),
        /** Product attrs + pricing engine snapshot at quote time */
        customSnapshot: z.record(z.unknown()).optional(),
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

export const dispatchSchema = z
  .object({
    fulfillmentMode: z.enum(["own_fleet", "porter"]).optional(),
    carrier: z.string().optional(),
    porterBookingStatus: z.enum(["NOT_BOOKED", "BOOKING_PENDING", "BOOKED", "CANCELLED"]).optional(),
    assignedDriverId: z.string().optional(),
    vehicleInfo: z.string().optional(),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().optional(),
    dispatchRemarks: z.string().optional(),
    dispatchedAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    const gate = canCompleteDispatch(data);
    if (!gate.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: gate.error });
    }
  });

export const PRICE_EDIT_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "PRICING_EXECUTIVE",
]);
