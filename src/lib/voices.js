// Whose voice carries each chapter, read from markdown in src/data/voices —
// one file per volume, named for it, as the categories and the dates are.
//
// A `## Book` heading over a two-column table, the left cell a chapter number:
//
//   ## Jacob
//   | Chapter | Voice |
//   |---|---|
//   | 5 | Zenos |
//
// Where one heading covers several one-chapter books, the left cell names the
// book as well — "| Omni 1 | Amaleki |" — since the heading cannot.
//
// One voice to a chapter: the speaker or writer whose words dominate it, with
// quoted prophets credited and plain narrative in the abridged books going to
// the abridger. That is a set of judgment calls, and the source file keeps its
// own record of the close ones at the foot.
const FILES = import.meta.glob("../data/voices/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const key = (book, n) => `${norm(book)}|${n}`;

function parse(md) {
  const byChapter = new Map();
  // Reading order of first appearance, which is how the filter lists them: you
  // meet Lehi before Alma, and Alma before Moroni.
  const order = [];
  const seen = new Set();
  let heading = null;

  // The prose at the foot explains the close calls; it is not data.
  for (const raw of md.split("## Judgment calls")[0].split("\n")) {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) { heading = h[1].trim(); continue; }
    if (!heading || !line.startsWith("|")) continue;

    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    const [left, voice] = cells;
    if (!left || !voice) continue;
    // The header row and the |---| rule.
    if (/^chapter$/i.test(left) || /^-+:?$/.test(left)) continue;

    // "12" takes its book from the heading; "Omni 1" carries its own, for the
    // headings that cover more than one book.
    let book = heading;
    let n = Number(left);
    if (!/^\d+$/.test(left)) {
      const split = left.match(/^(.*?)\s+(\d+)$/);
      if (!split) continue;
      book = split[1].trim();
      n = Number(split[2]);
    }

    byChapter.set(key(book, n), voice);
    if (!seen.has(voice)) { seen.add(voice); order.push(voice); }
  }
  return { byChapter, order };
}

const BY_FILE = Object.fromEntries(
  Object.entries(FILES).map(([path, md]) => [fileOf(path), parse(md)]),
);

const forVolume = (volume) => (volume && BY_FILE[volume.file]) || null;

// The voice of one chapter, or null where a volume has none recorded.
export const voiceAt = (volume, bookName, n) =>
  forVolume(volume)?.byChapter.get(key(bookName || "", n)) ?? null;

// Every voice in the volume, in the order the record introduces them.
export const voicesOf = (volume) => forVolume(volume)?.order ?? [];
