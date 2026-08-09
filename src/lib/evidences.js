// The evidences: things about the book that are easier to explain if it is
// what it says it is. One markdown file per evidence in src/data/evidences,
// read the same way the prophets and the categories are.
//
// A file opens with its title, a few facts about it, and a paragraph of
// introduction. Then each `##` is a form, carrying the shape its examples take:
//
//   # Hebraisms
//   * subtitle: Hebrew literary forms in an English book
//   * order: 1
//
//   Fifteen Hebrew literary forms, with the passages that exhibit them.
//
//   ## Cognate Verbs and Objects
//   * form: phrases
//   * gloss: The cognate accusative, where verb and object share a root
//
//   - I have dreamed a dream | 1 Nephi 3:2
//
// Five shapes, because the examples genuinely are five different things and
// flattening them into one would lose what each is showing:
//
//   phrases   a short phrase and where it stands, sometimes with a gloss
//   tchart    two readings set in columns and read across — source against
//             reversal, earliest text against the one printed now
//   ladder    a whole passage, set a line to a rung
//   quotes    a passage quoted at length, sometimes under a heading
//   wordplay  a name, what it means, and the verses that play on it
//
// An entry line is `text | reference` with an optional third field: a gloss for
// phrases and quotes, and for a chart row a leading label instead — `label |
// text | reference`, since the halves have to be told apart. A chart's labels
// are the same down every row, so they are set once as the heads of it.
//
// A `## ` form may be followed by prose, which is joined onto the end of its
// gloss: the gloss alone is what a card carries, and the two together are the
// description the form is opened with.
//
// The whole shelf is inlined here, so nothing outside an evidence page may
// import this file: what the rest of the site needs to know without opening one
// is answered from the manifest instead. See lib/manifest.js.
import { parseEvidence, slugOf, byOrder } from "./evidences.parse.js";

const FILES = import.meta.glob("../data/evidences/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});


const ALL = Object.entries(FILES)
  .map(([path, md]) => parseEvidence(md, slugOf(path)))
  .sort(byOrder);

// Every evidence, in the order the files ask to be read in.
export const EVIDENCES = ALL;

export const evidenceBySlug = (slug) => ALL.find((e) => e.slug === slug) || null;

// "The ascent … (Moroni 8:25–26)" → the title and the reference apart, so the
// reference can be made a link into the text it names.
export function splitTitle(title) {
  const m = title.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { label: m[1].trim(), ref: m[2].trim() } : { label: title, ref: "" };
}
