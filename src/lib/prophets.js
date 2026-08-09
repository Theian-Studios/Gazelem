// The prophets of a volume, read from markdown in src/data/prophets — one file
// per volume, named for it. Each prophet is a `#` heading followed by `##`
// sections of bullets:
//
//   # Lehi
//   ## Quotes
//   * "Adam fell that men might be" (2 Ne 2:25)
//   ## Roles
//   * Patriarch
//
// Vite inlines every match at build time, the same arrangement as the notes,
// the timeline and the related chapters.
//
// Every volume's prophets are inlined here, so nothing outside the prophets
// page may import this file: the names the rest of the site needs — to offer
// the shelf, and to read one out of a URL — come from the manifest instead.
// See lib/manifest.js.
import { resolveBook, expandVerses } from "./refs.js";
import { parseProphets, fileOf } from "./prophets.parse.js";

const FILES = import.meta.glob("../data/prophets/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

let index = null;
function all() {
  if (index) return index;
  index = new Map();
  for (const [path, md] of Object.entries(FILES)) index.set(fileOf(path), parseProphets(md));
  return index;
}

// The prophets written for a volume, or an empty list — the button that opens
// them is only offered where there are some.
export function prophetsFor(volume) {
  return (volume && all().get(volume.file)) || [];
}

export function prophetByName(volume, name) {
  return prophetsFor(volume).find((p) => p.name === name) || null;
}

// "Alma 5, 7, 12–13" → one entry per chapter, so each is its own way in.
// parseCitations keeps only the first number of a list like this, which is
// right for a footnote and wrong for a shelf of chapters.
export function chapterRefs(spec) {
  const m = spec.match(/^(.+?)\s+([\d\s,–—-]+)$/);
  const book = m && resolveBook(m[1]);
  if (!book) return [];
  return expandVerses(m[2]).map((n) => ({ label: `${book.n} ${n}`, book, chapter: n, verses: [] }));
}
