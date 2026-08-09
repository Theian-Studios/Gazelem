// Which of the site's own study pages have something to say about the chapter
// the reader has open. The charts, the evidences and the translation essays all
// argue from the text, and every one of them names the passages it argues from
// — so the index is not a list anybody has to keep. It is read off the
// citations themselves, by the same scan that turns them into doors on the page
// (lib/cites.js), which means a chart cannot cite a chapter and fail to appear
// under it.
//
// That scan runs at build time rather than here (scripts/build-manifest.mjs).
// It has to read every chart and every evidence to do it, and those are most of
// what the site ships — so having the reader download them all to find out
// which three of them mention Alma 34 was paying the whole price for a very
// small answer. The answer is written out instead, and this reads it.
import { studyAt } from "./manifest.js";

// The written pages that treat this chapter. Ordered so the page that says most
// about it comes first — a chart with six of its rows in this chapter is more
// use to the reader here than an essay that cites it once in passing.
export function mentionsOf(bookName, chapter) {
  if (!bookName || chapter == null) return [];
  return [...(studyAt(bookName, chapter) || [])]
    .sort((a, b) => b.verses.length - a.verses.length || a.title.localeCompare(b.title));
}

// The same, sorted into the margin of the chapter.
//
// A page is marked once, at the first verse it names — not at every one. The
// Devil's Devices treating Jacob 7 at verses 2 and 4 is one chart, and two
// marks down the gutter leading to the same chart is the gutter saying the same
// thing twice. The card names the rest of its verses.
//
// A page that names the chapter and no verse in it — the anti-Christs chart
// citing Jacob 7 for the whole Sherem episode — has no verse to stand beside,
// and is marked at the chapter's title instead.
export function marginMentions(bookName, chapter) {
  const pages = mentionsOf(bookName, chapter);
  const verses = new Map();
  const whole = [];
  for (const p of pages) {
    if (!p.verses.length) { whole.push(p); continue; }
    const at = p.verses[0];
    const list = verses.get(at) || [];
    list.push(p);
    verses.set(at, list);
  }
  return { verses, whole };
}

// How the verses are named where a page is listed: the chapter's own numbers,
// since the book and chapter are what the reader is already looking at.
export const versesLabel = (verses) => {
  if (!verses.length) return "";
  if (verses.length <= 4) return `v. ${verses.join(", ")}`;
  return `v. ${verses.slice(0, 3).join(", ")} +${verses.length - 3}`;
};
