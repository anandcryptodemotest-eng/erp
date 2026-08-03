export { Button, type ButtonProps, buttonVariants } from "./primitives/button";
export { Skeleton } from "./primitives/skeleton";
export { ActionGroup, type ActionGroupProps } from "./primitives/action-group";

export { Input, type InputProps } from "./input";
export { Textarea, type TextareaProps } from "./textarea";
export { Select, type SelectProps, type SelectOption } from "./select";
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./card";
export { Badge, StatusBadge } from "./badge";
export { DataTable, type Column, type BulkAction, type DataTablePagination } from "./data-table";
export { Modal, ConfirmModal, type ModalProps, type ConfirmModalProps } from "./modal";
export { ToastProvider, useToast } from "./toast";
export { Tabs, type TabItem, type TabsProps } from "./tabs";
export { PageHeader, Breadcrumb, type PageHeaderProps, type BreadcrumbItem } from "./page-header";
export { KpiCard, type KpiCardProps } from "./kpi-card";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { Timeline, type TimelineEvent } from "./timeline";
export { FormField, type FormFieldProps } from "./form-field";

export { Chip, ChipGroup } from "./commerce/chip";
export { ProductCard } from "./commerce/product-card";
export { ProductGallery } from "./commerce/product-gallery";
export { PriceDisplay } from "./commerce/price-display";
export { QuantityStepper } from "./commerce/quantity-stepper";
export {
  StockBadge,
  SectionHeader,
  SearchBar,
  CartSummary,
} from "./commerce/commerce-bits";

export { BottomNav, Container, type BottomNavItem } from "./layout/bottom-nav";
export { RouteCard, DeliveryStatus, SignaturePad } from "./field";
export { ChartSlot, CHARTS_READY, type ChartPlaceholder } from "./charts";
export { motion, MOTION_DURATIONS } from "./motion";
export {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  GitBranch,
  Home,
  Inbox,
  LayoutDashboard,
  Building2,
  Loader2,
  LogOut,
  Menu,
  Package,
  Plus,
  ScrollText,
  Search,
  Server,
  Settings,
  ShoppingCart,
  SquarePen,
  Trash2,
  Truck,
  User,
  X,
  type LucideIcon,
} from "./icons";

export { useMediaQuery, usePrefersReducedMotion, useLayoutTier } from "./hooks/use-media-query";
export { MATURITY, type ComponentMaturity } from "./tokens/maturity";
export { cn } from "./utils";

export {
  StudioLayout,
  StepRail,
  SummaryPanel,
  SummaryCard,
  ProductSummaryBlock,
  VariantPreviewGrid,
  MediaPreviewBlock,
  WorkspaceCard,
  MetricTile,
  FooterActions,
  FooterStat,
  StudioSectionCollapse,
  type StudioLayoutProps,
  type StepRailProps,
  type StudioStep,
  type StudioStepStatus,
  type SummaryPanelProps,
  type SummaryCardProps,
  type WarningItem,
  type ProductSummaryBlockProps,
  type VariantPreviewGridProps,
  type VariantPreviewItem,
  type MediaPreviewBlockProps,
  type WorkspaceCardProps,
  type MetricTileProps,
  type FooterActionsProps,
  type FooterStatProps,
  type StudioSectionCollapseProps,
  useAuthoringState,
  usePublishConfirm,
  deepEqual,
  type AuthoringValidation,
  type SaveStatus,
  type UseAuthoringStateOptions,
} from "./authoring";

export {
  StudioProvider,
  StudioKernel,
  useStudioContext,
  createStudioRegistry,
  DesktopRenderer,
  MobileRenderer,
  AutoStudioShell,
  StudioRail,
  StudioWorkspace,
  useStudio,
  useStudioNavigation,
  useStudioWorkflow,
  useStudioEvents,
  useStudioDraft,
  useStudioValidation,
  useStudioForm,
  type StudioDomain,
  type StudioStepDefinition,
  type StudioProviderProps,
  type StudioContextValue,
  type StudioRenderer,
  type StudioRegistry,
  type WorkflowValidationResult,
} from "./studio";

export {
  WorkspaceLayout,
  WorkspaceToolbar,
  WorkspaceFilterBar,
  QueuePanel,
  DetailPanel,
  TaskPanel,
  WorkspaceBottomBar,
  type WorkspaceLayoutProps,
  type WorkspaceToolbarProps,
  type WorkspaceFilterBarProps,
  type WorkspaceBottomBarProps,
} from "./workspace";

export {
  AdminShell,
  type AdminShellProps,
  type AdminShellLinkProps,
  type AdminNavItem,
  type AdminNavGroup,
} from "./shell";
