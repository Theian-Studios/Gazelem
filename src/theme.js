// Liquid-glass surfaces.
//
// Depth is expressed by blur radius: the higher a surface floats, the harder it
// blurs what's behind it. Stacking two translucent layers at the same radius
// reads as haze, so anything sitting *on* another glass layer moves up a tier.
//
// Note: this engine silently ignores SVG filter references in backdrop-filter
// (CSS.supports reports true, but nothing renders), so the backdrop itself
// cannot be displaced. The rim below fakes that refraction optically instead.
const frost = (px, sat) => {
  const value = `blur(${px}px) saturate(${sat}%)`;
  return { backdropFilter: value, WebkitBackdropFilter: value };
};

// The lit rim of a pane of glass. A bright specular line along the top, light
// bouncing back off the bottom, and an inner glow standing in for the
// thickness of the material — where a real edge would bend the view through it.
const rim = (glow, thickness) =>
  [
    "inset 0 1px 0 rgba(255,255,255,.92)",
    "inset 0 -1px 0 rgba(255,255,255,.42)",
    "inset 1px 0 0 rgba(255,255,255,.55)",
    "inset -1px 0 0 rgba(255,255,255,.55)",
    `inset 0 0 ${glow}px rgba(255,255,255,${thickness})`,
    "inset 0 -7px 16px -10px rgba(31,45,71,.13)",
  ].join(", ");

// Tier 1 — surfaces resting on the page background (cards, the reader, header).
export const glass = {
  background: "rgba(255,255,255,0.58)",
  ...frost(34, 185),
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: `0 8px 28px rgba(31,45,71,0.055), 0 1px 2px rgba(31,45,71,0.03), ${rim(14, 0.4)}`,
};

// Tier 2 — a field or control set *into* a tier-1 surface. Its parent is a
// backdrop root, so its own blur has nothing to sample; the rim does the work.
export const glassInset = {
  background: "rgba(255,255,255,0.46)",
  ...frost(22, 170),
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: `inset 0 1px 2px rgba(31,45,71,.05), ${rim(10, 0.34)}`,
};

// Tier 3 — floats free above everything (menus, toolbars, the nav pill). Blurs
// hardest and sits most opaque, so text behind it never competes with the
// content in front. Must not be nested inside another backdrop-filtered
// element, or the blur silently no-ops — see SearchBox / SelectionMenu.
export const glassOverlay = {
  background: "rgba(255,255,255,0.74)",
  ...frost(64, 200),
  border: "1px solid rgba(255,255,255,0.8)",
  boxShadow: `0 14px 40px rgba(31,45,71,0.10), 0 2px 6px rgba(31,45,71,0.04), ${rim(18, 0.5)}`,
};

export const glassPill = { ...glassOverlay, borderRadius: 999 };

// Shared wash behind every volume card on the home screen.
export const cardTint = "rgba(90,124,178,0.10)";

export const ink = "#1d1d1f";
export const inkSoft = "#6e6e73";
export const gold = "#a4853d";
export const blue = "#3a5a8c";
