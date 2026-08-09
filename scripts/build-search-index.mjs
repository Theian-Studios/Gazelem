// Builds the word-search index from the scripture JSON in public/scriptures.
//
//   node scripts/build-search-index.mjs
//
// Two kinds of file come out, both under public/search:
//
//   meta.json      every chapter and section in one list — volume, book,
//                  number, reference — so a result row can be drawn from the
//                  index alone, before any scripture text has been fetched.
//
//   t/<shard>.json the postings: which chapters a stem appears in, and where.
//                  Sharded on the stem's first two letters so a search
//                  downloads only the handful of kilobytes its own words need
//                  rather than the whole index.
//
// A posting is `<unit delta in base 36>:<verse>.<verse>…`, verses in base 36
// too and repeated when a verse holds the word twice — so the hit count is
// just how many verses are listed. Deltas because the unit numbers climb, and
// the gaps are far smaller than the numbers.
//
// Run it whenever the scripture files change; the output is committed.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stem, words } from "../src/lib/stem.js";
import { shardKey } from "../src/lib/searchShard.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public", "scriptures");
const OUT = join(root, "public", "search");

const VOLUMES = [
  { id: "ot", file: "old-testament" },
  { id: "nt", file: "new-testament" },
  { id: "bofm", file: "book-of-mormon" },
  { id: "dc", file: "doctrine-and-covenants" },
  { id: "pgp", file: "pearl-of-great-price" },
];

// The D&C is one book of sections rather than a shelf of books, and the reader
// names it the same way — see normalizeVolume in src/lib/api.js.
function unitsOf(volId, data) {
  if (volId === "dc") {
    return data.sections.map((s) => ({
      book: "Sections", n: s.section, reference: s.reference, verses: s.verses,
    }));
  }
  return data.books.flatMap((b) =>
    b.chapters.map((c) => ({ book: b.book, n: c.chapter, reference: c.reference, verses: c.verses }))
  );
}

const b36 = (n) => n.toString(36);

const units = [];
// stem → unit index → array of verse numbers (one entry per occurrence)
const postings = new Map();
// The words as they are actually written, with how often — the index itself
// only keeps stems, and a stem is no use to offer someone as a suggestion.
const vocab = new Map();

for (const vol of VOLUMES) {
  const data = JSON.parse(readFileSync(join(SRC, `${vol.file}.json`), "utf8"));
  for (const u of unitsOf(vol.id, data)) {
    const idx = units.length;
    // The verse count rides along so relevance can weigh a chapter's hits
    // against its length — three hits in ten verses says more than three in
    // eighty.
    units.push([vol.id, u.book, u.n, u.reference, u.verses.length]);
    for (const verse of u.verses) {
      for (const w of words(verse.text)) {
        vocab.set(w, (vocab.get(w) || 0) + 1);
        const s = stem(w);
        let byUnit = postings.get(s);
        if (!byUnit) postings.set(s, (byUnit = new Map()));
        let list = byUnit.get(idx);
        if (!list) byUnit.set(idx, (list = []));
        list.push(verse.verse);
      }
    }
  }
}

const encoded = new Map();
let postingCount = 0;
for (const [s, byUnit] of postings) {
  const indices = [...byUnit.keys()].sort((a, b) => a - b);
  let prev = 0;
  const list = indices.map((idx) => {
    const delta = idx - prev;
    prev = idx;
    postingCount++;
    // Sorted so the first verse listed is the first hit in the chapter, which
    // is the one a result row quotes.
    const verses = byUnit.get(idx).sort((a, b) => a - b).map(b36).join(".");
    return `${b36(delta)}:${verses}`;
  });
  encoded.set(s, list.join(","));
}

// Two letters is enough for most of the alphabet, but a few prefixes carry a
// disproportionate share of the language — "th" alone holds "the", "thou" and
// "their". Those get split a letter deeper, and meta.json names them so the
// reader knows which file to ask for.
const LIMIT = 96 * 1024;
const group = (depth) => {
  const out = new Map();
  for (const [s, v] of encoded) {
    const key = shardKey(s, depth);
    if (!out.has(key)) out.set(key, {});
    out.get(key)[s] = v;
  }
  return out;
};
const weigh = (obj) => JSON.stringify(obj).length;

const shallow = group(2);
const deep = [...shallow].filter(([, obj]) => weigh(obj) > LIMIT).map(([key]) => key);
const deepSet = new Set(deep);

const shards = new Map();
for (const [key, obj] of shallow) {
  if (!deepSet.has(key)) { shards.set(key, obj); continue; }
  for (const [s, v] of Object.entries(obj)) {
    const k3 = shardKey(s, 3);
    if (!shards.has(k3)) shards.set(k3, {});
    shards.get(k3)[s] = v;
  }
}

// The vocabulary goes out by first letter rather than by two, because it
// answers two questions and the second one is about words that are misspelt
// after the first letter — so the whole letter has to be in hand to look
// through. Commonest first, which is the order suggestions want anyway.
const byLetter = new Map();
for (const [word, count] of [...vocab].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  const key = word[0];
  if (!byLetter.has(key)) byLetter.set(key, []);
  byLetter.get(key).push([word, count]);
}

rmSync(join(OUT, "t"), { recursive: true, force: true });
rmSync(join(OUT, "w"), { recursive: true, force: true });
mkdirSync(join(OUT, "t"), { recursive: true });
mkdirSync(join(OUT, "w"), { recursive: true });
writeFileSync(join(OUT, "meta.json"), JSON.stringify({ units, deep }));
for (const [key, obj] of shards) {
  writeFileSync(join(OUT, "t", `${key}.json`), JSON.stringify(obj));
}
for (const [key, list] of byLetter) {
  writeFileSync(join(OUT, "w", `${key}.json`), JSON.stringify(list));
}

const bytes = (p) => readdirSync(p).reduce((a, f) => a + readFileSync(join(p, f)).length, 0);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const shardSizes = readdirSync(join(OUT, "t"))
  .map((f) => [f, readFileSync(join(OUT, "t", f)).length])
  .sort((a, b) => b[1] - a[1]);

console.log(`units      ${units.length}`);
console.log(`stems      ${postings.size}`);
console.log(`postings   ${postingCount}`);
console.log(`meta.json  ${kb(readFileSync(join(OUT, "meta.json")).length)}`);
console.log(`shards     ${shards.size} files, ${kb(bytes(join(OUT, "t")))} total`);
console.log(`largest    ${shardSizes.slice(0, 5).map(([f, n]) => `${f} ${kb(n)}`).join(", ")}`);
const vocabSizes = readdirSync(join(OUT, "w"))
  .map((f) => [f, readFileSync(join(OUT, "w", f)).length])
  .sort((a, b) => b[1] - a[1]);
console.log(`vocabulary ${vocab.size} words, ${byLetter.size} files, ${kb(bytes(join(OUT, "w")))} total`);
console.log(`largest    ${vocabSizes.slice(0, 4).map(([f, n]) => `${f} ${kb(n)}`).join(", ")}`);
