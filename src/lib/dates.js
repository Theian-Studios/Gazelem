// The calendar year each chapter falls in, for the volume timeline. One
// markdown file per volume in src/data/dates, each a series of "## Book"
// headings followed by a | Chapters | Date | table whose left column is either
// one chapter or a run of them:
//
//   ## Alma
//   | Chapters | Date |
//   |---|---|
//   | 1 | c. 91–87 B.C. |
//   | 2–3 | c. 87 B.C. |
//
// Only the volume's own timeline page shows these. The band beside the reader
// is a narrow column already carrying a caption per row, and a date on every
// one of them would crowd out the thing it is there to say.
const FILES = import.meta.glob("../data/dates/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parse(md) {
  const books = new Map();
  let book = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) { book = norm(heading[1]); books.set(book, new Map()); continue; }
    if (!book || !line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    // The header row and the |---| rule have no chapter number in them.
    const span = (cells[0] || "").match(/^(\d+)(?:\s*[–—-]\s*(\d+))?$/);
    if (!span || !cells[1]) continue;
    const from = Number(span[1]);
    const to = Number(span[2] ?? span[1]);
    for (let n = from; n <= to; n++) books.get(book).set(n, cells[1]);
  }
  return books;
}

let index = null;
function all() {
  if (index) return index;
  index = new Map();
  for (const [path, md] of Object.entries(FILES)) index.set(fileOf(path), parse(md));
  return index;
}

// The date written against one chapter, or null where a volume has no dates.
export function dateFor(volume, bookName, chapterN) {
  if (!volume) return null;
  return all().get(volume.file)?.get(norm(bookName || ""))?.get(chapterN) ?? null;
}

export const hasDates = (volume) => !!(volume && all().get(volume.file)?.size);
