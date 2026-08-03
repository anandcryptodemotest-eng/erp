import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, required, id, options, placeholder, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--ink)]">
          {label}
          {required && <span className="text-[var(--danger)]"> *</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={cn(
            "flex h-[var(--control-h)] w-full appearance-none rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 pr-9 py-2 text-sm text-[var(--ink)]",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand)]",
            "disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] disabled:bg-[var(--mist)]",
            error && "border-[var(--danger)] focus:ring-[var(--danger)]",
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
      </div>
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--ink-soft)]">{hint}</p>
      ) : null}
    </div>
  )
);
Select.displayName = "Select";

export { Select };
