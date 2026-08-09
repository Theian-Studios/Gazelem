import { useEffect, useState } from "react";
import { ink } from "../theme.js";

// The study panels, on a screen with one column.
//
// Wide, the panels stand in a column of their own beside the chapter and are
// simply there. Narrow there is no such column, so each one folds down to a
// circle in the top corners and opens over the page when it is pressed. The
// corners are chosen because the middle is the chapter: a marker in the margin
// costs the reader nothing until they reach for it.
//
// Which side a panel sits on is what it is for. The left is where you are —
// the contents, what the chapter is, when it happened, what it sits beside.
// The right is what has been said about it — the notes, what it points at, and
// the lens those are read through.
const ICONS = {
  // A shelf of books, the same mark the pill carries for the library.
  contents: (
    <svg width="17" height="15" viewBox="0 0 20 16" fill="currentColor" aria-hidden focusable="false">
      <rect x="0.6" y="0.5" width="3.6" height="15" rx="1.7" />
      <rect x="5.5" y="2.4" width="3.6" height="13.1" rx="1.7" />
      <rect x="11.9" y="0.6" width="3.6" height="14.9" rx="1.7" transform="rotate(-14 13.7 15.5)" />
    </svg>
  ),
  // An open book: what the chapter is, before it is read.
  overview: (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M9 3.6C7.5 2.3 5.4 1.8 2.5 2.2v10.2c2.9-.4 5 .1 6.5 1.4 1.5-1.3 3.6-1.8 6.5-1.4V2.2c-2.9-.4-5 .1-6.5 1.4Z" />
      <path d="M9 3.6v10.2" />
    </svg>
  ),
  // A line of time with a mark on it.
  timeline: (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M1.6 7h14.8" />
      <path d="M5 4.2v5.6M12.4 4.2v5.6" />
      <circle cx="8.7" cy="7" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Two pages side by side: this chapter and the one it reads with.
  related: (
    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinejoin="round" aria-hidden focusable="false">
      <rect x="1.2" y="2.2" width="6.4" height="11.6" rx="1.6" />
      <rect x="9.4" y="2.2" width="6.4" height="11.6" rx="1.6" />
    </svg>
  ),
  // Ruled lines with one running short — a page that has been written on.
  notes: (
    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M2.5 3.5h12M2.5 8h12M2.5 12.5h7" />
    </svg>
  ),
  // Two points with a line drawn between them.
  connections: (
    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden focusable="false">
      <circle cx="4" cy="4" r="2.4" />
      <circle cx="13" cy="12" r="2.4" />
      <path d="M5.9 5.7 11.1 10.3" />
    </svg>
  ),
  // Sliders: the settings the notes are read through. Deliberately not a lens
  // drawn as a magnifying glass, which on this dock would be the search button
  // standing a few pixels away saying something else entirely.
  lenses: (
    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M2.4 4.6h12.2M2.4 11.4h12.2" />
      <circle cx="6.2" cy="4.6" r="2" fill="#fff" />
      <circle cx="11" cy="11.4" r="2" fill="#fff" />
    </svg>
  ),
};

// Order within a side is the order they are wanted in: the contents first,
// because it is how you leave the chapter, then the chapter's own furniture.
export const PANELS = [
  { id: "contents", title: "Contents", side: "left" },
  { id: "overview", title: "Overview", side: "left" },
  { id: "timeline", title: "Timeline", side: "left" },
  { id: "related", title: "Related", side: "left" },
  { id: "notes", title: "Notes", side: "right" },
  { id: "connections", title: "Connections", side: "right" },
  { id: "lenses", title: "Analysis", side: "right" },
];

// Which panels have anything to show. Each one renders itself away when the
// chapter has nothing of its kind written for it, so the question is only ever
// whether its wrapper came out empty — asked of the DOM rather than duplicated
// here, because the panels are the ones who know. Watched rather than measured
// once: they fetch, so a panel can arrive a moment after the chapter does.
export function useFilledPanels(ref, deps) {
  const [filled, setFilled] = useState(() => new Set());

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const next = new Set();
      for (const el of root.querySelectorAll("[data-panel]")) {
        if (el.childElementCount > 0) next.add(el.dataset.panel);
      }
      // Replacing the set on every mutation would re-render the dock for each
      // one; only a change in what is there is worth passing on.
      setFilled((prev) =>
        prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next
      );
    };
    const schedule = () => { frame ||= requestAnimationFrame(read); };

    read();
    const obs = new MutationObserver(schedule);
    obs.observe(root, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return filled;
}

// The markers stand over the chapter, so they give way while it is being read:
// scrolling down fades them out, and the first scroll back up brings them
// again. A small movement is not an answer either way — the page settling, or
// a thumb resting on the glass — so nothing happens until the scroll is
// deliberate.
const SHIFT = 24;

function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) < SHIFT) return;
      last = y;
      // Near the top there is nothing to have scrolled past, so the markers
      // belong on screen whichever way the last movement went.
      setHidden(dy > 0 && y > 80);
    };
    const onScroll = () => { frame ||= requestAnimationFrame(read); };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return hidden;
}

function Circle({ panel, onOpen }) {
  return (
    <button
      className="tap study-dot"
      onClick={() => onOpen(panel.id)}
      aria-label={panel.title}
      title={panel.title}
    >
      {ICONS[panel.id]}
    </button>
  );
}

// The two clusters of markers. Rendered as one element per side so each hugs
// its own corner, rather than one row spanning the window with a gap in the
// middle that the chapter would have to be narrow enough to clear.
export default function StudyDock({ filled, onOpen }) {
  const hidden = useHideOnScrollDown();
  const shown = PANELS.filter((p) => filled.has(p.id));
  if (!shown.length) return null;

  return (
    <div className="study-dock" data-hidden={hidden || undefined} style={{ color: ink }}>
      {["left", "right"].map((side) => (
        <div key={side} className="study-dot-group" data-side={side}>
          {shown.filter((p) => p.side === side).map((p) => (
            <Circle key={p.id} panel={p} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Closing the sheet: the button in its corner, or the Escape key where there
// is one. Deliberately not the phone's back gesture — the address bar's hash is
// the reader's position in the volume, and a sheet is not somewhere they went;
// hanging an entry off it would put a step between two chapters that back has
// to be pressed twice to cross.
export function useSheetDismissal(sheet, close) {
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);

    // The page behind must not scroll under the sheet — on a phone a scroll
    // that starts on an overlay otherwise carries on into whatever is beneath
    // it, and the reader loses their place by opening a panel.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [sheet, close]);
}
