import type { FormDefinition } from "@erp/workflow";

/** Default Customer Host checkout screen (ADR 0010 / Phase 2). */
export const CUSTOMER_CHECKOUT_FORM: FormDefinition = {
  id: "customer-checkout",
  key: "customer_checkout",
  title: "Checkout",
  description: "Confirm payment and notes for your sales request",
  audiences: ["CUSTOMER"],
  renderer: "generic",
  themeId: "oms-default",
  confirmLabel: "Place order",
  showTotal: true,
  fields: [
    {
      key: "paymentMethod",
      label: "Payment",
      type: "radio",
      scope: "order",
      required: true,
      options: [
        { value: "COD", label: "Cash on Delivery" },
        { value: "UPI", label: "UPI" },
      ],
    },
    {
      key: "notes",
      label: "Notes for sales",
      type: "textarea",
      scope: "order",
      required: false,
    },
  ],
  // Items + address selection stay host chrome (Host Experience Principle).
  // Widgets cover payment / notes / place-order only.
  layout: [
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
};

/** Default Customer Host order / request tracking screen. */
export const CUSTOMER_TRACKING_FORM: FormDefinition = {
  id: "customer-tracking",
  key: "customer_tracking",
  title: "Order status",
  description: "Track your request and fulfilment progress",
  audiences: ["CUSTOMER"],
  renderer: "generic",
  themeId: "oms-default",
  fields: [],
  layout: [
    { widget: "StatusBanner", props: {} },
    { widget: "Timeline", props: {} },
    { widget: "ProductList", props: { editable: false, showPrice: true, allowRemove: false } },
  ],
};

/** Customer Host profile update (name / phone / email). */
export const CUSTOMER_PROFILE_FORM: FormDefinition = {
  id: "customer-profile",
  key: "customer_profile",
  title: "Edit profile",
  description: "Update your contact details",
  audiences: ["CUSTOMER"],
  renderer: "generic",
  themeId: "oms-default",
  confirmLabel: "Save profile",
  fields: [
    { key: "name", label: "Name", type: "text", scope: "order", required: true },
    { key: "phone", label: "Phone", type: "phone", scope: "order", required: false },
    { key: "email", label: "Email", type: "email", scope: "order", required: false },
  ],
  layout: [
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
};

/**
 * Shared address FORM — Profile create/edit and Checkout add.
 * Controller context: mode create|edit + addressId when edit.
 */
export const CUSTOMER_ADDRESS_FORM: FormDefinition = {
  id: "customer-address",
  key: "customer_address",
  title: "Delivery address",
  description: "Save a delivery address",
  audiences: ["CUSTOMER"],
  renderer: "generic",
  themeId: "oms-default",
  confirmLabel: "Save address",
  fields: [
    { key: "label", label: "Label", type: "text", scope: "order", required: true },
    { key: "line1", label: "Street / building", type: "text", scope: "order", required: true },
    { key: "city", label: "City", type: "text", scope: "order", required: true },
    { key: "state", label: "State", type: "text", scope: "order", required: false },
    { key: "pincode", label: "Pincode", type: "text", scope: "order", required: true },
    { key: "isDefault", label: "Set as default", type: "checkbox", scope: "order", required: false },
  ],
  layout: [
    { widget: "FormFields", props: {} },
    { widget: "ActionButtons", props: {} },
  ],
};

export const CUSTOMER_BUILTIN_FORMS: FormDefinition[] = [
  CUSTOMER_CHECKOUT_FORM,
  CUSTOMER_TRACKING_FORM,
  CUSTOMER_PROFILE_FORM,
  CUSTOMER_ADDRESS_FORM,
];
