import type { InputHTMLAttributes } from "react";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Accessible label for the magnifier icon button. */
  iconLabel?: string;
}

/**
 * A text input with a leading search glyph, styled as a pill. Pass `value`
 * and `onChange` to control it.
 */
export function SearchInput({
  iconLabel = "Search",
  className,
  ...props
}: SearchInputProps): JSX.Element {
  return (
    <label className={["farm-search", className].filter(Boolean).join(" ")}>
      <span className="farm-search__icon" aria-label={iconLabel} role="img">
        🔍
      </span>
      <input type="search" className="farm-search__input" {...props} />
    </label>
  );
}
