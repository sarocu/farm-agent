import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * A bordered surface that groups related content with optional header
 * actions and footer.
 */
export function Card({
  title,
  actions,
  footer,
  children,
  className,
}: CardProps): JSX.Element {
  return (
    <section className={["farm-card", className].filter(Boolean).join(" ")}>
      {(title || actions) && (
        <header className="farm-card__header">
          {title ? <h3 className="farm-card__title">{title}</h3> : <span />}
          {actions}
        </header>
      )}
      <div className="farm-card__body">{children}</div>
      {footer && <footer className="farm-card__footer">{footer}</footer>}
    </section>
  );
}
