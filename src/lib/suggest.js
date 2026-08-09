// Two questions asked of the same list of words: what could this be turning
// into, and — when nothing was found — what might have been meant instead.
//
// The list is the vocabulary built alongside the index (see
// scripts/build-search-index.mjs): every word as the scriptures actually write
// it, with how often, in a file per first letter. A letter is around twenty
// kilobytes and answers every question about words beginning with it, so the
// suggestions cost one small fetch each and nothing after that.
import { words } from "./stem.js";

const BASE = `${import.meta.env.BASE_URL}search/w/`;
const letters = new Map();

function loadLetter(ch) {
  if (!letters.has(ch)) {
    letters.set(
      ch,
      fetch(`${BASE}${ch}.json`)
        .then((r) => {
          // No file means no word starts with that letter, which is an empty
          // answer rather than a failure. A failure is not an empty answer, and
          // caching it as one would leave the letter silent for the session.
          if (r.status === 404) return [];
          if (!r.ok) throw new Error(`Vocabulary unavailable (${r.status})`);
          return r.json();
        })
        .catch((e) => { letters.delete(ch); throw e; })
    );
  }
  return letters.get(ch);
}

// Optimal string alignment: Levenshtein plus swapped neighbours, since
// "atnoement" is a slip of the fingers rather than two separate errors. Gives
// up as soon as a whole row is past the limit, which is what keeps this cheap
// across a couple of thousand candidates.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      row[j] = d;
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

// The words this one could still be growing into, commonest first — the file
// is already in that order, so filtering it keeps it.
export async function completions(word, limit = 5) {
  const w = word.toLowerCase();
  if (w.length < 2) return [];
  // A letter that will not load costs the reader a suggestion and nothing else,
  // so it is silence rather than an error — but it is not remembered as one,
  // and the next keystroke asks again.
  const list = await loadLetter(w[0]).catch(() => []);
  const out = [];
  for (const [candidate] of list) {
    // The word as typed is already offered as itself; only what it could
    // become is worth a row.
    if (candidate === w || !candidate.startsWith(w)) continue;
    out.push(candidate);
    if (out.length === limit) break;
  }
  return out;
}

// The words this one was probably meant to be. Short words get one slip of
// grace and long ones two, or "ye" would answer to half the alphabet.
export async function nearest(word, limit = 3) {
  const w = word.toLowerCase();
  if (w.length < 3) return [];
  const max = w.length <= 4 ? 1 : 2;
  const list = await loadLetter(w[0]).catch(() => []);
  const scored = [];
  for (const [candidate, count] of list) {
    const d = distance(w, candidate, max);
    if (d <= max) scored.push({ word: candidate, d, count });
  }
  // Nearest first, and among equals the one the scriptures say most often.
  scored.sort((a, b) => a.d - b.d || b.count - a.count);
  return scored.slice(0, limit).map((s) => s.word);
}

// Swaps one word of a query for another, keeping the rest as it was typed.
export function replaceWord(query, from, to) {
  let done = false;
  return query.replace(/[a-zA-Z’']+/g, (m) => {
    if (done || words(m)[0] !== from) return m;
    done = true;
    return to;
  });
}
