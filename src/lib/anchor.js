// Where a note's quotation actually stands in the verse the site serves.
//
// A note anchors itself to a run of words by counting them: "carried away
// captive into Babylon" is words 43 to 47 of 1 Nephi 1:13. Those counts were
// taken against the modern edition, because that is the text the notes were
// written beside. The site serves the 1920 printing, scanned — and the two do
// not agree word for word. Some verses gained or lost a word ahead of the
// quotation and shifted every number after it; some are worded differently
// ("exceeding" for "exceedingly"); some carry OCR damage in the middle of the
// very run being quoted. About one anchor in eight landed on the wrong words,
// which is how 1 Nephi 1:13 came to underline "should be carried away captive"
// under a note about Babylon.
//
// So the numbers are treated as a hint and the quotation as the truth: the run
// is looked for in the verse, and the counts are used only where it cannot be
// found. The note is the thing that knows what it is quoting.

// A word reduced to what it is regardless of setting — case, the punctuation
// hanging off it, the two apostrophes, the scan's own hyphens. "Babylon." and
// "babylon" are one word; so are "shew’d" and "shewd".
const fold = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Whitespace-separated tokens, which is how the positions were counted and how
// the reader splits a verse to draw its marks (see verseSegments).
export const words = (text) => String(text ?? "").split(/\s+/).filter(Boolean);

// How much of a quotation has to be found before a window is believed to be it.
// Two words in three: enough that a run damaged by the scan, or worded a little
// differently, is still recognised, and far too much for an unrelated stretch
// of the verse to reach by accident.
const ENOUGH = 2 / 3;

// How well the quotation sits over the verse starting at `from`, as the share
// of its words found there in order. Compared position for position rather than
// as a set, so a window that merely reuses the same common words does not score
// as the phrase itself.
function overlap(tokens, quote, from) {
  let hit = 0;
  for (let i = 0; i < quote.length; i++) {
    if (tokens[from + i] === quote[i]) hit++;
  }
  return hit / quote.length;
}

// The run of `text` that `quote` names, as a 1-based inclusive pair of word
// positions — or null where the verse plainly does not hold it.
//
// `hint` is what the note itself claims, and it settles two things: which
// occurrence is meant when a verse says the same words twice, and what to fall
// back on when the quotation cannot be found at all.
export function locate(text, quote, hint) {
  const tokens = words(text).map(fold);
  const clamp = () => {
    if (!hint) return null;
    const [a, b] = hint;
    // A span that has fallen off the end of the verse entirely marks nothing.
    // Half a span is still worth drawing; a span past the last word is not, and
    // was drawing a highlight over whatever happened to sit at the end.
    if (!(a >= 1) || a > tokens.length) return null;
    return [a, Math.min(b ?? a, tokens.length)];
  };

  const q = words(quote).map(fold).filter(Boolean);
  if (!q.length || q.length > tokens.length) return clamp();

  const near = hint?.[0] ?? 1;
  let best = null;
  for (let from = 0; from + q.length <= tokens.length; from++) {
    const score = overlap(tokens, q, from);
    if (score < ENOUGH) continue;
    const distance = Math.abs(from + 1 - near);
    // The best match wins outright; where two are equally good — a verse that
    // says the same words twice — the one the note counted to wins.
    const better = !best
      || score > best.score + 1e-9
      || (Math.abs(score - best.score) < 1e-9 && distance < best.distance);
    if (better) best = { from, score, distance };
  }
  if (!best) return clamp();
  return [best.from + 1, best.from + q.length];
}

// The same question asked of a connection, which carries its quotation and its
// counts together. Returns the words to mark, or null to mark none.
export const locateAnchor = (text, c) =>
  locate(text, c?.quote, c?.words ?? null);
