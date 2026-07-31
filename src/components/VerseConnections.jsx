import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { glassOverlay, ink, inkSoft, gold, blue } from "../theme.js";
import { parseCitations, loadPassage } from "../lib/refs.js";

// What to mark in the passage a note points at: the run of this chapter's text
// the connection hangs on, and any wording the gloss lifts from the target
// itself. The anchor phrase is usually the wording the two places share — that
// is what makes them a connection — so it is the thing worth finding.
function marksFor(c) {
  return [c.snippet, c.quote]
    .filter(Boolean)
    // An ellipsis means the quote is not contiguous, so each part stands alone.
    .flatMap((s) => s.split(/\s*(?:\.{3}|…)\s*/))
    .map((s) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim())
    .filter((s) => s.length > 3);
}

// Passages are fetched the first time an anchor is opened, so a chapter full of
// highlights costs nothing until one is actually used.
function usePassages(connections) {
  const [passages, setPassages] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const c of connections) {
        for (const cite of parseCitations(c.source)) {
          const verses = await loadPassage(cite);
          if (!alive) return;
          if (verses.length) out.push({ cite, label: cite.label, verses, marks: marksFor(c) });
        }
      }
      if (alive) setPassages(out);
    })();
    return () => { alive = false; };
  }, [connections]);

  return passages;
}

// Bolds the wording the connection turns on, wherever it appears in the
// passage being shown.
function Marked({ text, marks }) {
  if (!marks?.length) return text;

  // Longest first, so a phrase wins over any shorter phrase inside it.
  const escaped = [...marks]
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pieces = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  if (pieces.length === 1) return text;

  // split() with one capture group puts the matches at the odd indices, which
  // is what marks them — testing the regex again would misfire, since a global
  // one carries its lastIndex between calls.
  return pieces.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 700, color: ink }}>{p}</strong>
      : <span key={i}>{p}</span>
  );
}

function Popup({ anchorEl, connections, hold, release, onOpenRef }) {
  const passages = usePassages(connections);
  const [box, setBox] = useState(() => place(anchorEl));

  // Re-place on scroll so the card travels with the phrase it belongs to.
  useEffect(() => {
    const sync = () => setBox(place(anchorEl));
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [anchorEl]);

  return createPortal(
    <div
      className="conn-pop"
      onMouseEnter={hold}
      onMouseLeave={release}
      style={{
        ...glassOverlay, position: "fixed", top: box.top, left: box.left, width: box.width,
        borderRadius: 14, padding: "12px 14px", zIndex: 70,
        maxHeight: "58vh", overflowY: "auto", userSelect: "text", cursor: "auto",
      }}
    >
      {connections.map((c, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "baseline", marginBottom: 3 }}>
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: gold, minWidth: 22 }}>{c.id}</span>
            <span className="serif" style={{ fontSize: 13, fontWeight: 600, color: ink }}>{c.source}</span>
          </div>
          {c.gloss && <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: inkSoft }}>{c.gloss}</p>}
        </div>
      ))}

      <div style={{ borderTop: "1px solid rgba(31,45,71,.10)", paddingTop: 8 }}>
        {passages === null && <p style={{ margin: 0, fontSize: 11.5, color: inkSoft }}>Loading passage…</p>}
        {passages?.length === 0 && <p style={{ margin: 0, fontSize: 11.5, color: inkSoft }}>Passage text unavailable.</p>}
        {passages?.map((p, i) => (
          <div key={i} style={{ marginBottom: i === passages.length - 1 ? 0 : 12 }}>
            <button
              className="conn-goto"
              onClick={() => onOpenRef(p.cite)}
              title={`Open ${p.label}`}
            >
              {p.label} <span aria-hidden>→</span>
            </button>
            {p.verses.map((v) => (
              <p key={v.verse} className="serif" style={{ margin: "0 0 4px", fontSize: 12.5, lineHeight: 1.6, color: inkSoft }}>
                <span style={{ color: gold, fontSize: 10.5, marginRight: 5 }}>{v.verse}</span>
                <Marked text={v.text} marks={p.marks} />
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

const WIDTH = 330;
function place(el) {
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(r.left, 8), window.innerWidth - WIDTH - 8);
  const below = r.bottom + 8;
  const top = below + 260 > window.innerHeight ? Math.max(r.top - 268, 8) : below;
  return { top, left, width: WIDTH };
}

// A gold run of verse text that reveals its cross connections on hover.
export default function ConnectionAnchor({ connections, onOpenRef, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  const hold = useCallback(() => clearTimeout(timer.current), []);
  const release = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 220);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape closes it; clicking inside must not, or the text can't be selected.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        className="conn-anchor"
        /* Footnote letters are drawn by CSS from this attribute rather than as
           a child element: generated content is not part of the DOM text, so
           selecting a verse still copies the scripture without the markers. */
        data-marks={connections.map((c) => c.id.replace(/^\d+/, "")).join("")}
        role="button"
        tabIndex={0}
        aria-label={`${connections.length} cross connection${connections.length > 1 ? "s" : ""}`}
        onMouseEnter={() => { hold(); setOpen(true); }}
        onMouseLeave={release}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </span>
      {open && ref.current && (
        <Popup anchorEl={ref.current} connections={connections} hold={hold} release={release} onOpenRef={onOpenRef} />
      )}
    </>
  );
}
