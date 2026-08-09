import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { glassOverlay } from "../theme.js";
import { versesLabel } from "../lib/mentions.js";

// A mark in the margin of a chapter the site has written about, and the list of
// what it has written. The relation already runs one way — on a chart every
// reference opens into the text — and this is the way back: standing in 1 Nephi
// 16, the reader is told that "And Thus We See" speaks to verse 29.
//
// One mark to a chapter, in the margin beside its title. In the margin because
// the cross connections already mark the text itself, setting the run they hang
// on in gold with a footnote letter after it, and a second kind of gold in the
// same sentence is one too many to tell apart. One because a chart treating
// four verses of a chapter was four marks down the gutter all leading to the
// same chart — the card names the verses instead, which says the same thing
// once.

// Its own width, or the screen less a margin on a phone too narrow for it.
// Opens downward unless there is no room, as the connections' card does.
function place(el) {
  const width = Math.min(300, window.innerWidth - 16);
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(r.left - 8, 8), window.innerWidth - width - 8);
  const below = r.bottom + 8;
  const top = below + 200 > window.innerHeight ? Math.max(r.top - 208, 8) : below;
  return { top, left, width };
}

function Popup({ anchorEl, pages, onOpen, hold, release, popRef }) {
  const [box, setBox] = useState(() => place(anchorEl));

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
    <div ref={popRef} className="sm-pop" onMouseEnter={hold} onMouseLeave={release}
      style={{ ...glassOverlay, position: "fixed", top: box.top, left: box.left, width: box.width }}>
      <ul className="sm-pop-list">
        {pages.map((p) => (
          <li key={p.section}>
            <button className="sm-pop-row" onClick={() => onOpen(p)} title={`Open ${p.title}`}>
              <span className="serif sm-pop-name">{p.title}</span>
              <span className="sm-pop-meta">
                <span className="sm-pop-kind">{p.kind}</span>
                {p.verses.length > 0 && <span className="sm-pop-verses">{versesLabel(p.verses)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

// Only one mark stands open at a time. Hovering closes the last one on its own,
// but a press is a toggle and two pressed marks would otherwise leave two cards
// over the page at once, each about a different verse.
let closeOpen = null;

export default function StudyMarker({ pages, onOpen, wide }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pop = useRef(null);
  const timer = useRef(null);

  // This marker's own closer, so it only ever gives the slot up while the slot
  // is still its. A marker closing on the 220ms release below can find that
  // another has opened in the meantime, and clearing the slot then would throw
  // away the closer of a card that is still on screen — leaving the next one to
  // open beside it, which is the pair this exists to prevent.
  const mine = useRef(null);

  const show = useCallback((v) => {
    setOpen((was) => {
      if (v && !was) {
        closeOpen?.();
        mine.current = () => setOpen(false);
        closeOpen = mine.current;
      }
      if (!v && closeOpen === mine.current) closeOpen = null;
      return v;
    });
  }, []);
  useEffect(() => () => { if (closeOpen === mine.current) closeOpen = null; }, []);

  const hold = useCallback(() => clearTimeout(timer.current), []);
  const release = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => show(false), 220);
  }, [show]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape closes it, and so does a press anywhere else — the card is opened by
  // a tap on a phone, where there is no pointer to move away and no key to
  // press, and finding the same small mark again is the only way out it had.
  // The card is portalled to the body, outside the mark's subtree, so it has to
  // be asked separately; checking the mark alone would close the card on every
  // press inside it and put its own rows out of reach.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && show(false);
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || pop.current?.contains(e.target)) return;
      clearTimeout(timer.current);
      show(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, show]);

  if (!pages?.length) return null;

  const label = `${pages.length} study page${pages.length > 1 ? "s" : ""} on this ${wide ? "chapter" : "passage"}`;

  return (
    <>
      <button ref={ref} className="sm-mark"
        aria-label={label} title={label}
        /* Only a mouse hovers. A tap fires mouseenter and focus before it fires
           click, so bound to those the card opened and the tap that opened it
           toggled it shut again. */
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { hold(); show(true); } }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") release(); }}
        onFocus={(e) => { if (e.target.matches(":focus-visible")) show(true); }}
        onClick={() => show(!open)}>
        {/* Ruled lines with one of them marked: a page of the site's own, as
            against the scripture beside it. Drawn small enough to be furniture
            until it is looked for. */}
        <svg viewBox="0 0 12 12" aria-hidden fill="none"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M2 2.6h8M2 6h8M2 9.4h5" />
        </svg>
      </button>
      {open && ref.current && (
        <Popup anchorEl={ref.current} pages={pages} onOpen={onOpen} hold={hold} release={release} popRef={pop} />
      )}
    </>
  );
}
