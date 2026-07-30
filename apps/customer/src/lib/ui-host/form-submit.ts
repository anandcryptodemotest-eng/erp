"use client";

/**
 * Customer Host form submit dispatch — maps formId → API (ADR 0011).
 * Pages pass domain context; widgets never call REST.
 */

import { api } from "@/lib/api-client";

export type AddressFormMode = "create" | "edit";

export type CustomerFormSubmitContext = {
  customerId?: string;
  /** Address form only */
  addressMode?: AddressFormMode;
  addressId?: string | null;
  onSuccess?: (result?: unknown) => void | Promise<void>;
  onError?: (message: string) => void;
};

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return v == null ? "" : String(v).trim();
}

function bool(payload: Record<string, unknown>, key: string): boolean {
  const v = payload[key];
  return v === true || v === "true" || v === "1";
}

export async function dispatchCustomerFormSubmit(
  formId: string,
  payload: Record<string, unknown>,
  ctx: CustomerFormSubmitContext
): Promise<void> {
  try {
    if (formId === "customer-profile") {
      const name = str(payload, "name");
      if (!name) {
        ctx.onError?.("Name is required");
        return;
      }
      const body: Record<string, string> = { name };
      const phone = str(payload, "phone");
      const email = str(payload, "email");
      if (phone) body.phone = phone;
      if (email) body.email = email;
      const res = await api("sales", "/api/customers/me", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.error) {
        ctx.onError?.(res.error);
        return;
      }
      await ctx.onSuccess?.(res.data);
      return;
    }

    if (formId === "customer-address") {
      if (!ctx.customerId) {
        ctx.onError?.("Customer profile required");
        return;
      }
      const body = {
        label: str(payload, "label") || "Site",
        line1: str(payload, "line1"),
        city: str(payload, "city"),
        state: str(payload, "state") || undefined,
        pincode: str(payload, "pincode"),
        isDefault: bool(payload, "isDefault"),
      };
      if (!body.line1 || !body.city || !body.pincode) {
        ctx.onError?.("Street, city and pincode are required");
        return;
      }
      const mode = ctx.addressMode ?? "create";
      const res =
        mode === "edit" && ctx.addressId
          ? await api("sales", `/api/customers/${ctx.customerId}/addresses/${ctx.addressId}`, {
              method: "PATCH",
              body: JSON.stringify(body),
            })
          : await api("sales", `/api/customers/${ctx.customerId}/addresses`, {
              method: "POST",
              body: JSON.stringify(body),
            });
      if (res.error) {
        ctx.onError?.(res.error);
        return;
      }
      await ctx.onSuccess?.(res.data);
      return;
    }

    if (formId === "customer-checkout") {
      // Checkout page supplies a dedicated submit via onCheckoutSubmit in context
      ctx.onError?.("Checkout submit must be handled by the checkout host");
      return;
    }

    ctx.onError?.(`No submit handler for form ${formId}`);
  } catch (e: unknown) {
    ctx.onError?.(e instanceof Error ? e.message : "Submit failed");
  }
}
