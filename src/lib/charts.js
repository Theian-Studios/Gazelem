// The study charts, read from markdown in src/data/charts — one file per
// chart, named for its slug, as the evidences are. How one is read is in
// charts.parse.js, which the build step reads them with too; this is the shelf
// of them.
//
// The whole shelf is inlined here, which is a quarter of everything the site
// ships — so nothing outside a chart page may import this file. What the rest
// of the site needs to know about charts without opening one (which volume has
// them, which slugs exist, what they are called, and which passages they treat)
// is answered from the manifest instead, and this module is reached only
// through the lazily-loaded Charts page. See lib/manifest.js.
import { parseChart, slugOf, byOrder } from "./charts.parse.js";

const FILES = import.meta.glob("../data/charts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ALL = Object.entries(FILES)
  .map(([path, md]) => parseChart(md, slugOf(path)))
  .sort(byOrder);

// Every chart, in the order the files ask to be read in.
export const ALL_CHARTS = ALL;

// The charts written for a volume, in the order the files ask to be read in.
export const chartsFor = (volume) =>
  (volume && ALL.filter((c) => c.volume === volume.file)) || [];

export const chartBySlug = (slug) => ALL.find((c) => c.slug === slug) || null;

// How many rows the chart holds, which is what its card says it is worth.
export const chartSize = (chart) =>
  chart.parts.reduce((n, p) => n + p.rows.length, 0);

// The grid the chart's columns are set on, as a template.
//
// The floor is `min-content` rather than nothing. A reference is set to keep to
// one line — a chapter and its verses read as one word and should not be broken
// across two — so it cannot shrink, and a column given a share of the width
// narrower than the reference standing in it does not clip the reference: it
// spills over the rule into the column beside it. "Alma 43–44" was running
// through the middle of the war chart's next column at every width where its
// share came to less than the words. A min-content floor is the width of the
// longest thing in the column that cannot be broken, which is exactly the
// promise the rules between the columns make.
export const chartTemplate = (chart) => {
  const w = chart.widths.length === chart.columns.length
    ? chart.widths
    : chart.columns.map((_, i) => (i ? 1 : 2));
  return w.map((n) => `minmax(min-content, ${n}fr)`).join(" ");
};
