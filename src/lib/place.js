// Where a card anchored to something on the page should stand, and how tall it
// may be there.
//
// Both of the cards that hang off the text — the cross connections and the
// study pages — used to choose their side by guessing their own height: "260
// tall will not fit below, so open upward". The guess and the real cap were
// never the same number (260 against 58vh, 200 against 56vh), so on a phone,
// where 58vh is 470px, a card anchored halfway down the window decided it fit
// below and ran off the bottom. What was cut off could not be scrolled to
// either: the clipping is the window's, not the card's own scroller.
//
// So nothing is guessed. The card is given whichever side has the room, and
// told what that room is; it keeps its own overflow and scrolls inside
// whatever it is handed.
export function placeCard(el, { width: want, cap = 0.58, gap = 8, margin = 8 } = {}) {
  const r = el.getBoundingClientRect();
  const width = Math.min(want, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(r.left, margin), window.innerWidth - width - margin);

  const below = window.innerHeight - r.bottom - gap - margin;
  const above = r.top - gap - margin;
  // Downward by preference — a card that drops from what was pressed is the
  // one the reader expects — and upward only where that buys real height.
  const most = window.innerHeight * cap;
  const up = below < most && above > below;
  // A floor, so a card anchored to something wedged against an edge is still
  // a card rather than a slot. It is the one case that can reach past the
  // margin, and the clamp below keeps it on screen even then.
  const maxHeight = Math.max(140, Math.min(most, up ? above : below));

  // Opened upward the card hangs from its own foot rather than standing at the
  // top of the room it was given: a short card placed by its top left a hand's
  // width of nothing between it and the phrase it belongs to, which is the one
  // thing a card like this must never look detached from.
  return up
    ? { bottom: window.innerHeight - r.top + gap, left, width, maxHeight }
    : { top: r.bottom + gap, left, width, maxHeight };
}
