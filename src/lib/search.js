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

export function getSuggestions(query) {
  const raw = query.trim();
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
            push({ label: `${b.n} ${ch}:${verse}`, book: b.n, v: b.v, ch, verse });
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
