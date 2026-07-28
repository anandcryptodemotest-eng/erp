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
        <div className="flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2">
          <span className="text-sm text-indigo-700 font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions.map((ba) => (
              <button
                key={ba.label}
                type="button"
                onClick={() => ba.action(Array.from(selected), selectedRows)}
                className={cn(
                  "text-sm font-medium px-3 py-1 rounded-md",
                  ba.variant === "danger" ? "text-red-600 hover:bg-red-50" : "text-indigo-600 hover:bg-indigo-100"
                )}
              >
                {ba.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {selectable && <td className="px-4 py-4" />}
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
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
                    className={cn("hover:bg-slate-50", onRowClick && "cursor-pointer")}
                  >
                    {selectable && (
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleRow(key)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-6 py-4 text-sm text-slate-900", col.className)}>
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
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {pagination.page} of {pagination.pages} &middot; {pagination.total} total
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
