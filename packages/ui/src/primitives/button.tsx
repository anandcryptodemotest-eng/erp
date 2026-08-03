"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

/** @maturity stable */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-[background,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)] active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--forest)] text-white hover:bg-[var(--forest-mid)] shadow-[var(--shadow-sm)] rounded-[var(--radius-full)]",
        secondary:
          "bg-[var(--amber)] text-[var(--ink)] hover:bg-[var(--amber-soft)] shadow-[var(--shadow-sm)] rounded-[var(--radius-full)]",
        outline:
          "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--mist)] rounded-[var(--radius-full)]",
        ghost: "text-[var(--ink-soft)] hover:bg-[var(--mist)] rounded-[var(--radius-full)]",
        danger: "bg-[var(--danger)] text-white hover:opacity-90 rounded-[var(--radius-full)]",
        link: "text-[var(--forest-mid)] underline-offset-4 hover:underline p-0 h-auto rounded-none",
      },
      size: {
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-[var(--touch-min)] px-5 text-sm",
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
