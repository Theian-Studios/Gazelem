// Bringing a study page to the part that treats the passage a reader came from.
//
// The margin marks in the reader promise something specific — that "And Thus We
// See" has something to say about 1 Nephi 16:29 — and a page that opens at its
// own title has not kept that promise: the reader is left to scan a chart of
// twenty-two rows for the one they were sent to. What is wanted is the row
// itself, unfolded and in view.
//
// Which row that is, is a question the citations already answer, so it is asked
// of them by the same scan everything else uses.
import { useEffect } from "react";
import { citationsIn } from "./cites.js";

// Whether any reference in this run names the passage the page was opened for.
export function treats(lines, focus) {
  if (!focus?.book) return false;
  const want = focus.book.toLowerCase();
  for (const line of lines) {
    for (const cite of citationsIn(line)) {
      if (cite.book.n.toLowerCase() !== want) continue;
      if (focus.chapter == null || cite.chapter === focus.chapter) return true;
    }
  }
  return false;
}

// Bring the marked element into view and let it say so. Runs after paint, and
// once only — a reader who then scrolls away is not dragged back.
//
// Left where it is when it is already on screen: a page short enough to show
// its own answer needs no scrolling, and scrolling it anyway makes the page
// jump for no reason the reader can see.
export function useFocusScroll(active, selector = "[data-focused]") {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const seen = r.top >= 70 && r.bottom <= window.innerHeight;
      if (!seen) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 90);
    return () => clearTimeout(t);
  }, [active, selector]);
}
