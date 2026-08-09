// Finding a word on the page the reader is already on — the other half of
// searching, and the half that expects to be taken literally. The word search
// reduces words to stems so "atonement" turns up "atoneth"; this does not,
// because a reader running their eye down a chapter for a phrase means the
// letters they typed, the way a browser's own find does.
//
// Case is the one thing ignored, and the apostrophes fold together so a verse
// set with a typographic one still answers to the key on the keyboard.
import { verseSegments } from "./commentary.js";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => s.toLowerCase().replace(/[’']/g, "'");

// The text split into runs, with the matches marked. One entry when nothing
// matches, so a caller can render the result either way without checking.
export function splitFind(text, query) {
  const q = fold(query.trim());
  if (!q) return [{ text }];
  const hay = fold(text);
  const out = [];
  let at = 0;
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) {
    if (i > at) out.push({ text: text.slice(at, i) });
    // Sliced out of the original, so the run keeps the case the verse had.
    out.push({ text: text.slice(i, i + q.length), hit: true });
    at = i + q.length;
  }
  if (!out.length) return [{ text }];
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

// How many times a chapter says it — what the search field offers before the
// reader commits to looking, and what the bar then steps through.
//
// Counted over the same runs the reader draws its marks in: a verse carrying a
// cross connection is rendered in pieces, and a match lying across the join
// between two of them is one the page has no single mark for. Counting the
// whole verse would promise a match the bar could never find, so the segments
// are what is counted.
export function countIn(verses, query, connections) {
  const q = fold(query.trim());
  if (!q || !verses) return 0;
  const re = new RegExp(escape(q), "g");
  let n = 0;
  for (const v of verses) {
    for (const seg of verseSegments(v.text, connections?.get(v.verse))) {
      n += (fold(seg.text).match(re) || []).length;
    }
  }
  return n;
}
