// The places named on the map, with what happened at each.
//
// The artwork carries no lettering of its own — every name, mark and rule on
// the map is drawn by the reader's layer from this data. Coordinates arrive as
// percentages of the artwork, which is the only frame of reference that
// survives it being scaled, and are turned into the artwork's own units once,
// here, so everything downstream works in those.
import data from "../data/map/places-book-of-mormon.json";

// The artwork's natural size, and the space the coordinates are put into. It
// is the drawing's cropped box — the trace came off a screen capture with a
// grey band top and bottom, taken off by scripts/build-map.mjs.
export const VIEW = { w: 1894, h: 1818 };
export const ARTWORK = `${import.meta.env.BASE_URL}map/book-of-mormon.svg`;

export const PLACES = data.places.map((p) => ({
  ...p,
  x: +(p.coords.x / 100 * VIEW.w).toFixed(1),
  y: +(p.coords.y / 100 * VIEW.h).toFixed(1),
  // Where the name is set relative to the place, as a compass point — the
  // side the original drawing puts it on. "c" means the name *is* the mark.
  at: p.at ?? "c",
  // How near the reader has to come before the name is worth showing: 1 at
  // once, 2 with the map opened out, 3 only close in. Sixty-three names at
  // one size will not stand in a frame this size all together.
  tier: p.tier ?? 3,
  // The names the drawing sets on two lines stay on two lines.
  lines: p.lines ?? [p.name],
}));

// What each kind of place is called, and the order the key reads in. The names
// come from the data; these are how they are said out loud.
export const KINDS = [
  { type: "major_city", label: "Major city" },
  { type: "city", label: "City" },
  { type: "city_mormon_era", label: "City of the last wars" },
  { type: "jaredite_city", label: "Jaredite city" },
  { type: "land", label: "Land" },
  { type: "hill", label: "Hill or mount" },
  { type: "wilderness", label: "Wilderness" },
  { type: "water", label: "Waters" },
  { type: "sea", label: "Sea" },
  { type: "feature", label: "Landmark" },
];

export const kindOf = (type) => KINDS.find((k) => k.type === type)?.label ?? type;

// The two halves of the world, and the rule the drawing sets between them.
// Percentages again, read off the original and carried onto this artwork.
export const DIVIDE = {
  north: { x: 39.09, y: 25.69, text: "Land Northward" },
  south: { x: 39.09, y: 29.75, text: "Land Southward" },
  rule: { x1: 26.27, x2: 54.1, y: 27.51 },
};


// How much of the lettering the map can carry — judged on how wide the drawing
// is on screen, in pixels, rather than on the zoom alone. Whether a name fits
// depends on how much room its ground has been given, and a phone at full zoom
// has been given less of it than a desktop at rest.
// The cities come in at a plate barely wider than the frame that carries it,
// so a map sitting at its fitted view on a desktop is already naming them —
// they are what the map is mostly for, and having to zoom to find out where
// Ammonihah was made the fitted view nearly empty.
export const depthAt = (plateWidth) =>
  plateWidth < 300 ? 0 : plateWidth < 620 ? 1 : plateWidth < 1150 ? 2 : 3;

// The regions, in the order the data lists them — which is the order the story
// travels, north to south.
export const REGIONS = [...new Set(PLACES.map((p) => p.region))];

// Everything a place is known by, so "Ramah" finds Cumorah and "Lehi-Nephi"
// finds Nephi.
export const namesOf = (p) => [p.name, p.altName].filter(Boolean);
