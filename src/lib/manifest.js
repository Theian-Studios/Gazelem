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

// ---- Naming the same person or place twice ---------------------------------
//
// A chapter's metadata is prose written by whoever wrote the notes, and the
// prophets file and the map were written by someone else again — so "Antionum"
// has to find the map's Antionum, and "Amulek" the prophets page's Amulek,
// without either side having been told about the other. Compared on letters and
// numbers alone, which absorbs the punctuation and casing they disagree on
// while still keeping "Nephi" and "Nephihah" apart.
const fold = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// The prophet of this volume that a name names, or null. Returns the name as
// the prophets page spells it, since that is what opens the page.
export function prophetNamed(volume, name) {
  const want = fold(name);
  return want ? prophetNames(volume).find((p) => fold(p) === want) || null : null;
}

// The map's places for a volume — id and name only; the map itself carries
// everything else, and is not downloaded to answer this.
const placesOf = (volume) => (volume && MANIFEST.places?.[volume.file]) || [];

export const hasPlaces = (volume) => placesOf(volume).length > 0;

// A place is named with or without the word for what kind of place it is: the
// map letters it "Nephi", a chapter says it happened in the land of Nephi, and
// they mean the same point on the drawing. So the qualifier comes off and the
// two are compared on the name proper.
const QUALIFIER =
  /^(?:the\s+)?(?:(?:land|city|waters|valley|wilderness|plains|place|borders|hill|mount)\s+of\s+|(?:hill|mount)\s+)/i;
const core = (s) => fold((s || "").replace(QUALIFIER, ""));

// The place a name names, by either of the names the record gives it, or null.
//
// Exactly first, and only then on the name proper — and then only if one place
// answers to it. The map has both a Manti and a Hill Manti: each is found by
// its own full name, and anything that reaches for the bare name lands on
// neither rather than on the wrong one.
export function placeNamed(volume, name) {
  const want = fold(name);
  if (!want) return null;
  const places = placesOf(volume);
  const exact = places.find((p) => fold(p.name) === want || fold(p.altName) === want);
  if (exact) return exact;

  const asked = core(name);
  if (!asked) return null;
  const loose = places.filter((p) => core(p.name) === asked || core(p.altName) === asked);
  return loose.length === 1 ? loose[0] : null;
}

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
