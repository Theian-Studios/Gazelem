// Finding the references inside a run of prose. Kept apart from the drawing of
// them because two quite different jobs ask the same question of a string: the
// pages that turn a reference into a door (see components/Cited.jsx), and the
// index that asks which study pages speak about a chapter the reader has open
// (see mentions.js). Both must agree about what counts as a reference, and the
// only way to be sure of that is to have one of them.
import { parseCitations, expandVerses, BOOK_SPELLINGS } from "./refs.js";

// A book's name as it may be written, out of the one spelling the resolver
// files it under. A trailing period is the abbreviation's own and optional in
// prose; the dashes and the apostrophes each have several characters in common
// use; and a name of several words may be set with any run of space.
const spelling = (s) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\.$/, "\\.?")
    .replace(/\s+/g, "\\s+")
    .replace(/[—–-]/g, "[—–-]")
    .replace(/['’]/g, "['’]");

// A run carries several citations at once — the primary, then the synoptic
// parallels in parentheses — so each is found on its own.
//
// The book is matched against the names themselves rather than against the
// shape of a name. A pattern for the shape can only describe one word, which
// reads "Words of Mormon 1:1" as the Mormon in it and never sees "JS—H 1:59" at
// all — and it would be this file quietly disagreeing with the resolver about
// what a book is, which is the one thing the two of them must not do.
//
// The second group is the verses, when there are any; a citation without them
// names a chapter, and only then can the numbers after it name further
// chapters (see CHAPTER).
// The verses listed after the first are held to three digits: the longest
// chapter in the standard works is Psalm 119 and its 176 verses, so nothing
// longer can be one — while "Helaman 12:13–21, 1830 edition" is a citation
// followed by a year, and unbounded the list swallows the year into the link.
const BOOK = BOOK_SPELLINGS.map(spelling).join("|");

// What a comma may not be followed by if the number after it is to go on
// listing the same citation's verses: a book's name, whose own leading numeral
// would otherwise be read as one more verse and swallow the book behind it.
// "Alma 5:21, 27" names two verses; "1 Sam 5:4, 2 Kgs 4:1" names two books.
// Tested before the number rather than after it, because the number in question
// is the book's — the 2 of 2 Kings.
const NOT_A_BOOK = `(?!(?:${BOOK})\\s)`;

// A further verse of the citation being listed.
const MORE_VERSES = `(?:,\\s*${NOT_A_BOOK}\\d{1,3}(?!\\d))*`;

const CITE = new RegExp(`(?:${BOOK})\\s+\\d+(:\\d+(?:[–—-]\\d+)?${MORE_VERSES})?`, "gi");

// What a citation goes on to name after it, all of it belonging to the book it
// opened with. Both forms are held to three digits: no volume runs to a
// thousand chapters, and what follows a citation in four is a year.

// Another chapter and verse of the same book: the 28:13–20 of "Mosiah 8:13;
// 28:13–20". The colon is what makes this safe to read after any citation at
// all — no book's name can look like it.
const VERSED = new RegExp(`^(\\s*[,;–—-]\\s*)(\\d{1,3}):(\\d+(?:[–—-]\\d+)?${MORE_VERSES})`, "i");

// Another chapter, with no verses under it: the 10 of "D&C 3, 10" and of
// "D&C 3; 10", the 123 of "D&C 121–123". A bare number is read only after a
// citation that named a chapter and no verses of its own — in "Ether 5:4;
// 2 Nephi 27:12–13" the 2 opens a book's name, not a chapter of Ether, and
// only the citation before it can tell the two apart.
const CHAPTER = new RegExp(`^(\\s*[,;–—-]\\s*)${NOT_A_BOOK}(\\d{1,3})(?![\\d:])`, "i");

// The run broken into its pieces, in order: plain text, and the groups of
// references among it. A group is everything one citation names — the book and
// chapter it opens with, and whatever it goes on to list — kept together so a
// line never breaks inside a reference, with `held` saying whether an opening
// bracket belongs to it.
//
// Whether a thing that looks like a reference is one is settled by whether the
// book resolves, which is what keeps "the 12 apostles" and "*Saints' Herald* 26"
// out of it without a list of exceptions.
export function scanCites(text) {
  const out = [];
  let at = 0;   // how far through the text has been accounted for
  const plain = (s) => { if (s) out.push({ kind: "text", text: s }); };

  CITE.lastIndex = 0;
  for (let m; (m = CITE.exec(text || "")); ) {
    // A citation begins a word. The scan resumes one character into whatever
    // failed (see below), and without this it can find a book inside an
    // ordinary word: "from 1830" fails as "from", the scan steps on a letter,
    // and "rom 1830" is left — "rom." being an abbreviation the resolver knows.
    if (m.index > 0 && /[A-Za-z]/.test(text[m.index - 1])) {
      CITE.lastIndex = m.index + 1;
      continue;
    }
    const cite = parseCitations(m[0])[0];
    // "the 12 apostles" has the shape of a citation and is not one.
    //
    // The scan resumes one character in rather than past the whole of what
    // failed, because a real citation can begin inside it: "original text of 1
    // Nephi 17:50" offers up "of 1" first, and skipping the length of that
    // takes the "1" away from the book it belongs to.
    if (!cite) { CITE.lastIndex = m.index + 1; continue; }

    // `versed` is whether what was last named carried verses, which is what
    // says a bare number after it cannot be a chapter — see CHAPTER.
    const links = [{ label: m[0], title: m[0], cite }];
    let versed = !!m[1];
    for (;;) {
      const rest = text.slice(CITE.lastIndex);
      const more = VERSED.exec(rest) || (!versed && CHAPTER.exec(rest));
      if (!more) break;
      const chapter = Number(more[2]);
      const verses = more[3] ? expandVerses(more[3]) : [];
      const label = more[0].slice(more[1].length);
      links.push({
        sep: more[1],
        label,
        title: `${cite.book.n} ${label}`,
        cite: { book: cite.book, chapter, verses },
      });
      CITE.lastIndex += more[0].length;
      if (verses.length) versed = true;
    }

    const held = text[m.index - 1] === "(";
    plain(text.slice(at, m.index - (held ? 1 : 0)));
    out.push({ kind: "cites", held, links });
    at = CITE.lastIndex;
  }
  plain((text || "").slice(at));
  return out;
}

// Every reference in a run, flattened — which is all the index wants of it.
export const citationsIn = (text) =>
  scanCites(text).flatMap((part) => (part.kind === "cites" ? part.links.map((l) => l.cite) : []));
