// Chapters with a strong parallel elsewhere in the standard works. One
// markdown file per volume in src/data/related, each a series of "## Book"
// headings followed by a | Chapter | Related Chapter(s) | table. Vite inlines
// them at build time, the same arrangement as the notes and the timeline.
import { resolveBook } from "./refs.js";
import { BOOK_INDEX } from "../data/bookIndex.js";

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

// The parallels that run inside one volume — Alma 32 with Ether 12, Mosiah 3
// with Alma 7 — as a list of pairs rather than as a lookup from one chapter.
//
// It is the same chart read the other way round. A reader in a chapter asks
// what else reads with this one, which is relatedFor above; a reader looking at
// the volume whole asks where the parallels run at all, and that is a set of
// links between two chapters, each named once however many rows mention it.
//
// Only the links that stay inside the volume: a chapter of the Book of Mormon
// answering Isaiah is a real parallel, but it leads off the ring the web is
// drawn on, and the chart's own card beside the chapter is where it belongs.
export function webWithin(volId) {
  const mine = BOOK_INDEX.filter((b) => b.v === volId);
  const seen = new Set();
  const links = [];

  // "Moroni 4–5" is two chapters, and both of them carry the parallel.
  const spread = (label) => {
    const m = String(label).trim().match(/^(.+?)\s+(\d+)(?:\s*[–—-]\s*(\d+))?(?::\d+)?$/);
    if (!m) return [];
    const book = resolveBook(m[1]);
    if (!book || book.v !== volId) return [];
    const last = Math.min(Number(m[3] ?? m[2]), book.c);
    const out = [];
    for (let n = Number(m[2]); n <= last; n++) out.push({ book: book.n, chapter: n });
    return out;
  };

  for (const b of mine) {
    for (let n = 1; n <= b.c; n++) {
      for (const label of relatedFor(b.n, n) || []) {
        for (const to of spread(label)) {
          if (to.book === b.n && to.chapter === n) continue;
          // One link, whichever of its two chapters names it first.
          const ends = [`${b.n} ${n}`, `${to.book} ${to.chapter}`].sort();
          const key = ends.join(" | ");
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({ from: { book: b.n, chapter: n }, to });
        }
      }
    }
  }
  return links;
}
