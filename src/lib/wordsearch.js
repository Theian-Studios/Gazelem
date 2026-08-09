// Word search over the whole standard works, run against the index built by
// scripts/build-search-index.mjs.
//
// A search costs two small fetches: the chapter list (50 KB, once), and one
// shard per word in the query — a few tens of kilobytes, because the index is
// split by the stem's first letters. Nothing else is downloaded to produce the
// result rows and their hit counts.
//
// Scripture text is a separate matter: the rows quote a verse, and only the
// volume files hold verses. Those load in the background, per volume, and the
// snippets fill in as they arrive — so the list is on screen long before the
// text behind it is. They are the same files the reader itself uses, so a
// volume fetched for a snippet is already there when a result is opened.
import { stem, words } from "./stem.js";
import { shardFor } from "./searchShard.js";
import { VOLUMES } from "../data/volumes.js";
import { loadVolume, getCached } from "./api.js";

const BASE = `${import.meta.env.BASE_URL}search/`;

let metaRequest = null;
const shardRequests = new Map();

export function loadMeta() {
  if (!metaRequest) {
    metaRequest = fetch(`${BASE}meta.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Search index unavailable (${r.status})`);
        return r.json();
      })
      .then((d) => ({ units: d.units, deep: new Set(d.deep || []) }))
      // Don't cache a failure: the next search should try again.
      .catch((e) => { metaRequest = null; throw e; });
  }
  return metaRequest;
}

function loadShard(key) {
  if (!shardRequests.has(key)) {
    shardRequests.set(
      key,
      fetch(`${BASE}t/${key}.json`)
        .then((r) => {
          // A missing shard means no word in the index starts that way, which
          // is an empty result rather than a failure. Anything else is a
          // failure, and must not be mistaken for one: an empty shard says the
          // scriptures never use the word, which is a "did you mean" and a lie
          // if the file was merely unreachable.
          if (r.status === 404) return {};
          if (!r.ok) throw new Error(`Search index unavailable (${r.status})`);
          return r.json();
        })
        // Don't cache a failure: the next search should try again, rather than
        // this shard's words staying unsayable for the rest of the session.
        .catch((e) => { shardRequests.delete(key); throw e; })
    );
  }
  return shardRequests.get(key);
}

// "1a:3.5,2:1" → [{ unit, verses: [3, 5] }, { unit, verses: [1] }], the unit
// numbers running as deltas so the string stays short.
function decode(postings) {
  const out = [];
  let unit = 0;
  for (const entry of postings.split(",")) {
    const [d, verses] = entry.split(":");
    unit += parseInt(d, 36);
    out.push({ unit, verses: verses.split(".").map((v) => parseInt(v, 36)) });
  }
  return out;
}

// The words a query is looking for, each with the stem it will be matched by.
// Duplicates collapse: "faith and faith" asks nothing twice.
export function queryTerms(query) {
  const seen = new Set();
  const terms = [];
  for (const w of words(query)) {
    const s = stem(w);
    if (seen.has(s)) continue;
    seen.add(s);
    terms.push({ word: w, stem: s });
  }
  return terms;
}

// Hits per chapter, ranked. Every term must appear in a chapter for it to
// count — searching two words means both, as a reader would expect.
export async function search(query, { volumes, exactPhrase = false } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return { terms: [], missing: [], rows: [] };

  const meta = await loadMeta();
  const lists = await Promise.all(
    terms.map(async (t) => {
      const shard = await loadShard(shardFor(t.stem, meta.deep));
      const raw = shard[t.stem];
      return raw ? decode(raw) : [];
    })
  );
  // Which words the scriptures never say at all, as against which ones simply
  // never meet. Only the first kind can be answered with "did you mean".
  const missing = terms.filter((t, i) => lists[i].length === 0);
  if (missing.length) return { terms, missing, rows: [] };

  // Intersect starting from the shortest list, so the rarest word does the
  // narrowing and the common ones only have to be checked against what is left.
  const order = lists.map((l, i) => i).sort((a, b) => lists[a].length - lists[b].length);
  let byUnit = new Map(lists[order[0]].map((p) => [p.unit, [p.verses]]));
  for (const i of order.slice(1)) {
    const next = new Map();
    for (const p of lists[i]) {
      const soFar = byUnit.get(p.unit);
      if (soFar) next.set(p.unit, [...soFar, p.verses]);
    }
    if (next.size === 0) return { terms, missing: [], rows: [] };
    byUnit = next;
  }

  const wanted = volumes && volumes.size ? volumes : null;
  const rows = [];
  for (const [unit, perTerm] of byUnit) {
    const [volId, book, n, reference, verseCount] = meta.units[unit];
    if (wanted && !wanted.has(volId)) continue;

    const hits = perTerm.reduce((a, v) => a + v.length, 0);
    const all = [...new Set(perTerm.flat())].sort((a, b) => a - b);
    // Verses carrying every term at once — what a reader means by putting two
    // words together, and the strongest sign a chapter is about the thing
    // asked for. With one word there is nothing to share, so no bonus falls
    // out of it.
    const shared = perTerm
      .map((v) => new Set(v))
      .reduce((a, b) => new Set([...a].filter((x) => b.has(x))))
    const sharedVerses = [...shared].sort((a, b) => a - b);
    // With one word every verse holding it already holds "every term", so there
    // is nothing that meeting could add to the ranking — but the verses are
    // still the ones an exact-phrase pass has to read.
    const bonus = terms.length > 1 ? 1 + sharedVerses.length : 1;

    rows.push({
      unit, volId, book, n, reference, verseCount,
      hits,
      verses: all,
      sharedVerses,
      firstVerse: sharedVerses[0] ?? all[0],
      // Hits told against the chapter's length, so a short chapter that keeps
      // returning to the word outranks a long one that mentions it as often.
      score: (hits / Math.sqrt(verseCount)) * bonus,
    });
  }

  rows.sort((a, b) => b.score - a.score || a.unit - b.unit);
  if (!exactPhrase) return { terms, missing: [], rows };

  // The index knows which verses hold every word, but not whether they stand
  // together in order — only the text says that, so those verses are read.
  // Built from the query rather than from `terms`, which collapses duplicates:
  // "holy of holies" asks the index three questions and two distinct ones, and
  // matched against the shorter of the two it would find "holiness of" instead.
  const phrase = words(query).join(" ");
  const kept = [];
  for (const row of rows.filter((r) => r.sharedVerses.length)) {
    const verses = await versesFor(row);
    if (!verses) continue;
    const matching = row.sharedVerses.filter((n) => hasPhrase(verses[n] || "", phrase));
    if (matching.length) {
      kept.push({ ...row, verses: matching, sharedVerses: matching, firstVerse: matching[0], hits: matching.length });
    }
  }
  return { terms, missing: [], rows: kept };
}

// Words in order, ignoring the punctuation and the exact forms between them.
function hasPhrase(text, phrase) {
  const hay = words(text).map(stem);
  const needle = words(phrase).map(stem);
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

// ---- Scripture text, for the quoted line under each result ----------------

const volumeOf = (volId) => VOLUMES.find((v) => v.id === volId);

// Verse number → text for one chapter, or null if its volume has not been
// fetched. Reads the reader's own cache, so nothing is ever fetched twice.
export function cachedVerses(row) {
  const books = getCached(row.volId);
  if (!books) return null;
  const book = row.volId === "dc" ? books[0] : books.find((b) => b.name === row.book);
  const chapter = book?.chapters.find((c) => c.n === row.n);
  if (!chapter) return null;
  const out = {};
  for (const v of chapter.verses) out[v.verse] = v.text;
  return out;
}

export async function versesFor(row) {
  if (!getCached(row.volId)) await loadVolume(volumeOf(row.volId));
  return cachedVerses(row);
}

// Fetches the volumes a set of rows quotes from, rarest first so the volume
// holding the most results is ready soonest. `onReady` fires per volume, so
// the list can fill its quotes in as each one lands.
export async function loadTextFor(rows, onReady) {
  const need = new Map();
  for (const r of rows) need.set(r.volId, (need.get(r.volId) || 0) + 1);
  const byWeight = [...need].filter(([id]) => !getCached(id)).sort((a, b) => b[1] - a[1]);
  for (const [volId] of byWeight) {
    try {
      await loadVolume(volumeOf(volId));
      onReady?.(volId);
    } catch {
      // A volume that will not load costs its rows their quoted line and
      // nothing else; the rest of the results stand.
    }
  }
}

// The quoted line: the verse where the search first lands, cut down to a
// window around the match and split so the matched words can be marked.
const WINDOW = 190;

export function snippet(text, stems) {
  const parts = [];
  let cut = 0;
  let firstHit = -1;
  // Walk the words in place, so the text between them survives untouched and
  // the quote reads as the verse does.
  for (const m of text.matchAll(/[a-zA-Z’']+/g)) {
    if (!stems.has(stem(m[0].toLowerCase().replace(/[’']/g, "")))) continue;
    if (firstHit < 0) firstHit = m.index;
    parts.push({ text: text.slice(cut, m.index) });
    parts.push({ text: m[0], hit: true });
    cut = m.index + m[0].length;
  }
  parts.push({ text: text.slice(cut) });
  if (firstHit < 0) return [{ text: text.slice(0, WINDOW) + (text.length > WINDOW ? "…" : "") }];

  // Keep the match in view: start a little before it and run on from there.
  const from = Math.max(0, firstHit - 60);
  const to = from + WINDOW;
  const out = [];
  let at = 0;
  for (const p of parts) {
    const start = at;
    at += p.text.length;
    if (at <= from || start >= to) continue;
    out.push({ ...p, text: p.text.slice(Math.max(0, from - start), to - start) });
  }
  if (from > 0) out.unshift({ text: "…" });
  if (to < text.length) out.push({ text: "…" });
  return out;
}
