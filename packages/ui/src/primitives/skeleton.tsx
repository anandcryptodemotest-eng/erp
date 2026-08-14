"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../utils";

/** @maturity stable — Design System v2 skeleton (no layout shift: reserve space with width/height) */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("erp-skeleton", className)} aria-hidden {...props} />;
}
