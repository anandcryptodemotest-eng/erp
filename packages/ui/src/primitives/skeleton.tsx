"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../utils";

/** @maturity beta */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--mist)]", className)}
      aria-hidden
      {...props}
    />
  );
}
