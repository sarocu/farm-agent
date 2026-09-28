import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Optional decorative icon or emoji above the title. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call-to-action, e.g. a `<Button>`. */
  action?: ReactNode;
  className?: string;
}

/**
 * Placeholder shown when a list, table, or page has no content yet.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={["farm-empty", className].filter(Boolean).join(" ")}>
      {icon ? <div className="farm-empty__icon">{icon}</div> : null}
      <h3 className="farm-empty__title">{title}</h3>
      {description ? (
        <p className="farm-empty__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
