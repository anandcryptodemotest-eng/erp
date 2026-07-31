export type IndustryTemplate = {
  templateId: string;
  name: string;
  version: number;
  description: string;
  categories: {
    name: string;
    attributeKeys: string[];
    /** Per-category SELECT lists keyed by attribute key (e.g. size). Stored as optionsOverride. */
    optionOverrides?: Record<string, string[]>;
  }[];
  attributes: {
    key: string;
    label: string;
    dataType: string;
    unit?: string;
    options?: string[];
    validation?: { min?: number; max?: number; regex?: string; maxLength?: number };
    isRequired?: boolean;
    isFilterable?: boolean;
    isSearchable?: boolean;
    isVariantAxis?: boolean;
    isIdentity?: boolean;
    showOnLabel?: boolean;
    sortOrder?: number;
    measureRole?: string;
    measureUnit?: string;
    sizePattern?: string;
  }[];
};

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    templateId: "industry.plywood",
    name: "Plywood / Timber",
    version: 4,
    description: "Plywood, Blockboard & Laminates — size-driven PER_AREA pricing ({L}x{W} ft)",
    categories: [
      {
        name: "Plywood",
        attributeKeys: ["thickness_mm", "size", "grade"],
        optionOverrides: {
          size: ["8x4", "7x3", "6x3", "8x3"],
        },
      },
      {
        name: "Blockboard",
        attributeKeys: ["thickness_mm", "size", "grade"],
        optionOverrides: {
          size: ["8x4", "7x3", "6x3"],
        },
      },
      {
        name: "Laminates",
        attributeKeys: ["thickness_mm", "size", "finish"],
        optionOverrides: {
          size: ["8x4", "4x8", "1220x2440"],
          finish: ["Glossy", "Matt", "Texture", "Suede"],
        },
      },
    ],
    attributes: [
      {
        key: "size",
        label: "Size",
        dataType: "SELECT",
        // Default fallback; each category overrides via optionOverrides
        options: ["8x4", "7x3", "6x3", "8x3"],
        isRequired: true,
        isFilterable: true,
        isVariantAxis: true,
        isIdentity: true,
        showOnLabel: true,
        sortOrder: 2,
        measureRole: "LENGTH",
        measureUnit: "ft",
        sizePattern: "{L}x{W}",
      },
      {
        key: "thickness_mm",
        label: "Thickness",
        dataType: "NUMBER",
        unit: "mm",
        isRequired: true,
        isFilterable: true,
        isVariantAxis: true,
        isIdentity: true,
        showOnLabel: true,
        validation: { min: 0.5, max: 50 },
        sortOrder: 1,
        measureRole: "THICKNESS",
        measureUnit: "mm",
      },
      {
        key: "grade",
        label: "Grade",
        dataType: "SELECT",
        options: ["MR", "BWR", "BWP", "Commercial"],
        isRequired: true,
        isFilterable: true,
        isIdentity: true,
        showOnLabel: true,
        sortOrder: 3,
      },
      {
        key: "finish",
        label: "Finish",
        dataType: "SELECT",
        options: ["Glossy", "Matt", "Texture", "Suede"],
        isRequired: false,
        isFilterable: true,
        showOnLabel: true,
        sortOrder: 4,
      },
    ],
  },
  {
    templateId: "industry.steel",
    name: "Steel / Metal",
    version: 1,
    description: "Diameter, length, grade, finish for steel products",
    categories: [{ name: "TMT Bars", attributeKeys: ["steel_grade", "diameter_mm", "length_m", "finish"] }],
    attributes: [
      {
        key: "steel_grade",
        label: "Steel Grade",
        dataType: "SELECT",
        options: ["Fe415", "Fe500", "Fe550", "Fe600"],
        isRequired: true,
        isFilterable: true,
        showOnLabel: true,
        sortOrder: 1,
      },
      {
        key: "diameter_mm",
        label: "Diameter",
        dataType: "NUMBER",
        unit: "mm",
        isRequired: true,
        isFilterable: true,
        isVariantAxis: true,
        validation: { min: 6, max: 40 },
        sortOrder: 2,
      },
      {
        key: "length_m",
        label: "Length",
        dataType: "NUMBER",
        unit: "m",
        isRequired: true,
        isFilterable: true,
        validation: { min: 1, max: 18 },
        sortOrder: 3,
      },
      {
        key: "finish",
        label: "Finish",
        dataType: "SELECT",
        options: ["Plain", "Ribbed", "Galvanized"],
        isRequired: false,
        isFilterable: true,
        sortOrder: 4,
      },
    ],
  },
  {
    templateId: "industry.apparel",
    name: "Apparel",
    version: 1,
    description: "Color, size, fabric for clothing",
    categories: [{ name: "Apparel", attributeKeys: ["color", "size_apparel", "fabric", "gender"] }],
    attributes: [
      {
        key: "color",
        label: "Color",
        dataType: "TEXT",
        isRequired: true,
        isFilterable: true,
        isVariantAxis: true,
        sortOrder: 1,
      },
      {
        key: "size_apparel",
        label: "Size",
        dataType: "SELECT",
        options: ["XS", "S", "M", "L", "XL", "XXL"],
        isRequired: true,
        isFilterable: true,
        isVariantAxis: true,
        sortOrder: 2,
      },
      {
        key: "fabric",
        label: "Fabric",
        dataType: "TEXT",
        isRequired: false,
        isFilterable: true,
        sortOrder: 3,
      },
      {
        key: "gender",
        label: "Gender",
        dataType: "SELECT",
        options: ["Men", "Women", "Unisex", "Kids"],
        isRequired: false,
        isFilterable: true,
        sortOrder: 4,
      },
    ],
  },
  {
    templateId: "industry.generic",
    name: "Generic (blank)",
    version: 1,
    description: "No pre-defined attributes — build your own",
    categories: [],
    attributes: [],
  },
];

export function getTemplate(templateId: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.templateId === templateId);
}
