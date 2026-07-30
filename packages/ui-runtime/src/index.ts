export * from "./types";
export * from "./events";
export * from "./theme";
export * from "./registry";
export * from "./screen";
export * from "./payload";
export * from "./layout";
export * from "./runtime";
export * from "./host";

export {
  registerActivity,
  getActivity,
  listActivities,
  registerTheme,
  getTheme,
  listThemes,
  registerExtension,
  listExtensions,
  getExtension,
} from "@erp/extensions";
