import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { glassOverlay, ink, inkSoft, gold, blue } from "../theme.js";
import { parseCitations, loadPassage } from "../lib/refs.js";
import { placeCard } from "../lib/place.js";

// How much of the passage to show on either side of the words that answer this
// one: enough to read the run as a sentence, not so much that the card becomes
// the chapter.
const CONTEXT = 7;

// The run of the target verse a connection actually points at, with a little of
// the verse around it.
//
// Not the verse from its beginning. A long verse whose relevant clause sits at
// the end — Mosiah 18:9's first-resurrection clause is words 56 to 62 of 68 —
// would open on words that have nothing to do with why the connection exists,
// and read as the wrong footnote. The notes give the run's word positions, so it
// is found rather than searched for: positions count whitespace-separated tokens
// after the verse number, which is how they were computed.
function excerpt(text, words) {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  if (!words) return null;
  const [w1, w2] = words;
  const from = Math.max(0, w1 - 1 - CONTEXT);
  const to = Math.min(tokens.length, w2 + CONTEXT);
  return {
    before: (from > 0 ? "… " : "") + tokens.slice(from, w1 - 1).join(" "),
    span: tokens.slice(w1 - 1, w2).join(" "),
    after: tokens.slice(w2, to).join(" ") + (to < tokens.length ? " …" : ""),
  };
}

// The verse as the card shows it: the answering run in bold, its surroundings
// plain. A target without word positions is shown whole.
function Excerpt({ text, words }) {
  const w = excerpt(text, words);
  if (!w) return text;
  return (
    <>
      {w.before && `${w.before} `}
      <strong style={{ fontWeight: 700, color: ink }}>{w.span}</strong>
      {w.after && ` ${w.after}`}
    </>
  );
}

// Passages are fetched the first time an anchor is opened, so a chapter full of
// highlights costs nothing until one is actually used.
//
// One entry per target rather than per connection: a connection may answer in
// two places at once — a formula sounded in two verses — and each is its own
// passage with its own run to show.
function useTargets(connections) {
  const [shown, setShown] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const c of connections) {
        // A connection written without targets falls back to the passage its
        // heading names, shown whole for want of anything finer.
        const wanted = c.targets?.length
          ? c.targets.map((t) => ({ label: t.label, words: t.words, cite: parseCitations(t.label)[0] }))
          : parseCitations(c.source).map((cite) => ({ label: cite.label, words: null, cite }));
        for (const t of wanted) {
          if (!t.cite) continue;
          const verses = await loadPassage(t.cite);
          if (!alive) return;
          if (verses.length) out.push({ ...t, verses });
        }
      }
      if (alive) setShown(out);
    })();
    return () => { alive = false; };
  }, [connections]);

  return shown;
}

function Popup({ anchorEl, connections, hold, release, onOpenRef, popRef }) {
  const passages = useTargets(connections);
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
      ref={popRef}
      className="conn-pop"
      onMouseEnter={hold}
      onMouseLeave={release}
      style={{
        ...glassOverlay, position: "fixed", top: box.top, bottom: box.bottom, left: box.left, width: box.width,
        borderRadius: 14, padding: "12px 14px", zIndex: 70,
        // The height is the room the placement found, not a share of the
        // window: see lib/place.js.
        maxHeight: box.maxHeight, overflowY: "auto", userSelect: "text", cursor: "auto",
      }}
    >
      {connections.map((c, i) => {
        // The heading is the door to the passage now. It used to be the small
        // gold label further down, which with a single passage under it said the
        // same reference twice — once as the heading and once as the way in.
        const cite = parseCitations(c.source)[0];
        return (
          <div key={i} style={{ marginBottom: 6 }}>
            {/* The letter and the passage it stands for. The letter is the one
                in the margin the reader just pressed, so it is set at reading
                size rather than as a footnote's whisper, and with no column of
                its own — on a fixed width it stood off across a gap wide enough
                to read as a separate thing. */}
            <div style={{ display: "flex", gap: 5, alignItems: "baseline", marginBottom: 3 }}>
              {/* Once, not once per row: every connection in this card hangs on
                  the one run of words, so they all carry the letter the reader
                  pressed and printing it again down the card says nothing. */}
              {i === 0 && (
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: gold }}>{c.id}</span>
              )}
              {cite && onOpenRef ? (
                <button type="button" className="serif conn-head"
                  onClick={() => onOpenRef(cite)} title={`Open ${c.source}`}>
                  {c.source}
                </button>
              ) : (
                <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: ink }}>{c.source}</span>
              )}
            </div>
            {c.gloss && <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: inkSoft }}>{c.gloss}</p>}
          </div>
        );
      })}

      <div style={{ borderTop: "1px solid rgba(31,45,71,.10)", paddingTop: 6 }}>
        {passages === null && <p style={{ margin: 0, fontSize: 12.5, color: inkSoft }}>Loading passage…</p>}
        {passages?.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: inkSoft }}>Passage text unavailable.</p>}
        {passages?.map((p, i) => (
          <div key={i} style={{ marginBottom: i === passages.length - 1 ? 0 : 12 }}>
            {/* Two connections on one run of words bring two passages, and then
                each needs saying which it is. One passage is already named by
                the heading above it. */}
            {passages.length > 1 && (
              <button
                className="conn-goto"
                onClick={() => onOpenRef(p.cite)}
                title={`Open ${p.label}`}
              >
                {p.label}
              </button>
            )}
            {p.verses.map((v) => (
              <p key={v.verse} className="serif" style={{ margin: "0 0 5px", fontSize: 13.5, lineHeight: 1.62, color: inkSoft }}>
                {/* The number tells one verse of the passage from the next; a
                    passage of one verse has already been numbered by the
                    reference at the top of the card. */}
                {p.verses.length > 1 && <span style={{ color: gold, fontSize: 11, marginRight: 5 }}>{v.verse}</span>}
                <Excerpt text={v.text} words={p.words} />
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

// Its own width, or the whole screen less a margin on a phone too narrow for
// it, and as tall as the side it lands on allows.
const place = (el) => placeCard(el, { width: 330, cap: 0.58 });

// A gold run of verse text that reveals its cross connections on hover.
export default function ConnectionAnchor({ connections, onOpenRef, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pop = useRef(null);
  const timer = useRef(null);

  const hold = useCallback(() => clearTimeout(timer.current), []);
  const release = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 220);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape closes it; clicking inside must not, or the text can't be selected.
  //
  // A press anywhere else closes it too, which on a phone is the only way out:
  // there is no key to press and no pointer to move away, so without this the
  // card could only be dismissed by finding the same small marker again. The
  // popup is portalled to the body, so it is outside the anchor's subtree and
  // has to be asked separately. Listening on pointerdown rather than click
  // means a press that begins outside dismisses on the way down, before it can
  // land on whatever is under it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => {
      const t = e.target;
      if (ref.current?.contains(t) || pop.current?.contains(t)) return;
      clearTimeout(timer.current);
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        className="conn-anchor"
        /* Footnote letters are drawn by CSS from this attribute rather than as
           a child element: generated content is not part of the DOM text, so
           selecting a verse still copies the scripture without the markers. */
        data-marks={[...new Set(connections.map((c) => c.id.replace(/^\d+/, "")))].join("")}
        role="button"
        tabIndex={0}
        aria-label={`${connections.length} cross connection${connections.length > 1 ? "s" : ""}`}
        /* Hovering is a mouse's alone. A tap fires mouseenter and focus for
           compatibility before it fires click, so bound to those the popup
           opened and the tap that opened it closed it again — and the second
           tap, with no fresh mouseenter behind it, was what appeared to open
           it. The pointer says which kind of press this is; focus opens only
           where the keyboard put it, which is what `:focus-visible` means. */
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { hold(); setOpen(true); } }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") release(); }}
        onFocus={(e) => { if (e.target.matches(":focus-visible")) setOpen(true); }}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </span>
      {open && ref.current && (
        <Popup anchorEl={ref.current} connections={connections} hold={hold} release={release} onOpenRef={onOpenRef} popRef={pop} />
      )}
    </>
  );
}
