import { type ReactNode } from "react";
import { cn } from "./utils";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Wraps arbitrary custom inputs (comboboxes, tag pickers, etc.) with the standard label/error pattern. */
export function FormField({ label, htmlFor, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--ink)]">
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--ink-soft)]">{hint}</p>
      ) : null}
    </div>
  );
}
