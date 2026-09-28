import type { ReactNode } from "react";

export interface TagProps {
  children: ReactNode;
  className?: string;
}

/**
 * A small pill label for categories, statuses, and other inline metadata.
 */
export function Tag({ children, className }: TagProps): JSX.Element {
  return (
    <span className={["farm-tag", className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
