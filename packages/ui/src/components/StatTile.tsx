import type { ReactNode } from "react";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/**
 * A compact metric tile: uppercase label, large value, optional hint line.
 */
export function StatTile({
  label,
  value,
  hint,
  className,
}: StatTileProps): JSX.Element {
  return (
    <div className={["farm-stat", className].filter(Boolean).join(" ")}>
      <span className="farm-stat__label">{label}</span>
      <span className="farm-stat__value">{value}</span>
      {hint ? <span className="farm-stat__hint">{hint}</span> : null}
    </div>
  );
}
