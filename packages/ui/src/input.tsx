import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, required, id, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--ink)]">
          {label}
          {required && <span className="text-[var(--danger)]"> *</span>}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "flex h-[var(--control-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] placeholder:opacity-60",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand)]",
          "disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]",
          error && "border-[var(--danger)] focus:ring-[var(--danger)]",
          className
        )}
        ref={ref}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--ink-soft)]">{hint}</p>
      ) : null}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
