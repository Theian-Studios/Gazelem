import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getSuggestions } from "../lib/search.js";
import { VOL_SHORT } from "../data/volumes.js";
import { glassInset, glassOverlay, ink, inkSoft } from "../theme.js";

export default function SearchBox({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [anchor, setAnchor] = useState(null);
  const inputRef = useRef(null);
  const fieldRef = useRef(null);

  // The menu is portalled to <body>, so it needs the field's viewport rect.
  const measure = useCallback(() => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  const apply = useCallback((v) => {
    setQuery(v);
    const sugg = getSuggestions(v);
    setSuggestions(sugg);
    setOpen(sugg.length > 0);
    setActiveIdx(sugg.length > 0 ? 0 : -1);
  }, []);

  // Typing anywhere starts a search. The keystroke happens on <body>, so
  // focusing the field alone would swallow it — the character is applied here
  // and the field picks up from there.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1 || e.key === " ") return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!window.getSelection()?.isCollapsed) return;   // mid-selection, leave it alone
      e.preventDefault();
      inputRef.current?.focus();
      apply(query + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, query]);

  const choose = (s) => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    onNavigate(s);
  };

  const onChange = (e) => apply(e.target.value);

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") { setOpen(false); e.target.blur(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === "Enter") { e.preventDefault(); choose(suggestions[Math.max(0, activeIdx)]); }
    else if (e.key === "Escape") { setOpen(false); e.target.blur(); }
  };

  return (
    <>
      <div ref={fieldRef} className="searchbar" style={{ ...glassInset, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "8px 12px" }}>
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke={inkSoft} strokeWidth="2.1" strokeLinecap="round" style={{ flexShrink: 0, display: "block" }}>
          <circle cx="11" cy="11" r="6.5" />
          <line x1="16" y1="16" x2="21" y2="21" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Go to a scripture reference"
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Search"
          style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 15, color: ink, minWidth: 0 }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); inputRef.current?.focus(); }} aria-label="Clear search" className="lift"
            style={{ border: 0, background: "rgba(110,110,115,.14)", borderRadius: 999, width: 20, height: 20, fontSize: 11, color: inkSoft, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}>
            ✕
          </button>
        )}
      </div>

      {/* Portalled to <body>: the header sets backdrop-filter, which makes it a
          backdrop root — a menu nested inside it can only sample the header's
          own (empty) contents, so its blur would silently do nothing. */}
      {open && suggestions.length > 0 && anchor && createPortal(
        <div role="listbox" className="dropdown" style={{ ...glassOverlay, position: "fixed", top: anchor.top, left: anchor.left, width: anchor.width, borderRadius: 16, padding: 6, zIndex: 40, maxHeight: 340, overflowY: "auto" }}>
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              role="option"
              className="lift"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", border: 0, cursor: "pointer", padding: "11px 14px", borderRadius: 11, background: i === activeIdx ? "rgba(58,90,140,.10)" : "transparent" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 16, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              </span>
              <span style={{ color: inkSoft, fontSize: 11.5, fontWeight: 600, letterSpacing: ".04em", background: "rgba(110,110,115,.10)", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
                {VOL_SHORT[s.v]}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
