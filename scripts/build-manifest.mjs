// The manifest: everything the site needs to know about its own written pages
// without opening one.
//
// The charts, the evidences and the translation essays are four fifths of what
// the site ships, and until this existed every one of them was inlined into the
// first thing a reader downloaded — because three questions were being answered
// out of their contents on every page:
//
//   which volumes have charts, and which slugs exist   (the shelf, and the URL)
//   what is each page called                           (the search field)
//   which pages treat the chapter now open             (the margin marks)
//
// None of those need the pages themselves, only some small facts about them. So
// the facts are written out here, once, at build time — and the pages move
// behind the tiles that open them.
//
// The index is read off the citations, by the same scan the page draws its
// links with (lib/cites.js), so a chart cannot cite a chapter and fail to appear
// under it. The files are parsed by the same parsers the site parses them with
// (lib/*.parse.js), so the manifest cannot describe a page the site would read
// differently. Both of those are the point; neither is a coincidence worth
// giving up to save an import.
//
// Run by `npm run build:manifest`, and before every build.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseChart, slugOf as chartSlug, byOrder as chartOrder } from "../src/lib/charts.parse.js";
import { parseEvidence, slugOf as evidenceSlug, byOrder as evidenceOrder } from "../src/lib/evidences.parse.js";
import { parseEssay, fileOf as essayFile, orderOf, slugOf as essaySlug, byOrder as essayOrder } from "../src/lib/essays.parse.js";
import { parseProphets, fileOf as prophetFile } from "../src/lib/prophets.parse.js";
import { citationsIn } from "../src/lib/cites.js";
import { VOLUMES } from "../src/data/volumes.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(root, "src", "data");
const OUT = join(DATA, "manifest.json");

const read = (dir, name) => readFileSync(join(DATA, dir, name), "utf8");
const mdIn = (dir) => {
  try { return readdirSync(join(DATA, dir)).filter((f) => f.endsWith(".md")).sort(); }
  catch { return []; }
};

// ---- The pages themselves --------------------------------------------------

const charts = mdIn("charts")
  .map((f) => parseChart(read("charts", f), chartSlug(f)))
  .sort(chartOrder);

const evidences = mdIn("evidences")
  .map((f) => parseEvidence(read("evidences", f), evidenceSlug(f)))
  .sort(evidenceOrder);

const essays = mdIn("evidences/translation")
  .map((f) => {
    const name = essayFile(f);
    return parseEssay(read("evidences/translation", f), essaySlug(name), orderOf(name));
  })
  .sort(essayOrder);

const prophets = {};
for (const f of mdIn("prophets")) {
  prophets[prophetFile(f)] = parseProphets(read("prophets", f)).map((p) => p.name);
}

// ---- Which passages each one treats ----------------------------------------
//
// A chart is indexed on its rows alone, not on its introduction. The rows are
// the chart — a passage in one is a passage the chart has something to say
// about — while an introduction reaches for whatever it needs to set the scene,
// and indexing those would have the Old Testament miracles chart claiming to
// discuss 2 Kings 2 because its opening sentence mentions Elisha's double
// portion. An essay is prose throughout and has no rows to prefer, so it is
// indexed on the whole of itself.

const chartLines = (c) =>
  c.parts.flatMap((p) => p.rows.flatMap((row) => row.flatMap((cell) => cell)));

const evidenceLines = (e) =>
  e.forms.flatMap((f) => [
    ...f.items.map((i) => i.ref),
    ...f.groups.flatMap((g) => [g.title, ...g.items.map((i) => i.ref)]),
  ]);

const essayLines = (e) =>
  e.parts.flatMap((p) =>
    p.blocks.flatMap((b) =>
      b.kind !== "quote"
        ? [b.text]
        : [b.text, ...b.parts.flatMap((q) => [q.text, q.source].filter(Boolean))]
    )
  );

const VOL_BY_FILE = new Map(VOLUMES.map((v) => [v.file, v.id]));

const ESSAY_VOLUME = "bofm";
const ESSAY_SECTION = "Translation";

const pages = [
  ...charts.map((c) => ({
    kind: "Chart", title: c.title, volId: VOL_BY_FILE.get(c.volume) || null,
    section: `charts/${c.slug}`, lines: chartLines(c),
  })),
  // The evidences and the essays are written for the Book of Mormon, which is
  // where the shelf they stand on is offered.
  ...evidences.map((e) => ({
    kind: "Evidence", title: e.title, volId: "bofm",
    section: `evidences/${e.slug}`, lines: evidenceLines(e),
  })),
  ...essays.map((e) => ({
    kind: ESSAY_SECTION, title: e.title, volId: ESSAY_VOLUME,
    section: `evidences/${e.slug}`, lines: essayLines(e),
  })),
].filter((p) => p.volId);

// chapter → the pages that treat it, each with the verses it names there. Held
// as a page table and a list of indices into it rather than as whole records
// per chapter: a page treating forty chapters would otherwise write its title
// and its door out forty times, which is most of the file.
const at = {};
pages.forEach((page, i) => {
  const found = new Map();   // chapter key → the verses named in it
  for (const line of page.lines) {
    for (const cite of citationsIn(line)) {
      const k = `${cite.book.n.toLowerCase()}|${cite.chapter}`;
      const verses = found.get(k) || new Set();
      for (const v of cite.verses) verses.add(v);
      found.set(k, verses);
    }
  }
  for (const [k, verses] of found) {
    (at[k] = at[k] || []).push([i, ...[...verses].sort((a, b) => a - b)]);
  }
});

// ---- Out ------------------------------------------------------------------

const manifest = {
  // A note to whoever opens this file wondering whether to edit it.
  "//": "Generated by scripts/build-manifest.mjs — run `npm run build:manifest`.",
  charts: charts.map((c) => ({ slug: c.slug, title: c.title, subtitle: c.subtitle, volume: c.volume })),
  evidences: evidences.map((e) => ({ slug: e.slug, title: e.title, subtitle: e.subtitle })),
  essays: essays.map((e) => ({ slug: e.slug, title: e.title, subtitle: e.subtitle })),
  prophets,
  study: { pages: pages.map(({ lines, ...rest }) => rest), at },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(manifest)}\n`);

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`charts     ${charts.length}`);
console.log(`evidences  ${evidences.length}`);
console.log(`essays     ${essays.length}`);
console.log(`prophets   ${Object.entries(prophets).map(([f, n]) => `${f} ${n.length}`).join(", ") || "none"}`);
console.log(`indexed    ${pages.length} pages over ${Object.keys(at).length} chapters`);
console.log(`manifest   ${kb(JSON.stringify(manifest).length)}`);
