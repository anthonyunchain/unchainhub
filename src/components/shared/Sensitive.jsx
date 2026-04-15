import { useState } from "react";

/**
 * Masks its children with a dot mask until the user hovers (desktop),
 * focuses (keyboard), or clicks/taps (touch). Used for financial figures
 * that should not be readable at a glance over the shoulder.
 */
export default function Sensitive({ children, mask = "••••", className = "" }) {
  const [show, setShow] = useState(false);
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(v => !v); }}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      role="button"
      aria-label={show ? "Hide value" : "Reveal value"}
      title={show ? "" : "Hover or tap to reveal"}
      className={`inline-block cursor-pointer select-none transition-all ${show ? "" : "tracking-wider"} ${className}`}
    >
      {show ? children : mask}
    </span>
  );
}
