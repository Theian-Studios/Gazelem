// Prepares the map artwork from a vector trace of the study map.
//
//   node scripts/build-map.mjs <traced.svg> [--crop x,y,w,h]
//
// It copies the trace to public/map/book-of-mormon.svg and reports the centre
// of every city dot it can find in it.
//
// --crop sets the viewBox, which is how the screenshot's own border is taken
// off: the trace was made from a screen capture and carries a flat grey band
// along the top and bottom and a hairline of nothing down each side. Cropping
// is the viewBox and nothing else — the paths are untouched, and what falls
// outside simply is not drawn. The current trace was measured by rasterising
// it and reading in from each edge to the first row that has any variation in
// it, which gave --crop 1,13,1894,1818 out of a 1896 x 1846 drawing.
//
// The artwork now used carries no lettering and no marks — it is the drawing
// with its names taken off, so every name, dot and rule on the map is set by
// the reader's own layer from src/data/map/places-book-of-mormon.json. Run
// against that trace this reports no dots, which is the point.
//
// The dot finder is kept because it is how those places were positioned in the
// first place: run against the earlier trace, which had the marks drawn in, it
// gives the exact centre of all forty-three of them. Those centres are the only
// exact positions the drawing ever contained. Anything that re-traces the map
// can be fitted back onto them the same way.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
// `--crop` with nothing after it is a usage error, not a crash: read as the
// empty string it reaches the same complaint below that a bad one does.
const cropArg = process.argv[process.argv.indexOf("--crop") + 1] ?? "";
if (!source || source.startsWith("--")) {
  console.error("usage: node scripts/build-map.mjs <traced.svg> [--crop x,y,w,h]");
  process.exit(1);
}
const crop = process.argv.includes("--crop") ? cropArg.split(",").map(Number) : null;
if (crop && (crop.length !== 4 || crop.some((n) => !Number.isFinite(n)))) {
  console.error("--crop wants four numbers: x,y,w,h");
  process.exit(1);
}

const svg = readFileSync(source, "utf8");

const bounds = (raw) => {
  const pts = [...raw.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)];
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) {
    const x = +q[1], y = +q[2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

// A city is a small round red mark, a Jaredite city a small orange square.
const dots = [];
for (const m of svg.matchAll(/<path\b[\s\S]*?\/>/g)) {
  const fill = m[0].match(/fill="(#[0-9A-Fa-f]{6})"/);
  if (!fill) continue;
  const n = parseInt(fill[1].slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const red = r > 120 && r > g * 1.7 && r > b * 1.7;
  if (!red) continue;
  const box = bounds(m[0]);
  if (!box) continue;
  const round = Math.abs(box.w - box.h) < Math.max(box.w, box.h) * 0.45;
  if (round && box.w >= 7 && box.w <= 26) {
    dots.push({ x: +box.cx.toFixed(1), y: +box.cy.toFixed(1), r: +(box.w / 2).toFixed(1) });
  }
}

// The trace writes every coordinate to six decimal places, which is about a
// millionth of a pixel and costs half the file. One is finer than the drawing
// can show at any zoom the reader has.
let slim = svg
  .replace(/(\d+)\.(\d{2,})/g, (_, whole, frac) => {
    const n = Number(`${whole}.${frac}`);
    return (Math.round(n * 10) / 10).toString();
  })
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\n\t+/g, "\n")
  .replace(/\n{2,}/g, "\n");

// The window onto the drawing. enable-background carries the same box, and is
// the SVG 1.1 leftover Illustrator writes; left disagreeing it means nothing
// but reads as a mistake.
const was = slim.match(/viewBox="([^"]*)"/)?.[1];
if (crop) {
  const box = crop.join(" ");
  slim = slim.replace(/viewBox="[^"]*"/, `viewBox="${box}"`)
             .replace(/enable-background="[^"]*"/, `enable-background="new ${box}"`);
}

mkdirSync(join(root, "public", "map"), { recursive: true });
writeFileSync(join(root, "public", "map", "book-of-mormon.svg"), slim);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`artwork    ${kb(slim.length)} (from ${kb(svg.length)}) → public/map/book-of-mormon.svg`);
if (crop) console.log(`cropped    ${was} → ${crop.join(" ")}`);
console.log(`dots found ${dots.length}`);
console.log(JSON.stringify(dots));
