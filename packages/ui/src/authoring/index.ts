export {
  StudioLayout,
  type StudioLayoutProps,
} from "./StudioLayout";
export {
  StepRail,
  type StepRailProps,
  type StudioStep,
  type StudioStepStatus,
} from "../studio/renderers/desktop/StudioRail";
export {
  SummaryPanel,
  SummaryCard,
  ProductSummaryBlock,
  VariantPreviewGrid,
  MediaPreviewBlock,
  type SummaryPanelProps,
  type SummaryCardProps,
  type WarningItem,
  type ProductSummaryBlockProps,
  type VariantPreviewGridProps,
  type VariantPreviewItem,
  type MediaPreviewBlockProps,
  type SummaryKvRow,
} from "./SummaryPanel";
export { WorkspaceCard, type WorkspaceCardProps } from "./WorkspaceCard";
export { MetricTile, type MetricTileProps } from "./MetricTile";
export {
  FooterActions,
  FooterStat,
  type FooterActionsProps,
  type FooterStatProps,
} from "./FooterActions";
export {
  StudioSectionCollapse,
  type StudioSectionCollapseProps,
} from "./StudioSectionCollapse";
export {
  useAuthoringState,
  usePublishConfirm,
  deepEqual,
  type AuthoringValidation,
  type SaveStatus,
  type UseAuthoringStateOptions,
} from "./useAuthoringState";

/** @deprecated Prefer `@erp/ui` studio exports (StudioProvider, DesktopRenderer, …). */
export {};
