import { glass } from "../theme.js";

// A panel whose heading pins to the top of its scroll column and doubles as the
// collapse control. Collapsed state is held by the caller and keyed by `id`, so
// a card the reader has folded away stays folded as chapters change.
//
// overflow: clip rounds off the sticky heading's square corners without
// breaking its sticky positioning (hidden would).
const CARD = { ...glass, borderRadius: 18, padding: "14px 16px", overflow: "clip" };

function Chevron({ open }) {
  return (
    <svg className="card-chevron" data-open={open} width="9" height="6" viewBox="0 0 9 6" aria-hidden focusable="false">
      <path d="M1 1.5 L4.5 5 L8 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Card({ id, title, label, collapsed, onToggle, className = "", style, children }) {
  const open = !collapsed;
  return (
    <section
      className={`${className}`.trim()}
      data-collapsed={collapsed ? "true" : undefined}
      style={{ ...CARD, ...style }}
      aria-label={label}
    >
      <h3 className="commentary-head">
        <button className="card-toggle" onClick={() => onToggle(id)} aria-expanded={open}>
          <span>{title}</span>
          <Chevron open={open} />
        </button>
      </h3>
      {open && children}
    </section>
  );
}
