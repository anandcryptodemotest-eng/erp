"use client";

import { type ReactNode, useState } from "react";
import { cn } from "./utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  width?: string;
}

export interface BulkAction<T> {
  label: string;
  variant?: "primary" | "danger";
  action: (ids: string[], rows: T[]) => void;
}

export interface DataTablePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  pagination?: DataTablePagination;
  onPageChange?: (page: number) => void;
  filters?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  emptyMessage = "No data found",
  loading = false,
  onRowClick,
  selectable = false,
  bulkActions,
  pagination,
  onPageChange,
  filters,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rowKey = (item: T) => String(item[keyField]);
  const allSelected = data.length > 0 && selected.size === data.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(data.map(rowKey)));
  };

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedRows = data.filter((d) => selected.has(rowKey(d)));

  return (
    <div className="space-y-3">
      {filters && <div className="flex items-center gap-3">{filters}</div>}

      {selectable && selectedRows.length > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] border border-[color-mix(in_srgb,var(--brand)_20%,transparent)] px-4 py-2">
          <span className="text-sm text-[var(--brand-mid)] font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions.map((ba) => (
              <button
                key={ba.label}
                type="button"
                onClick={() => ba.action(Array.from(selected), selectedRows)}
                className={cn(
                  "text-sm font-medium px-3 py-1 rounded-[var(--radius-sm)]",
                  ba.variant === "danger"
                    ? "text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                    : "text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_15%,transparent)]"
                )}
              >
                {ba.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--line)]">
        <table className="min-w-full divide-y divide-[var(--line)]">
          <thead className="bg-[var(--mist)]">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--ink-soft)]",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] bg-[var(--surface-raised)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {selectable && <td className="px-4 py-4" />}
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-[var(--mist)] rounded-[var(--radius-sm)] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const key = rowKey(item);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={cn("hover:bg-[var(--mist)]", onRowClick && "cursor-pointer")}
                  >
                    {selectable && (
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleRow(key)}
                          className="rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)]"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-6 py-4 text-sm text-[var(--ink)]", col.className)}>
                        {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
          <span>
            Page {pagination.page} of {pagination.pages} &middot; {pagination.total} total
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] disabled:opacity-[var(--opacity-disabled)] hover:bg-[var(--mist)]"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] disabled:opacity-[var(--opacity-disabled)] hover:bg-[var(--mist)]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
