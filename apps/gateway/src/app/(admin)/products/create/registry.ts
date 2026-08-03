import { createStudioRegistry } from "@erp/ui";
import type { CreateProductForm } from "./schema";
import {
  identityStepSchema,
  commercialStepSchema,
  configurationStepSchema,
  pricingStepSchema,
  inventoryStepSchema,
  reviewStepSchema,
} from "./schema";
import { IdentityStep } from "./steps/IdentityStep";
import { CommercialStep } from "./steps/CommercialStep";
import { ConfigurationStep } from "./steps/ConfigurationStep";
import { ConfigurationHeaderActions } from "./InlineQuickCreate";
import { PricingStep } from "./steps/PricingStep";
import { InventoryStep } from "./steps/InventoryStep";
import { ReviewStep } from "./steps/ReviewStep";
import {
  IdentitySummary,
  CommercialSummary,
  ConfigurationSummary,
  PricingSummary,
  InventorySummary,
  StatusSummary,
} from "./summary/IdentitySummary";

/** Order: Identity → Configuration → Commercial (media) → Pricing → Inventory → Review */
export const productStudioRegistry = createStudioRegistry<CreateProductForm>()
  .step({
    id: "identity",
    title: "Identity",
    subtitle: "Category, brand, names & listing",
    analyticsKey: "product.identity",
    schema: identityStepSchema,
    Component: IdentityStep,
    SummaryComponent: IdentitySummary,
  })
  .step({
    id: "configuration",
    title: "Configuration",
    subtitle: "Attributes and variants",
    analyticsKey: "product.configuration",
    schema: configurationStepSchema,
    Component: ConfigurationStep,
    HeaderActions: ConfigurationHeaderActions,
    SummaryComponent: ConfigurationSummary,
  })
  .step({
    id: "commercial",
    title: "Commercial",
    subtitle: "Media based on configuration",
    analyticsKey: "product.commercial",
    schema: commercialStepSchema,
    Component: CommercialStep,
    SummaryComponent: CommercialSummary,
  })
  .step({
    id: "pricing",
    title: "Pricing",
    subtitle: "Prices based on configuration",
    analyticsKey: "product.pricing",
    schema: pricingStepSchema,
    Component: PricingStep,
    SummaryComponent: PricingSummary,
  })
  .step({
    id: "inventory",
    title: "Inventory",
    subtitle: "Cost and stock",
    analyticsKey: "product.inventory",
    schema: inventoryStepSchema,
    Component: InventoryStep,
    SummaryComponent: InventorySummary,
  })
  .step({
    id: "review",
    title: "Review",
    subtitle: "Confirm and create",
    analyticsKey: "product.review",
    schema: reviewStepSchema,
    Component: ReviewStep,
    SummaryComponent: StatusSummary,
  })
  .build();
