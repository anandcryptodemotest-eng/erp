import { z } from "zod";

export const createProductFormSchema = z
  .object({
    categoryId: z.string().min(1, "Category required"),
    brandId: z.string().optional().default(""),
    productName: z.string().optional().default(""),
    groupName: z.string().optional().default(""),
    groupCode: z.string().optional().default(""),
    description: z.string().optional().default(""),
    mediaImages: z.array(z.string()).default([]),
    mediaVariation: z.enum(["SAME", "CONFIGURATION"]).default("SAME"),
    mediaVariesBy: z.string().optional().default(""),
    mediaByValue: z.record(z.array(z.string())).default({}),
    selected: z.record(z.array(z.string())).default({}),
    pricingBasis: z.string().default("PER_AREA"),
    pricingUom: z.string().default("sq_ft"),
    baseRate: z.string().default("50"),
    sellPrice: z.string().optional().default(""),
    priceVariation: z.enum(["SAME", "CONFIGURATION"]).default("SAME"),
    priceVariesBy: z.string().optional().default(""),
    configPrices: z.record(z.string()).default({}),
    rowOverrides: z.record(z.string()).default({}),
    costPrice: z.string().optional().default(""),
    openingStock: z.string().default("0"),
    reorderLevel: z.string().default("10"),
    productNameTemplate: z.string().optional().default(""),
    groupNameTemplate: z.string().optional().default(""),
    skuTemplate: z.string().optional().default(""),
    nameTemplate: z.string().optional().default(""),
    barcodeTemplate: z.string().optional().default(""),
  })
  .passthrough();

export type CreateProductForm = z.infer<typeof createProductFormSchema>;

export const identityStepSchema = z.object({ categoryId: z.string().min(1) }).passthrough();
export const commercialStepSchema = z.object({}).passthrough();
export const configurationStepSchema = z.object({ categoryId: z.string().min(1) }).passthrough();
export const pricingStepSchema = z.object({}).passthrough();
export const inventoryStepSchema = z.object({}).passthrough();
export const reviewStepSchema = z.object({ categoryId: z.string().min(1) }).passthrough();

export const defaultCreateProductValues: CreateProductForm = {
  categoryId: "",
  brandId: "",
  productName: "",
  groupName: "",
  groupCode: "",
  description: "",
  mediaImages: [],
  mediaVariation: "SAME",
  mediaVariesBy: "",
  mediaByValue: {},
  selected: {},
  pricingBasis: "PER_AREA",
  pricingUom: "sq_ft",
  baseRate: "50",
  sellPrice: "",
  priceVariation: "SAME",
  priceVariesBy: "",
  configPrices: {},
  rowOverrides: {},
  costPrice: "",
  openingStock: "0",
  reorderLevel: "10",
  productNameTemplate: "{brand} {grade} {thickness_mm}mm {size} {category}",
  groupNameTemplate: "{productName}",
  skuTemplate: "",
  nameTemplate: "",
  barcodeTemplate: "",
};
