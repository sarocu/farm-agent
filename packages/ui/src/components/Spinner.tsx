export interface SpinnerProps {
  /** Accessible label announced to screen readers. */
  label?: string;
  className?: string;
}

/**
 * An inline loading indicator. Pair with `aria-label` for screen readers.
 */
export function Spinner({ label, className }: SpinnerProps): JSX.Element {
  return (
    <span
      className={["farm-spinner", className].filter(Boolean).join(" ")}
      role="status"
      aria-label={label}
    />
  );
}
