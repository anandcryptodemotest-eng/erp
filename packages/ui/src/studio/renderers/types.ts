import type { ComponentType, ReactNode } from "react";

/** Contract: chrome only; consume kernel through hooks. */
export type StudioRendererProps = {
  onClose?: () => void;
  className?: string;
  header?: ReactNode;
};

export type StudioRenderer = ComponentType<StudioRendererProps>;
