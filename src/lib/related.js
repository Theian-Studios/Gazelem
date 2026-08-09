// Chapters with a strong parallel elsewhere in the standard works. One
// markdown file per volume in src/data/related, each a series of "## Book"
// headings followed by a | Chapter | Related Chapter(s) | table. Vite inlines
// them at build time, the same arrangement as the notes and the timeline.
import { resolveBook } from "./refs.js";

const FILES = import.meta.glob("../data/related/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The charts name their books the way a citation would — "D&C 76", "Psalm 22"
// — while the reader holds the full name of the book it has open. Both go
// through the same resolver the cross references use, so the two meet however
// either one was written; a name it cannot place still keys consistently by
// itself, since both sides ask this same question.
const bookKey = (name) => norm(resolveBook(name)?.n ?? name);

function parse(md) {
  const out = new Map();
  for (const line of md.split("\n")) {
    // "| **3 Nephi 12–14** | Matthew 5–7 |"
    const row = line.match(/^\s*\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*$/);
    if (!row) continue;
    // A row can cover a run of chapters, and every chapter in it gets the same
    // list — the parallel belongs to the whole run.
    const src = row[1].trim().match(/^(.+?)\s+(\d+)(?:\s*[–—-]\s*(\d+))?$/);
    if (!src) continue;
    const related = row[2].split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
    if (!related.length) continue;

    const book = bookKey(src[1]);
    const from = Number(src[2]);
    const to = Number(src[3] ?? src[2]);
    if (!out.has(book)) out.set(book, new Map());
    for (let n = from; n <= to; n++) out.get(book).set(n, related);
  }
  return out;
}

let index = null;
function all() {
  if (index) return index;
  index = new Map();
  for (const md of Object.values(FILES)) {
    for (const [book, chapters] of parse(md)) {
      const seen = index.get(book);
      if (seen) for (const [n, list] of chapters) seen.set(n, list);
      else index.set(book, chapters);
    }
  }
  return index;
}

// The chapters parallel to this one, or null when it is not in the chart —
// which is most of them, and the card stays away entirely.
export function relatedFor(bookName, chapterN) {
  if (!bookName || chapterN == null) return null;
  return all().get(bookKey(bookName))?.get(chapterN) || null;
}
