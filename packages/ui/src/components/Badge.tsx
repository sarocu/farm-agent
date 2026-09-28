import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  variant?: "danger" | "info" | "warn" | "success";
  className?: string;
}

const variantClass: Record<NonNullable<BadgeProps["variant"]>, string> = {
  danger: "",
  info: "farm-badge--info",
  warn: "farm-badge--warn",
  success: "farm-badge--success",
};

/**
 * A numeric count or status indicator. Defaults to the danger (red) color.
 */
export function Badge({
  children,
  variant = "danger",
  className,
}: BadgeProps): JSX.Element {
  const classes = ["farm-badge", variantClass[variant]];
  if (className) classes.push(className);
  return <span className={classes.join(" ")}>{children}</span>;
}
