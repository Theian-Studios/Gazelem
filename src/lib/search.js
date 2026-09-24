import { BOOK_INDEX } from "../data/bookIndex.js";
import { verseCount } from "../data/verseCounts.js";

// A reference is only offered when the chapter exists in the book and the
// verse exists in that chapter.
const validRef = (b, ch, verse) =>
  ch >= 1 && ch <= b.c && (verse == null || (verse >= 1 && verse <= verseCount(b.n, ch)));

const norm = (s) =>
  s.toLowerCase().replace(/[—–-]/g, " ").replace(/[&.',’]/g, "").replace(/\s+/g, " ").trim();

function matchBooks(part) {
  const q = norm(part);
  if (!q) return [];
  const qns = q.replace(/ /g, "");
  return BOOK_INDEX.filter((b) => {
    const n = norm(b.n);
    const nns = n.replace(/ /g, "");
    if (n.startsWith(q) || nns.startsWith(qns)) return true;
    if (b.a && b.a.some((al) => al.startsWith(qns))) return true;
    const qw = q.split(" ");
    const nw = n.split(" ");
    if (qw.length > 1 && qw.length <= nw.length && qw.every((w, i) => nw[i].startsWith(w))) return true;
    return false;
  });
}

// A reference names a run of verses as often as it names one — "1 Nephi 3:7–9",
// "Alma 5:21, 27", "D&C 76–77" — and the suggestion for all of them is the
// passage's opening verse, which is where the reader is taken and from which
// they read on. Cutting the rest away here rather than teaching the tokeniser
// about ranges keeps one question being asked of the string: which book, which
// chapter, which verse.
//
// Left in, the separator became a token of its own, the tail stopped being all
// digits, and the commonest way a passage is written offered nothing at all.
const opening = (s) => {
  // A verse range or list: cut back to the verse it opens with.
  const verses = s.match(/^(.*?\d+\s*[:.]\s*\d+)\s*[–—,-]\s*\d/);
  if (verses) return verses[1];
  // A chapter range, where no verse was named. The book's own leading numeral
  // is not a chapter, so the match has to reach past it — "1 Nephi 3–5" opens
  // at 1 Nephi 3, not at 1.
  const chapters = s.match(/^(.*?\d+)\s*[–—-]\s*\d/);
  return chapters ? chapters[1] : s;
};

export function getSuggestions(query) {
  const raw = opening(query.trim());
  if (!raw) return [];
  const hasColon = /\d\s*[:.]\s*\d/.test(raw);
  // Split letters from digits so "mos23" reads the same as "mos 23".
  const spaced = raw.replace(/(\d)(\D)/g, "$1 $2").replace(/(\D)(\d)/g, "$1 $2");
  const tokens = spaced.split(/[\s:.,;]+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const key = `${s.book}|${s.ch || ""}|${s.verse || ""}`;
    if (seen.has(key) || out.length >= 8) return;
    seen.add(key);
    out.push(s);
  };

  for (let i = tokens.length; i >= 1; i--) {
    const tail = tokens.slice(i);
    if (tail.length > 2 || !tail.every((t) => /^\d+$/.test(t))) continue;
    const head = tokens.slice(0, i).join(" ");
    const nums = tail.map(Number);
    for (const b of matchBooks(head)) {
      if (nums.length === 0) {
        push({ label: b.n, book: b.n, v: b.v });
      } else if (nums.length === 1) {
        const a = nums[0];
        const digits = tail[0];
        // A number written where a chapter goes, that this book has no chapter
        // for. The readings below still offer the reader somewhere sensible to
        // go — "jacob 12" becomes Jacob 1:2, as "mos 23" becomes Mosiah 2:3 —
        // but offered silently, that answers a question about chapter 12 with a
        // verse and never says the chapter does not exist. So the row carries
        // the reason it is not what was asked for.
        const noSuchChapter =
          a > b.c ? `${b.n} has ${b.c} chapter${b.c === 1 ? "" : "s"}` : null;
        if (b.c === 1 && a > 1) {
          if (validRef(b, 1, a)) push({ label: `${b.n} 1:${a}`, book: b.n, v: b.v, ch: 1, verse: a });
        } else if (validRef(b, a)) {
          push({ label: `${b.n} ${a}`, book: b.n, v: b.v, ch: a });
        }
        // A multi-digit number with no colon can also mean chapter:verse,
        // e.g. "mos 23" → Mosiah 23 (above) and Mosiah 2:3 (below). Prefer the
        // most balanced split, so "alma3212" reads as 32:12 before 3:212.
        if (!hasColon && digits.length >= 2) {
          const splits = [];
          for (let s = 1; s < digits.length; s++) {
            const ch = Number(digits.slice(0, s));
            const verse = Number(digits.slice(s));
            if (validRef(b, ch, verse)) splits.push({ ch, verse, skew: Math.abs(s * 2 - digits.length) });
          }
          splits.sort((x, y) => x.skew - y.skew || x.ch - y.ch);
          for (const { ch, verse } of splits) {
            push({ label: `${b.n} ${ch}:${verse}`, book: b.n, v: b.v, ch, verse, note: noSuchChapter });
          }
        }
      } else {
        const [a, c2] = nums;
        if (validRef(b, a, c2)) {
          push({ label: `${b.n} ${a}:${c2}`, book: b.n, v: b.v, ch: a, verse: c2 });
        }
        if (!hasColon) {
          const joined = Number(`${nums[0]}${nums[1]}`);
          if (validRef(b, joined)) {
            push({ label: `${b.n} ${joined}`, book: b.n, v: b.v, ch: joined });
          }
        }
      }
      if (out.length >= 8) return out;
    }
  }
  return out;
}
