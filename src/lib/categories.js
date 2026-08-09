// What kind of chapter each chapter is, read from markdown in
// src/data/categories — one file per volume, named for it, as the dates and
// the prophets are. Each book is a `## Book` heading over a two-column table:
//
//   ## 1 Nephi
//   | Ch | Category |
//   |----|----------|
//   | 1 | Story |
//   | 8 | Gem |
//
// One category to a chapter, so the whole volume can be laid out at once and
// read as a shape rather than as a list.
const FILES = import.meta.glob("../data/categories/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The ten categories on one axis, history at the grey end and doctrine at the
// gold. The file names the two families; the order inside each is how far a
// chapter of that kind stands from the record's narrative and towards its
// teaching — Plot is the bare machinery of the story, Editorial is the
// narrator stepping out of it to speak in his own voice, and Gem is the
// summit. `weight` is that position, 0 to 1, and it is what the colour is.
export const CATEGORIES = [
  { name: "Plot", family: "history", weight: 0.00, blurb: "The machinery of the story — journeys, errands, arrangements" },
  { name: "Story", family: "history", weight: 0.11, blurb: "Narrative told for its own sake" },
  { name: "War", family: "history", weight: 0.22, blurb: "Campaigns, sieges and the long Nephite wars" },
  { name: "Inflection Point", family: "history", weight: 0.33, blurb: "Where the record turns and everything after reads differently" },
  { name: "Editorial", family: "history", weight: 0.44, blurb: "The narrator speaking about the record itself" },
  { name: "Quotation", family: "doctrine", weight: 0.56, blurb: "Quoted texts other than Isaiah" },
  { name: "Isaiah", family: "doctrine", weight: 0.67, blurb: "Isaiah, quoted and expounded" },
  { name: "Prophecy", family: "doctrine", weight: 0.78, blurb: "What was shown of what was to come" },
  { name: "Teaching", family: "doctrine", weight: 0.89, blurb: "Discourse and instruction" },
  { name: "Gem", family: "doctrine", weight: 1.00, blurb: "The summit chapters" },
];

const BY_NAME = new Map(CATEGORIES.map((c) => [norm(c.name), c]));

export const categoryOf = (name) => BY_NAME.get(norm(name || "")) || null;

function parse(md) {
  const books = new Map();
  let book = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) { book = heading[1].trim(); books.set(norm(book), { name: book, chapters: [] }); continue; }
    if (!book || !line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    // The header row and the |---| rule carry no chapter number.
    if (!/^\d+$/.test(cells[0] || "") || !cells[1]) continue;
    const category = categoryOf(cells[1]);
    if (category) books.get(norm(book)).chapters.push({ n: Number(cells[0]), category });
  }
  return [...books.values()].filter((b) => b.chapters.length);
}

const BY_FILE = Object.fromEntries(
  Object.entries(FILES).map(([path, md]) => [fileOf(path), parse(md)]),
);

// The volume's books in the order the file writes them, which is reading order.
export const categoriesFor = (volume) => (volume && BY_FILE[volume.file]) || [];

export const hasCategories = (volume) => categoriesFor(volume).length > 0;
