// Builds the public-domain scripture text the site serves, into
// public/scriptures/*.json, and prints a QA report.
//
//   npm run build:scriptures -- ~/Downloads/bookofmormonacco00bookuoft/bookofmormonacco00bookuoft_djvu.txt
//
// Two sources, both public domain:
//   Old & New Testament — the King James Version, from aruljohn/Bible-kjv.
//   Book of Mormon      — the 1920 Salt Lake City edition, from an Internet
//                         Archive page scan supplied on the command line.
//
// The 1920 scan is OCR of a two-column setting, so most of the work here is
// separating scripture from page furniture (running heads, page numbers, date
// banners, and the cross-reference apparatus printed at the foot of each page)
// and then working out which verse each block of text belongs to.
//
// Verse placement is decided by comparing wording against the modern edition,
// which is used ONLY as a map of where verses belong — every word written out
// comes from the 1920 scan. Chapter and verse counts are then checked against
// src/data/verseCounts.js so drift is reported here rather than surfacing as a
// broken chapter in the reader.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSE_COUNTS } from "../src/data/verseCounts.js";
import { BOOK_INDEX } from "../src/data/bookIndex.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "..", "public/scriptures");

const BOM_BOOKS = ["1 Nephi","2 Nephi","Jacob","Enos","Jarom","Omni","Words of Mormon",
  "Mosiah","Alma","Helaman","3 Nephi","4 Nephi","Mormon","Ether","Moroni"];
const MISSING = "[not legible in the 1920 scan]";

// ---------------------------------------------------------------- helpers
const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.length || !B.length) return 0;
  const bag = new Map();
  for (const w of B) bag.set(w, (bag.get(w) || 0) + 1);
  let hit = 0;
  for (const w of A) if (bag.get(w)) { hit++; bag.set(w, bag.get(w) - 1); }
  return (2 * hit) / (A.length + B.length);
}

// ------------------------------------------------------- the 1920 scan
function isFurniture(line) {
  // A chapter heading also shouts in capitals, so it is exempted before the
  // shouty-line test below can eat it.
  if (/CHAPT/i.test(line)) return false;
  const s = line.trim();
  if (!s) return true;
  if (/^[0-9]{1,4}$/.test(s)) return true;                          // page number
  if (/^[0-9A-Z][A-Z0-9 .'’]*,\s*[0-9]+\.?$/.test(s)) return true;  // running head
  if (/\d\s*:\s*\d/.test(s)) return true;                           // reference apparatus
  if (/^[0-9a-zA-Z]{1,3}[,.]\s+(see\b|[0-9]?\s*[A-Z][a-z]{1,4}\.)/.test(s)) return true;
  if (/^see\s+[0-9a-z]{1,3},/.test(s)) return true;
  // Date banners, including badly scanned ones ("Bbtwibn B. 0. 000 ANO 6U2").
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = s.replace(/[^A-Z]/g, "").length;
  if (letters.length && upper / letters.length > 0.55 && /\d/.test(s) && s.length < 70) return true;
  if (/^(About|Between)\b/i.test(s) && /\d/.test(s) && s.length < 70) return true;
  if (/\b[AB]\.\s*[DC]\./i.test(s) && s.length < 70) return true;
  return false;
}

const isHeading = (s) =>
  /^CHAPT[A-Z0-9]{0,3}R?\s+[0-9]+\.?$/i.test(s) ||
  /^THE\s+(FIRST|SECOND|THIRD|FOURTH)?\s*BOOK\s+O[FP]/i.test(s) ||
  /^THE\s+WORDS\s+OF\s+MORMON/i.test(s) ||
  /^(THIRD|FOURTH)\s+NEPHI/i.test(s);

const tidy = (t) => t
  .replace(/[“”"'‘’*^|]+/g, "")   // superscript footnote letters became stray glyphs
  // The scan reads a lowercase i as a capital I mid-sentence ("go forth Into
  // the wilderness"). Only these five words are corrected, so proper nouns like
  // Israel, Isaiah and Ishmael are never touched.
  .replace(/([^.!?:;]\s+)(It|In|Is|If|Into)\b/g, (m, pre, w) => pre + w.toLowerCase())
  .replace(/\s+([,.;:!?])/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

function readScan(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const from = lines.findIndex((l) => /^\s*CHAPTER\s+1\.\s*$/.test(l));
  const to = lines.findIndex((l) => /^\s*PRONOUNCING\s+VOCABULARY/.test(l));
  if (from === -1) throw new Error("could not find the start of 1 Nephi in the scan");
  const body = lines.slice(from, to === -1 ? lines.length : to);

  const out = [];
  let cur = null;
  const close = () => { if (cur && cur.text.trim()) out.push(tidy(cur.text)); cur = null; };
  for (const line of body) {
    if (isFurniture(line)) continue;
    const s = line.trim().replace(/\s+/g, " ");
    // A heading closes the open verse; the chapter précis that follows it is
    // then discarded, because no verse is open to collect it.
    if (isHeading(s)) { close(); continue; }
    // Verse numbers are usually "12." but the scan sometimes reads "12,".
    const m = s.match(/^([0-9]{1,3})\s*[.,;:]\s+(.*)$/);
    if (m) { close(); cur = { text: m[2] }; continue; }
    if (!cur) continue;
    // A word split by the line break rejoins without a space.
    if (/-$/.test(cur.text)) cur.text = cur.text.replace(/-$/, "") + s;
    else cur.text += " " + s;
  }
  close();
  return out;
}

// Needleman–Wunsch: place scan blocks into the chapter's verse slots by wording.
function placeChapter(window, reference, gapPenalty = -0.35) {
  const m = window.length, n = reference.length;
  const score = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  const from = Array.from({ length: m + 1 }, () => new Int8Array(n + 1));
  for (let i = 1; i <= m; i++) { score[i][0] = score[i - 1][0] + gapPenalty; from[i][0] = 1; }
  for (let k = 1; k <= n; k++) { score[0][k] = score[0][k - 1] + gapPenalty; from[0][k] = 2; }
  for (let i = 1; i <= m; i++) for (let k = 1; k <= n; k++) {
    const diag = score[i - 1][k - 1] + similarity(window[i - 1], reference[k - 1]);
    const up = score[i - 1][k] + gapPenalty;
    const left = score[i][k - 1] + gapPenalty;
    if (diag >= up && diag >= left) { score[i][k] = diag; from[i][k] = 0; }
    else if (up >= left) { score[i][k] = up; from[i][k] = 1; }
    else { score[i][k] = left; from[i][k] = 2; }
  }
  const slots = new Array(n).fill(null);
  let i = m, k = n, consumed = 0;
  while (i > 0 || k > 0) {
    const step = i === 0 ? 2 : k === 0 ? 1 : from[i][k];
    if (step === 0) { slots[k - 1] = window[i - 1]; consumed = Math.max(consumed, i); i--; k--; }
    else if (step === 1) i--;
    else k--;
  }
  return { slots, consumed };
}

// ---------------------------------------------------------------- output
const chapterOf = (book, n, verses) => ({
  chapter: n,
  reference: `${book} ${n}`,
  verses: verses.map((text, i) => ({ verse: i + 1, reference: `${book} ${n}:${i + 1}`, text })),
});

function writeVolume(file, books) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, file), JSON.stringify({ books }));
  const chapters = books.reduce((a, b) => a + b.chapters.length, 0);
  const verses = books.reduce((a, b) => a + b.chapters.reduce((x, c) => x + c.verses.length, 0), 0);
  console.log(`  wrote ${file}: ${books.length} books, ${chapters} chapters, ${verses} verses`);
}

// ---------------------------------------------------------------- main
const scanPath = process.argv[2];
if (!scanPath) {
  console.error("usage: npm run build:scriptures -- <book-of-mormon-1920_djvu.txt>");
  process.exit(1);
}

console.log("King James Version (Old and New Testament)");
const ALIAS = { "Solomon's Song": "SongofSolomon" };
const KJV = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master";
const bibleNames = BOOK_INDEX.filter((b) => b.v === "ot" || b.v === "nt");

const fetched = [];
for (let i = 0; i < bibleNames.length; i += 8) {
  fetched.push(...await Promise.all(bibleNames.slice(i, i + 8).map(async (b) => {
    const file = (ALIAS[b.n] || b.n.replace(/\s+/g, "")) + ".json";
    const res = await fetch(`${KJV}/${file}`);
    if (!res.ok) throw new Error(`${b.n}: HTTP ${res.status} for ${file}`);
    return { ...b, data: await res.json() };
  })));
}

let bibleBad = 0;
const byVolume = { ot: [], nt: [] };
for (const b of fetched) {
  const want = VERSE_COUNTS[b.n];
  const chapters = b.data.chapters.map((ch, i) => {
    const verses = ch.verses.map((v) => v.text.replace(/\s+/g, " ").trim());
    if (want && want[i] !== verses.length) {
      bibleBad++;
      console.log(`  ! ${b.n} ${i + 1}: ${verses.length} verses, expected ${want[i]}`);
    }
    return chapterOf(b.n, i + 1, verses);
  });
  byVolume[b.v].push({ book: b.n, chapters });
}
console.log(`  verse-count mismatches: ${bibleBad}`);
writeVolume("old-testament.json", byVolume.ot);
writeVolume("new-testament.json", byVolume.nt);

console.log("\nBook of Mormon (1920 edition, page scan)");
const blocks = readScan(scanPath);
console.log(`  ${blocks.length} verse blocks recovered from the scan (canonical 6604)`);

// The modern edition supplies the map of where verses belong; none of its
// wording is written out.
const modern = await (await fetch("https://cdn.jsdelivr.net/gh/bcbooks/scriptures-json@master/book-of-mormon.json")).json();
const guide = {};
for (const b of modern.books) {
  guide[b.book] = {};
  for (const ch of b.chapters) guide[b.book][ch.chapter] = ch.verses.map((v) => v.text);
}

let cursor = 0, placed = 0, gaps = [];
const bomBooks = [];
for (const book of BOM_BOOKS) {
  const counts = VERSE_COUNTS[book];
  const chapters = [];
  for (let c = 1; c <= counts.length; c++) {
    const reference = guide[book][c];
    const window = blocks.slice(cursor, cursor + counts[c - 1] + 6);
    const { slots, consumed } = placeChapter(window, reference);
    cursor += consumed;
    slots.forEach((t, i) => { if (t) placed++; else gaps.push(`${book} ${c}:${i + 1}`); });
    chapters.push(chapterOf(book, c, slots.map((t) => t || MISSING)));
  }
  bomBooks.push({ book, chapters });
}

// How close is the placed wording to the modern edition? Differences are a mix
// of genuine 1920 readings and leftover OCR damage, so this is a health signal
// rather than a pass/fail.
let n = 0, sum = 0, low = 0;
for (const b of bomBooks) for (const ch of b.chapters) ch.verses.forEach((v, i) => {
  if (v.text === MISSING) return;
  const ref = guide[b.book][ch.chapter][i];
  if (!ref) return;
  const s = similarity(v.text, ref);
  n++; sum += s;
  if (s < 0.9) low++;
});
console.log(`  verses placed: ${placed}/6604, not legible: ${gaps.length}`);
console.log(`  mean wording agreement with the modern edition: ${(sum / n).toFixed(4)}`);
console.log(`  verses differing by more than 10%: ${low} (1920 readings and OCR damage mixed)`);
writeVolume("book-of-mormon.json", bomBooks);

writeFileSync(resolve(OUT_DIR, "gaps.json"), JSON.stringify({ note: "Verses the 1920 scan did not yield; each shows " + MISSING + " in the reader.", verses: gaps }, null, 1));
console.log(`  wrote gaps.json listing ${gaps.length} verses still to be keyed in by hand`);
