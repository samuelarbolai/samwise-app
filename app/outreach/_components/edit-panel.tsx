"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

interface EditPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function EditPanel({ title, onClose, children, footer }: EditPanelProps) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="edit-panel__scrim"
        onClick={onClose}
      />
      <aside className="edit-panel" role="dialog" aria-label={title}>
        <header className="edit-panel__head">
          <span className="label-eyebrow">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="edit-panel__close"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="edit-panel__body">{children}</div>
        {footer ? <footer className="edit-panel__foot">{footer}</footer> : null}
      </aside>
    </>
  );
}
