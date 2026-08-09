// Chapter captions for the timeline band. One markdown file per volume in
// src/data/timeline, each a series of "## Book name" headings followed by a
// | Ch | Caption | table. Vite inlines every match at build time, so no
// network fetch is involved — same arrangement as the commentary notes.
const FILES = import.meta.glob("../data/timeline/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Book names are matched loosely so "1 Nephi" and "1  nephi" land together.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parse(md) {
  const out = new Map();
  const parts = md.split(/^##\s+(.+?)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const rows = new Map();
    for (const line of parts[i + 1].split("\n")) {
      if (!line.includes("|")) continue;
      // "| 14 | Judge not; the strait gate | Christ's first day |" — the third
      // column is optional. Splitting on the pipes rather than matching a fixed
      // shape means a table with or without it reads the same, and a caption
      // can never swallow the column beside it.
      const cells = line.split("|").map((c) => c.trim());
      if (cells[0] === "") cells.shift();
      if (cells[cells.length - 1] === "") cells.pop();
      // The header row and the |---| rule have no chapter number, so both fall
      // out here.
      if (!/^\d+$/.test(cells[0] || "")) continue;
      rows.set(Number(cells[0]), { caption: cells[1] || "", section: cells[2] || null });
    }
    if (rows.size) out.set(norm(parts[i]), rows);
  }
  return out;
}

let index = null;
function all() {
  if (index) return index;
  index = new Map();
  for (const md of Object.values(FILES)) {
    for (const [book, rows] of parse(md)) {
      const seen = index.get(book);
      if (seen) for (const [n, entry] of rows) seen.set(n, entry);
      else index.set(book, rows);
    }
  }
  return index;
}

// Chapter → { caption, section } for one book, or null when no captions are
// written for it. `section` is the named run of chapters the chapter belongs
// to, and is null in a volume whose table has no Section column.
export function captionsFor(bookName) {
  return all().get(norm(bookName || "")) || null;
}

// The D&C is one book of sections rather than a shelf of books, and its
// captions are filed under the volume's name.
export const timelineName = (volId, book) =>
  volId === "dc" ? "Doctrine and Covenants" : book?.name;

// One flat run of stops for a whole volume, in reading order, each knowing
// whether it opens a book or a named section. The band in the sidebar and the
// volume's own timeline page are the same thread at different lengths, so they
// are built here once.
export function volumeStops(volId, books) {
  const list = [];
  // Tracked across books, not within one: a section can run past the end of a
  // book ("The small plates close" covers Jacob 7 through Words of Mormon).
  let openSection = null;
  (books || []).forEach((b, bookIdx) => {
    const captions = captionsFor(timelineName(volId, b));
    if (!captions) return;
    b.chapters.forEach((c, i) => {
      const entry = captions.get(c.n);
      const section = entry?.section || null;
      list.push({
        bookIdx,
        bookName: b.name,
        chapterIdx: i,
        // Only the first chapter of a book carries its name, so the label
        // appears once at the join rather than against every stop.
        opensBook: i === 0,
        // Likewise the section title: it heads the run it names, rather than
        // repeating against each chapter in it.
        opensSection: section && section !== openSection ? section : null,
        n: c.n,
        caption: entry?.caption || "",
      });
      if (section) openSection = section;
    });
  });
  return list;
}
