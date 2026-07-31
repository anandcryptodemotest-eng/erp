"use client";

import type { FormEvent, ReactNode } from "react";
import "./product-editor.css";

export function ProductEditorForm({
  title,
  subtitle,
  onClose,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="pe-overlay">
      <form onSubmit={onSubmit} className="pe-dialog">
        <div className="pe-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="pe-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pe-body">{children}</div>
        <div className="pe-footer">{footer}</div>
      </form>
    </div>
  );
}

export function PeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pe-section">
      <h3 className="pe-section-title">{title}</h3>
      {children}
    </section>
  );
}
