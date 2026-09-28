import type { ReactNode } from "react";
import { useEffect } from "react";

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * A centered overlay dialog. Closes on Escape and on overlay click.
 * Renders nothing when `open` is false.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="farm-modal__overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="farm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Dialog"}
      >
        <header className="farm-modal__header">
          <h2 className="farm-modal__title">{title}</h2>
          <button
            type="button"
            className="farm-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="farm-modal__body">{children}</div>
        {footer ? <footer className="farm-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
