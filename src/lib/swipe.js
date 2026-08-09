import { useEffect, useRef } from "react";

// Turning the page with a finger.
//
// The chapter follows the hand: it moves with the drag, and only on release
// does it decide whether it has been turned or merely pulled at. A gesture that
// commits nothing until it ends tells the reader nothing while it is underway —
// they cannot see whether the page is going, or how far is far enough, and a
// drag that turns out to have been too short simply does nothing.

// What separates a page turn from a pull that springs back: far enough across
// to be deliberate and much more sideways than vertical — or, however slowly it
// was done, most of the way across the page. The distance test carries slow
// drags, which the time test on its own would throw away: a reader dragging the
// page fully aside has said what they meant whether or not they hurried.
const MIN_X = 56;
const MAX_SLOPE = 0.6; // |dy| ÷ |dx|
const MAX_MS = 700;
const COMMIT_FRACTION = 0.32;

// How far the gesture has to run before it is a page turn rather than a scroll
// that started slightly crooked. Below this nothing moves, so a vertical read
// never drags the page sideways.
const CLAIM = 10;

// A pull toward a chapter that is not there gives, but barely — enough to say
// the gesture was seen and that there is nothing on that side.
const RESIST = 0.22;

// Things that own their own drags, and must not have one read as a page turn.
const GUARD = ".conn-pop, .selbar, .ct-scroll, input, textarea, [contenteditable]";

// Calls onSwipe(1) for a swipe leftward (the next page comes in from the right)
// and onSwipe(-1) for its opposite.
//
// `target` is the element that travels with the finger; `canGo(dir)` says
// whether there is a chapter that way. The element is written to directly
// rather than through state: this runs on every touchmove, and a re-render per
// frame is the difference between the page following the hand and lagging it.
export function useHorizontalSwipe(onSwipe, enabled = true, { target, canGo } = {}) {
  // These close over fresh state every render; keeping them in refs lets the
  // listeners bind once instead of being torn down and rebound each time.
  const cb = useRef(onSwipe);
  const allow = useRef(canGo);
  useEffect(() => { cb.current = onSwipe; allow.current = canGo; });

  useEffect(() => {
    if (!enabled) return;
    let x0 = 0, y0 = 0, t0 = 0;
    let live = false;      // a single finger, started somewhere draggable
    let claimed = false;   // and has since proved to be a sideways one
    let frame = 0;
    let dx = 0;

    const el = () => target?.current || null;

    const draw = () => {
      frame = 0;
      const node = el();
      if (!node) return;
      const free = allow.current?.(dx < 0 ? 1 : -1) ?? true;
      node.style.transform = `translateX(${(free ? dx : dx * RESIST).toFixed(1)}px)`;
    };

    // Let go of the page, either back to where it was or out of the way of the
    // chapter arriving. The entrance animation is the incoming chapter's, so a
    // committed turn clears the transform and leaves the stage to it.
    const release = (committed) => {
      const node = el();
      if (!node) return;
      cancelAnimationFrame(frame);
      frame = 0;
      if (committed) {
        node.style.transition = "";
        node.style.transform = "";
        return;
      }
      node.style.transition = "transform .24s cubic-bezier(.16,1,.3,1)";
      node.style.transform = "";
      const done = () => {
        node.style.transition = "";
        node.removeEventListener("transitionend", done);
      };
      node.addEventListener("transitionend", done);
    };

    const start = (e) => {
      live = e.touches.length === 1 && !e.target?.closest?.(GUARD);
      claimed = false;
      dx = 0;
      if (!live) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = e.timeStamp;
      const node = el();
      if (node) node.style.transition = "";
    };

    const move = (e) => {
      // A second finger means a pinch, not a page turn.
      if (!live) return;
      if (e.touches.length > 1) { live = false; if (claimed) release(false); claimed = false; return; }
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!claimed) {
        // Undecided until the gesture has run far enough to say what it is; a
        // scroll that drifts sideways never claims, and the page stays put.
        if (Math.abs(dx) < CLAIM) return;
        if (Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) { live = false; return; }
        // Dragging out a selection is a wide horizontal gesture like any other;
        // what tells them apart is that this one leaves text selected.
        if (!window.getSelection()?.isCollapsed) { live = false; return; }
        claimed = true;
      }
      frame ||= requestAnimationFrame(draw);
    };

    const end = (e) => {
      if (!live) { claimed = false; return; }
      live = false;
      if (!claimed) return;
      claimed = false;

      const t = e.changedTouches[0];
      const moved = t.clientX - x0;
      const dir = moved < 0 ? 1 : -1;
      const far = Math.abs(moved) > window.innerWidth * COMMIT_FRACTION;
      const flicked = e.timeStamp - t0 <= MAX_MS && Math.abs(moved) >= MIN_X;
      const free = allow.current?.(dir) ?? true;

      if (free && (far || flicked)) { release(true); cb.current(dir); }
      else release(false);
    };

    // Passive: the gesture is only ever read. The page is kept from scrolling
    // sideways under the finger by `touch-action: pan-y` on the chapter itself,
    // which asks the browser for the same thing without a non-passive listener
    // on every touchmove the document sees.
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
      cancelAnimationFrame(frame);
    };
  }, [enabled, target]);
}
