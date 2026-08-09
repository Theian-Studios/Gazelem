// What the site knows about its own written pages without opening one.
//
// The charts, the evidences and the translation essays are read from markdown
// and are most of the weight of the site, so they are loaded only by the pages
// that show them (see App's lazy imports). But four things have to be knowable
// before any of that is fetched, on the very first paint:
//
//   whether a volume has charts at all       — or its tile should not be offered
//   whether a slug names a real page         — or a URL cannot be resolved
//   what the pages are called                — or the search field cannot offer them
//   which pages treat the open chapter       — or the margin has no marks
//
// All four are small facts about the pages rather than the pages themselves, so
// they are written out at build time into data/manifest.json and read here.
//
// The file is generated — `npm run build:manifest`, and automatically before
// every build — by the same parsers and the same citation scan the site itself
// uses, so it cannot come to describe a page differently from the page. Do not
// edit it by hand.
import MANIFEST from "../data/manifest.json";
import { VOLUMES } from "../data/volumes.js";

// The evidences and the translation essays are written about the Book of
// Mormon, which is where the shelf they stand on is offered. Named here as well
// as in essays.js because this file is read when that one is not.
export const ESSAY_VOLUME = "bofm";
export const ESSAY_SECTION = "Translation";

export const hasCharts = (volume) =>
  !!volume && MANIFEST.charts.some((c) => c.volume === volume.file);

export const chartExists = (slug) => MANIFEST.charts.some((c) => c.slug === slug);

export const hasEvidences = (volume) =>
  !!volume && volume.id === ESSAY_VOLUME && MANIFEST.evidences.length > 0;

export const evidenceExists = (slug) => MANIFEST.evidences.some((e) => e.slug === slug);

export const essayExists = (slug) => MANIFEST.essays.some((e) => e.slug === slug);

// The prophets of a volume, by name and in the order their file writes them —
// enough to offer the shelf and to read one out of a URL. Everything else about
// them travels with the page that shows them.
export const prophetNames = (volume) => (volume && MANIFEST.prophets[volume.file]) || [];

export const hasProphets = (volume) => prophetNames(volume).length > 0;

// ---- What the search field looks through -----------------------------------

const VOL_BY_FILE = new Map(VOLUMES.map((v) => [v.file, v.id]));

export const ARTICLES = [
  ...MANIFEST.charts.map((c) => ({
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    volId: VOL_BY_FILE.get(c.volume) || null,
    section: `charts/${c.slug}`,
  })),
  ...MANIFEST.evidences.map((e) => ({
    slug: e.slug,
    title: e.title,
    subtitle: e.subtitle,
    volId: ESSAY_VOLUME,
    section: `evidences/${e.slug}`,
  })),
  // The translation essays stand on the same shelf. Their subject is written
  // into the searchable text rather than only into their titles: "The Witnesses"
  // is the name of one of them, and "translation witnesses" is what somebody
  // looking for it is likelier to type.
  ...MANIFEST.essays.map((e) => ({
    slug: e.slug,
    title: e.title,
    subtitle: `${ESSAY_SECTION} — ${e.subtitle}`,
    volId: ESSAY_VOLUME,
    section: `evidences/${e.slug}`,
  })),
].filter((a) => a.volId);

// ---- Which pages treat which chapter ---------------------------------------

// Stored as a table of pages and, per chapter, the indices into it — so a page
// treating forty chapters is written out once rather than forty times. Put back
// together here, once, at load.
const INDEX = new Map();
for (const [key, entries] of Object.entries(MANIFEST.study.at)) {
  INDEX.set(
    key,
    entries.map(([page, ...verses]) => ({ ...MANIFEST.study.pages[page], verses }))
  );
}

export const studyAt = (bookName, chapter) =>
  INDEX.get(`${bookName.toLowerCase()}|${chapter}`) || null;

// What one of the written pages is called, given the section that opens it —
// "charts/war-chapters" → "The War Chapters at a Glance". Answered from the
// manifest so a tab can name the page a reader is on without the page itself
// having been fetched. Null for a shelf, which is named by the site rather than
// by a file.
export function pageTitle(section) {
  const at = (section || "").indexOf("/");
  if (at < 0) return null;
  const shelf = section.slice(0, at);
  const slug = section.slice(at + 1);
  const named = (list) => list.find((p) => p.slug === slug)?.title || null;
  if (shelf === "charts") return named(MANIFEST.charts);
  if (shelf === "evidences") return named(MANIFEST.evidences) || named(MANIFEST.essays);
  return null;
}
