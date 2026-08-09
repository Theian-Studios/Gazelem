import { useState, useEffect, useCallback } from "react";
import { glassPill, ink, inkSoft, blue } from "../theme.js";

// The bar that steps through what was found on this page. It holds only which
// match is current; the marks themselves are drawn by the reader, and this
// walks them in document order — which is verse order, since that is how they
// were rendered.
export default function FindBar({ query, total, onClose }) {
  const [at, setAt] = useState(0);

  // A new search, or a new chapter under the same one, starts at the top.
  useEffect(() => setAt(0), [query, total]);

  useEffect(() => {
    const marks = document.querySelectorAll("mark.find-hit");
    marks.forEach((m, i) => m.toggleAttribute("data-current", i === at));
    marks[at]?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Leaving marked text behind after the bar closes would be a lie about
    // what is current, so the last one is cleared on the way out.
    return () => marks.forEach((m) => m.removeAttribute("data-current"));
  }, [at, query, total]);

  const step = useCallback((d) => {
    if (!total) return;
    setAt((i) => (i + d + total) % total);
  }, [total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      // Enter walks forward, shift-Enter back — the same keys a browser's own
      // find uses, and they only reach here when the field is not focused.
      if (e.key !== "Enter") return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  // Every button the same square, and every glyph drawn rather than typed: the
  // ‹ › ✕ characters carry their own side bearings, which sit them off-centre
  // in a circle by a pixel or two each — enough to read as crooked in a row.
  const btn = {
    border: 0, background: "transparent", borderRadius: 999, width: BTN, height: BTN,
    display: "grid", placeItems: "center",
  };
  const dim = "rgba(110,110,115,.35)";

  return (
    <div className="findbar" role="status" aria-live="polite">
      <div style={{ ...glassPill, display: "flex", alignItems: "center", gap: 2, padding: PAD, pointerEvents: "auto" }}>
        {/* Inset to match the glyph at the far end, so the row reads centred
            in the pill rather than tucked against its left edge. */}
        <span className="find-term" style={{ marginLeft: TERM_INSET }} title={`Found on this page: ${query}`}>
          {query}
        </span>
        <span className="find-count">{total ? `${at + 1}/${total}` : "0"}</span>
        <button className="tap" onClick={() => step(-1)} disabled={!total} aria-label="Previous match"
          style={{ ...btn, color: total ? blue : dim, cursor: total ? "pointer" : "default" }}>
          <Chevron dir={-1} />
        </button>
        <button className="tap" onClick={() => step(1)} disabled={!total} aria-label="Next match"
          style={{ ...btn, color: total ? blue : dim, cursor: total ? "pointer" : "default" }}>
          <Chevron dir={1} />
        </button>
        <button className="tap" onClick={onClose} aria-label="Stop finding on this page"
          style={{ ...btn, color: inkSoft, cursor: "pointer" }}>
          <Cross />
        </button>
      </div>
    </div>
  );
}

// The pill's measurements, kept here because the text at the left has to be
// inset by the same distance the glyph at the right is — half the difference
// between a button and its glyph — or the row sits off-centre in its own pill.
const BTN = 34;
const GLYPH = 12;
const PAD = 5;
const TERM_INSET = (BTN - GLYPH) / 2;

function Chevron({ dir }) {
  return (
    <svg aria-hidden width={GLYPH} height={GLYPH} viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", transform: dir < 0 ? "none" : "scaleX(-1)" }}>
      <path d="M7.5 2 L3.5 6 L7.5 10" />
    </svg>
  );
}

function Cross() {
  return (
    <svg aria-hidden width={GLYPH} height={GLYPH} viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ display: "block" }}>
      <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" />
    </svg>
  );
}
