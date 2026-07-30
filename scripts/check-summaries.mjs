// Validates public/local/summaries.json against the app's book names and
// chapter counts, and reports coverage per volume.
//   node scripts/check-summaries.mjs
import { readFileSync } from "node:fs";
import { BOOK_INDEX } from "../src/data/bookIndex.js";
import { VOL_SHORT } from "../src/data/volumes.js";

const PATH = "public/local/summaries.json";

let data;
try {
  data = JSON.parse(readFileSync(PATH, "utf8"));
} catch (e) {
  console.error(`Couldn't read ${PATH}\n  ${e.message}`);
  console.error("\nSee public/local/README.md for the expected format.");
  process.exit(1);
}

if (!data.summaries || typeof data.summaries !== "object") {
  console.error(`${PATH} has no "summaries" object. See public/local/README.md.`);
  process.exit(1);
}

const byName = new Map(BOOK_INDEX.map((b) => [b.n, b]));
const supplied = Object.keys(data.summaries);

const unknown = supplied.filter((n) => !byName.has(n));
const totals = {};
let matched = 0;
let outOfRange = 0;
let empty = 0;

for (const [name, chapters] of Object.entries(data.summaries)) {
  const book = byName.get(name);
  if (!book) continue;
  for (const [n, text] of Object.entries(chapters)) {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 1 || num > book.c) {
      outOfRange++;
      console.warn(`  out of range: ${name} ${n} (book has ${book.c} chapters)`);
      continue;
    }
    if (typeof text !== "string" || !text.trim()) { empty++; continue; }
    matched++;
    totals[book.v] = (totals[book.v] || 0) + 1;
  }
}

const expected = {};
for (const b of BOOK_INDEX) expected[b.v] = (expected[b.v] || 0) + b.c;

console.log(`\nlabel: ${JSON.stringify(data.label ?? "Chapter summary")}`);
console.log(`books supplied: ${supplied.length}   summaries matched: ${matched}\n`);

console.log("coverage by volume");
for (const v of Object.keys(expected)) {
  const have = totals[v] || 0;
  const pct = Math.round((have / expected[v]) * 100);
  const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "·");
  console.log(`  ${String(VOL_SHORT[v]).padEnd(5)} ${bar} ${String(have).padStart(4)}/${expected[v]}  ${pct}%`);
}

if (unknown.length) {
  console.log(`\nunrecognized book names (${unknown.length}) — these are ignored by the app:`);
  const shared = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  for (const n of unknown.slice(0, 20)) {
    // Offer the closest name by shared prefix, which catches most variants.
    const [name, len] = BOOK_INDEX
      .map((b) => [b.n, shared(b.n.toLowerCase(), n.toLowerCase())])
      .sort((a, b) => b[1] - a[1])[0];
    console.log(`  ${JSON.stringify(n)}${len >= 3 ? `  → did you mean ${JSON.stringify(name)}?` : ""}`);
  }
  if (unknown.length > 20) console.log(`  …and ${unknown.length - 20} more`);
}
if (outOfRange) console.log(`\n${outOfRange} chapter number(s) out of range.`);
if (empty) console.log(`${empty} empty summary value(s) skipped.`);

console.log(
  unknown.length || outOfRange
    ? "\nFix the items above, then reload the page.\n"
    : "\nLooks good — reload the page to see them.\n"
);
