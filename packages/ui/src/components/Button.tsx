import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. */
  variant?: "primary" | "secondary" | "ghost";
}

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "farm-button--primary",
  secondary: "farm-button--secondary",
  ghost: "farm-button--ghost",
};

/**
 * Basic button with three variants: primary (filled), secondary (outlined),
 * and ghost (transparent).
 */
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps): JSX.Element {
  const classes = ["farm-button", variantClass[variant]];
  if (className) classes.push(className);
  return <button type={type} className={classes.join(" ")} {...props} />;
}
