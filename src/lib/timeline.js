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
      // "| 14 | Judge not; the strait gate |". The header and the |---| rule
      // carry no leading number, so this pattern passes over both.
      const m = line.match(/^\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/);
      if (m) rows.set(Number(m[1]), m[2]);
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
      if (seen) for (const [n, caption] of rows) seen.set(n, caption);
      else index.set(book, rows);
    }
  }
  return index;
}

// Chapter → caption for one book, or null when no captions are written for it.
export function captionsFor(bookName) {
  return all().get(norm(bookName || "")) || null;
}
