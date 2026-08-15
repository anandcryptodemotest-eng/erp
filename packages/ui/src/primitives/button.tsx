"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

/** @maturity stable — Design System v2 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-semibold",
    "transition-[background,transform,box-shadow,border-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
    "disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)]",
    "active:scale-[var(--press-scale)]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand)] text-[var(--ink-inverse)] hover:bg-[var(--brand-dark)] shadow-[var(--shadow-1)] rounded-[var(--radius-sm)]",
        secondary:
          "border border-[var(--line-strong)] bg-[var(--surface-raised)] text-[var(--ink)] hover:bg-[var(--surface-sunken)] shadow-[var(--shadow-1)] rounded-[var(--radius-sm)]",
        outline:
          "border border-[var(--line-strong)] bg-[var(--surface-raised)] text-[var(--ink)] hover:bg-[var(--surface-sunken)] shadow-[var(--shadow-1)] rounded-[var(--radius-sm)]",
        ghost: "text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)] rounded-[var(--radius-sm)]",
        danger: "bg-[var(--danger)] text-white hover:opacity-90 rounded-[var(--radius-sm)] shadow-[var(--shadow-1)]",
        link: "text-[var(--brand)] underline-offset-4 hover:underline p-0 h-auto rounded-none shadow-none",
      },
      size: {
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-[var(--control-h)] px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "h-[var(--touch-min)] w-[var(--touch-min)]",
        block: "min-h-12 w-full px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
