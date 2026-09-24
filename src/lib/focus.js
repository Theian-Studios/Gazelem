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

// ---- A window that holds the keyboard ------------------------------------

// What inside a container can be tabbed to, in tab order. Read afresh each time
// rather than kept: a window whose body is still arriving would otherwise trap
// the reader against the list it had when it opened.
const REACHABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const reachable = (root) =>
  [...(root?.querySelectorAll(REACHABLE) || [])].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );

// Keeps the keyboard inside a window while it is open, and gives it back where
// it came from when it closes.
//
// A window that says `aria-modal="true"` has told every screen reader that the
// page behind it is closed for the duration. If the Tab key then walks straight
// out into that page, the reader is somewhere their software says does not
// exist, with no way back but Escape and no way to know that is the way. So the
// promise the markup makes is kept here: focus moves in when the window opens,
// Tab and Shift+Tab wrap at the ends, and the control that opened the window
// gets the focus back when it closes — otherwise focus falls to the top of the
// document and the reader loses their place on the page entirely.
export function useModalFocus(ref, active) {
  useEffect(() => {
    if (!active) return;
    const box = ref.current;
    if (!box) return;
    const cameFrom = document.activeElement;

    // The window itself, when it holds nothing to focus yet.
    const first = reachable(box)[0] || box;
    if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
    first.focus?.({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = reachable(box);
      if (!items.length) { e.preventDefault(); return; }
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      // Also when focus has escaped the window some other way — a click on the
      // page behind, a control that removed itself — which would otherwise let
      // the next Tab carry on out through the document.
      if (document.activeElement === edge || !box.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      cameFrom?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}
