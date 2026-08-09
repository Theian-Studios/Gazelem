import { useEffect, useRef } from "react";

// What separates a page turn from a scroll: far enough across to be deliberate,
// much more sideways than vertical, and quick — a slow drag is someone reading
// with a finger on the glass, not turning a page.
const MIN_X = 56;
const MAX_SLOPE = 0.6; // |dy| ÷ |dx|
const MAX_MS = 700;

// Things that own their own drags, and must not have one read as a page turn.
const GUARD = ".conn-pop, .selbar, .ct-scroll, input, textarea, [contenteditable]";

// Calls onSwipe(1) for a swipe leftward (the next page comes in from the right)
// and onSwipe(-1) for its opposite.
export function useHorizontalSwipe(onSwipe, enabled = true) {
  // The callback closes over fresh state every render; keeping it in a ref lets
  // the listeners bind once instead of being torn down and rebound each time.
  const cb = useRef(onSwipe);
  useEffect(() => { cb.current = onSwipe; });

  useEffect(() => {
    if (!enabled) return;
    let x0 = 0, y0 = 0, t0 = 0, live = false;

    const start = (e) => {
      live = e.touches.length === 1 && !e.target?.closest?.(GUARD);
      if (!live) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = e.timeStamp;
    };
    // A second finger means a pinch, not a page turn.
    const move = (e) => { if (e.touches.length > 1) live = false; };
    const end = (e) => {
      if (!live) return;
      live = false;
      if (e.timeStamp - t0 > MAX_MS) return;
      // Dragging out a selection ends as a wide, fast, horizontal gesture like
      // any other; what tells them apart is that this one leaves text selected.
      if (!window.getSelection()?.isCollapsed) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dx) < MIN_X || Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) return;
      cb.current(dx < 0 ? 1 : -1);
    };

    // Passive: the gesture is only ever read, never preventDefault()ed, so the
    // page keeps scrolling at full speed under the finger.
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
    };
  }, [enabled]);
}
