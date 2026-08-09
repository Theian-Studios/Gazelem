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
const PGP_BOOKS = ["Moses","Abraham","Joseph Smith\u2014Matthew","Joseph Smith\u2014History","Articles of Faith"];
const MISSING = "[not legible in the page scan]";
const NOT_IN_EDITION = "[not in this edition]";

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
function classify(line) {
  // Chapter and section headings also shout in capitals and carry a figure, so
  // they are exempted before the shouty-line test below can eat them. Letting
  // one through as furniture leaves the previous verse open, and the heading's
  // descriptive note then runs on to the end of it.
  if (/CHAPT/i.test(line) || /^\s*SECTION\b/i.test(line)) return null;
  const s = line.trim();
  if (!s) return "blank";
  if (/^[0-9]{1,4}$/.test(s)) return "head";                        // page number
  if (/^[0-9A-Z][A-Z0-9 .'’]*,\s*[0-9]+\.?$/.test(s)) return "head";  // running head
  // The Pearl of Great Price sets its running heads as "4 PEARL OF GREAT
  // PRICE." or "II.] WRITINGS OF JOSEPH SMITH. 9^"; the Doctrine and Covenants
  // as "SEC. I.] COMMANDMENTS. 77" — a bracket, then a shout, then a page.
  if (/PEARL\s+OF\s+GREAT\s+PRICE/i.test(s)) return "head";
  if (/^[IVXY]{1,5}\.?\]/.test(s)) return "head";
  // Either bracket: the head sits left or right depending on the page
  // ("SEC. I.] COMMANDMENTS. 77" against "84 COVENANTS AND [SEC. V.").
  if ((s.includes("]") || s.includes("[")) && s.length < 60) {
    const caps = s.replace(/[^A-Za-z]/g, "");
    if (caps.length && s.replace(/[^A-Z]/g, "").length / caps.length > 0.7) return "head";
  }
  if (/\d\s*:\s*\d/.test(s)) return "apparatus";                    // reference apparatus
  // Footnote keys are one or two lowercase characters ("z." or "2a,"). Allowing
  // three, or capitals, swallowed real scripture: "God, see that ye serve him".
  if (/^[0-9a-z]{1,2}[,.]\s+(see\b|[0-9]?\s*[A-Z][a-z]{1,4}\.)/.test(s)) return "apparatus";
  if (/^see\s+[0-9a-z]{1,2},/.test(s)) return "apparatus";
  // The Pearl of Great Price keys its footnotes to verses rather than to other
  // books: "w, compare verse 8. x, verse 3." — no chapter:verse pair to catch.
  if (/^[0-9a-z]{1,2}[,.]\s+(compare\s+)?verses?\b/i.test(s)) return "apparatus";
  if (/^(compare\s+)?verses?\s+\d/i.test(s)) return "apparatus";   // apparatus running on
  // A footnote label the scan read as punctuation: "/, Near the close of...".
  if (/^[^A-Za-z0-9\s]{1,2},\s+\S/.test(s)) return "apparatus";
  if ((s.match(/\bverses?\s+\d/gi) || []).length >= 2 && /^[0-9a-z]{1,2}[,.]/.test(s)) return "apparatus";
  // Date banners, including badly scanned ones ("Bbtwibn B. 0. 000 ANO 6U2").
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = s.replace(/[^A-Z]/g, "").length;
  if (letters.length && upper / letters.length > 0.55 && /\d/.test(s) && s.length < 70) return "head";
  if (/^(About|Between)\b/i.test(s) && /\d/.test(s) && s.length < 70) return "head";
  if (/\b[AB]\.\s*[DC]\./i.test(s) && s.length < 70) return "head";
  return null;
}

const isHeading = (s) =>
  // "CHAPTER 12." in the Book of Mormon; the Pearl of Great Price numbers its
  // chapters in roman, which the scan mangles ("CHAPTER YII.", "CHAPTER y.").
  /^CHAPT[A-Z0-9]{0,3}R?\s+([0-9]+|[IVXYL]{1,6})\.?[^a-z]*$/i.test(s) ||
  /^THE\s+(FIRST|SECOND|THIRD|FOURTH)?\s*BOOK\s+O[FP]/i.test(s) ||
  /^THE\s+WORDS\s+OF\s+MORMON/i.test(s) ||
  /^(THIRD|FOURTH)\s+NEPHI/i.test(s) ||
  /^WRITINGS\s+OF\s+JOSEPH\s+SMITH/i.test(s) ||
  /^THE\s+ARTICLES\s+O[FP]\s+[EF]AITH/i.test(s) ||
  // "SECTION 42." and "SECTION I." — the Doctrine and Covenants mixes arabic
  // and roman in the same printing.
  /^SECTION\s+([0-9]+|[IVXLC]+)\.?[^a-z]*$/i.test(s);

// Misreadings frequent enough to be worth correcting and unambiguous enough to
// be safe: each is a word that does not otherwise occur in scripture. Anything
// open to interpretation is left exactly as the scan has it.
const MISREADINGS = new Map(Object.entries({
  NephI: "Nephi", LamanItes: "Lamanites", Lamanltes: "Lamanites",
  Jesns: "Jesus", Ood: "God", Gk: "God", Grod: "God",
  tbe: "the", tlie: "the", tho: "the", aud: "and", aiid: "and",

  // Letters the scan confuses in one word only. Each was found by listing every
  // token in the finished text carrying an OCR signature — a capital inside a
  // word, a figure fused to letters — and keeping those whose reading is not in
  // question. Ordinals ("11th", "52nd") carry the same signature and are real,
  // so nothing here is derived from the shape alone.
  flUed: "filled", bodIes: "bodies", boW: "bow", doWn: "down", smaU: "small",
  swaUowed: "swallowed", behoM: "behold", whicA: "which", whItJh: "which",
  tJhe: "the", thJe: "the", cTannot: "cannot", inBomuch: "insomuch",
  aflBictions: "afflictions", justlfletB: "justifieth", temptAtlon: "temptation",
  sufCerIng: "suffering", coD8istlng: "consisting", engrayingB: "engravings",
  dlBsensions: "dissensions", increasB: "increase", envyIngs: "envyings",
  deBtruction: "destruction", decFared: "declared", difUcuIt: "difficult",
  eplBtle: "epistle", provislonR: "provisions", unquencJhable: "unquenchable",
  stuSied: "studied", thBft: "theft", IncluHlve: "inclusive",
  judgmLcnts: "judgments", suflSce: "suffice", suflScient: "sufficient",
  chain8: "chains", record8: "records", l3st: "last", U8: "us", An4: "And",
  m7: "my", sa5dng: "saying", wTitten: "written", "2ofFend": "offend",
  // Names, on the same terms.
  MantI: "Manti", AbinadI: "Abinadi", AmuIon: "Amulon", CumenI: "Cumeni",
  MoToni: "Moroni", AmalekItes: "Amalekites", AmulonItes: "Amulonites",
  GospeP: "Gospel",
  // Words the scan ran together. Split only where the join is between two
  // whole words and the reading is not in question.
  theLamanites: "the Lamanites", theNephites: "the Nephites",
  NowAmmon: "Now Ammon", wereMulek: "were Mulek", NewYork: "New York",
  OliverCowdery: "Oliver Cowdery", AndafterI: "And after I",
  andalsoZarahemla: "and also Zarahemla", yehavedonegreater: "ye have done greater",
}));

// Book names as the running head prints them. A head that the column-splitter
// let through lands in the middle of a sentence — "knew that God ENOS. could
// not lie" — and is the one kind of stray capital run that can be taken out on
// sight, since it is not a word of scripture in any edition.
const RUNNING_HEADS = new RegExp(
  String.raw`\s\b(?:` +
  ["NEPHI","JACOB","ENOS","JAROM","OMNI","MORMON","MOSIAH","ALMA","HELAMAN",
   "ETHER","MORONI","MOSES","ABRAHAM","GENESIS","MATTHEW","THE BOOK OF"].join("|") +
  String.raw`)\.(?=\s)`, "g");

const tidy = (t) => t
  .replace(/[“”"'‘’*^|■□•«»]+/g, "")   // superscript footnote letters became stray glyphs
  // A running head the column-splitter let through, mid-sentence.
  .replace(RUNNING_HEADS, "")
  // A word broken across a line keeps its hyphen when the halves are rejoined
  // the other way round, leaving it hanging off the front: "my -firstborn".
  .replace(/(^|\s)-(?=[a-z])/g, "$1")
  // The scan reads a lowercase letter as a capital mid-sentence ("go forth
  // Into the wilderness", "Thou Shalt construct"). Only these words are
  // lowered, so proper nouns like Israel, Isaiah and Ishmael are untouched.
  .replace(/([^.!?:;]\s+)(It|In|Is|If|Into|Shalt|Unto|Shall)\b/g, (m, pre, w) => pre + w.toLowerCase())
  // A bare zero is always a capital O misread ("Hearken, 0 ye people").
  .replace(/\b0\b/g, "O")
  // The Doctrine and Covenants prints its footnote keys as small letters and
  // figures set tight against the following word, and the scan fuses them on:
  // "unto 6all men". A digit never legitimately opens a word here, so those
  // come off; single letters are left alone, since stripping them would be
  // guesswork ("amy church" is indistinguishable from a real word).
  .replace(/\b\d([a-z]{2,})\b/g, "$1")
  // Tokens are matched with their figures, so a misreading that fused one on
  // ("U8", "l3st") is looked up whole rather than as its letters alone.
  .replace(/[A-Za-z0-9]+/g, (w) => MISREADINGS.get(w) ?? w)
  // Only the marks that really do follow a word without a space. A ! or ? left
  // standing alone is the scan's reading of a letter — "But •! will put" is
  // "But I will put" — and tucking it up against the word before makes a
  // sentence of it that the page does not have.
  .replace(/\s+([,.;:])/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

// ---- Footnote keys fused to the word after them ---------------------------
//
// The printings key their footnotes with small letters and figures set tight
// against the word they mark, and the scan fuses them on: "called him
// 26Michael", "and to 2Aordain", "in dZion". By shape alone these cannot be
// separated — "26Michael" is a key and a name, "2Mheavenly" is a key ending in
// a capital and a plain word, and "11th" is neither. What tells them apart is
// whether what would be left is a word at all.
//
// So the edition being used as the map of where verses belong is asked one
// further question: is this a word scripture uses? Its answer decides whether a
// prefix comes off. None of its wording is written out here either — a word is
// only ever removed from the scan's own text, never replaced by the modern
// one — and where the answer is no, the token stands exactly as scanned.
let VOCAB = null;

const learnVocabulary = (texts) => {
  VOCAB = new Set();
  for (const t of texts) for (const w of t.toLowerCase().match(/[a-z]+/g) || []) VOCAB.add(w);
};

const unfuse = (text) => {
  if (!VOCAB) return text;
  return text.replace(/\b[0-9A-Za-z]{3,}\b/g, (token) => {
    // Only tokens that carry a key's signature: opening with a figure, or a
    // lowercase letter standing in front of a capitalised word.
    // An ordinal opens with a figure and is a word of the text — "the 19th day",
    // "the 52nd section" — so it is never a key.
    if (/^\d{1,4}(?:st|nd|rd|th)$/i.test(token)) return token;
    const keyed = /^\d/.test(token) || /^[a-z][A-Z]/.test(token) || /^w[T7][a-z]/.test(token);
    if (!keyed || VOCAB.has(token.toLowerCase())) return token;
    // The scan doubles a capital W into "wT" — "Trifle not wTith sacred
    // things". Taken here rather than by shape, so a "wTitten" that has also
    // lost a letter is left visibly wrong instead of quietly made into a word
    // the page does not have.
    if (/^w[T7]/.test(token)) {
      const w = "w" + token.slice(2);
      return VOCAB.has(w.toLowerCase()) ? w : token;
    }
    // Shortest prefix that leaves a word behind, so "26Michael" gives up "26"
    // rather than "26M", and "2Mheavenly" gives up the "2M" it has to.
    for (let cut = 1; cut <= 3 && cut < token.length - 1; cut++) {
      const rest = token.slice(cut);
      if (/^[A-Za-z]{3,}$/.test(rest) && VOCAB.has(rest.toLowerCase())) return rest;
    }
    return token;
  });
};

// ---- Apparatus that landed inside a sentence -------------------------------
//
// The cross references are printed at the foot of each page in a dense block of
// abbreviations, and where a line of it shares a line with prose the splitter
// carries it into the verse: "that ye may learn of me 2k, aei a, 1 Ne. 2. Chap.
// 88: a. we, 2 No. 1 ... that there is no other way". The reader is left with a
// paragraph of gibberish in the middle of a sentence.
//
// A run is only taken out when doing so can be shown to be right: the verse is
// scored against the edition used as the map, with the run and without it, and
// the run goes only if its absence brings the verse materially closer to the
// text it is supposed to be. That is a measurement, not a judgement about what
// the words ought to say — and it cannot quietly delete scripture, because
// deleting scripture moves the score the other way.
const FURNITURE = (t) => {
  const s = t.replace(/^[^\w]+|[^\w]+$/g, "");
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;                              // a bare figure
  if (/^\d+[:.\-]\d*$/.test(s)) return true;                     // 10:6, 88:
  if (/^[A-Za-z]{1,3}$/.test(s)) return true;                    // a, d, ft, see-variants
  if (/^\d{0,2}[A-Za-z]{1,2}\d{0,2}$/.test(s)) return true;      // 2k, A1, 4n
  if (/[^\x20-\x7E]/.test(t)) return true;                       // the scan's own marks
  if (/^(?:vers?|chap|see|sec|sea|lee|ice|noe|tee|aee|nee|bee|soo|mo|wo|we|me)\.?$/i.test(s)) return true;
  if (/^(?:\d\s*)?[A-Z][a-z]{0,4}$/.test(s) && /[.,]$/.test(t)) return true;  // Ne. Al. Morm.
  return false;
};

function stripApparatus(text, reference) {
  if (!reference) return text;
  const w = text.split(/\s+/);
  let best = text, bestScore = similarity(text, reference);
  for (let i = 0; i < w.length; i++) {
    if (!FURNITURE(w[i])) continue;
    let j = i;
    while (j < w.length && FURNITURE(w[j])) j++;
    // Short words of the text look like apparatus by shape — "of", "me", "we" —
    // and a run that begins or ends on one would carry it off with the noise
    // ("ye may learn of me ⟦…⟧" losing its "of me"). Inside the run they are
    // left be, since the apparatus is full of the same two letters; at its
    // edges the run gives them back.
    let a = i, b = j;
    const real = (t) => VOCAB?.has(t.replace(/[^A-Za-z]/g, "").toLowerCase());
    while (a < b && real(w[a])) a++;
    while (b > a && real(w[b - 1])) b--;
    // A run must end inside the verse — prose after it is what says the
    // sentence was interrupted rather than that the verse ends in a reference.
    if (b - a >= 4 && b < w.length) {
      const without = [...w.slice(0, a), ...w.slice(b)].join(" ");
      const score = similarity(without, reference);
      if (score > bestScore + 0.02) { best = without; bestScore = score; }
    }
    i = j;
  }
  return best === text ? text : stripApparatus(best, reference);
}

function readScan(path, startRe, endRe) {
  const lines = readFileSync(path, "utf8").split("\n");
  const from = lines.findIndex((l) => startRe.test(l));
  const to = lines.findIndex((l, i) => i > from && endRe.test(l));
  if (from === -1) throw new Error(`could not find the start of the text in ${path}`);
  const body = lines.slice(from, to === -1 ? lines.length : to);

  const out = [];
  let cur = null;
  // A footnote can run to a second line of ordinary prose ("e, Indians, / among
  // whom there is a mixture of the Nephites"), which is indistinguishable from
  // verse text on its own. So once a footnote block starts, everything is
  // skipped until the page turns — a running head or page number — or a verse
  // or heading begins. Verse text that resumes after the page break is still
  // collected, which is how a verse split across two pages stays whole.
  let inApparatus = false;
  const close = () => { if (cur && cur.text.trim()) out.push(tidy(cur.text)); cur = null; };
  for (const line of body) {
    const kind = classify(line);
    if (kind === "apparatus") { inApparatus = true; continue; }
    if (kind === "head") { inApparatus = false; continue; }
    if (kind === "blank") continue;
    const s = line.trim().replace(/\s+/g, " ");
    // A heading closes the open verse; the chapter précis that follows it is
    // then discarded, because no verse is open to collect it.
    if (isHeading(s)) { close(); inApparatus = false; continue; }
    // Verse numbers are usually "12." but the scan sometimes reads "12,".
    const m = s.match(/^([0-9]{1,3})\s*[.,;:]\s+(.*)$/);
    if (m) { close(); cur = { text: m[2] }; inApparatus = false; continue; }
    if (inApparatus || !cur) continue;
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
  verses: verses.map((text, i) => ({ verse: i + 1, reference: `${book} ${n}:${i + 1}`, text: unfuse(text) })),
});

function writeVolume(file, books) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, file), JSON.stringify({ books }));
  const chapters = books.reduce((a, b) => a + b.chapters.length, 0);
  const verses = books.reduce((a, b) => a + b.chapters.reduce((x, c) => x + c.verses.length, 0), 0);
  console.log(`  wrote ${file}: ${books.length} books, ${chapters} chapters, ${verses} verses`);
}

// Builds one volume from a page scan: pull the verse blocks out, then place
// them into the canonical chapters by wording.
async function buildFromScan({ label, path, startRe, endRe, books, guideFile, outFile }) {
  console.log(`\n${label}`);
  const blocks = readScan(path, startRe, endRe);
  const expected = books.reduce((a, b) => a + VERSE_COUNTS[b].reduce((x, y) => x + y, 0), 0);
  console.log(`  ${blocks.length} verse blocks recovered from the scan (canonical ${expected})`);

  // The modern edition supplies the map of where verses belong; none of its
  // wording is written out.
  const modern = await (await fetch(`https://cdn.jsdelivr.net/gh/bcbooks/scriptures-json@master/${guideFile}`)).json();
  const guide = {};
  for (const b of modern.books) {
    guide[b.book] = {};
    for (const ch of b.chapters) guide[b.book][ch.chapter] = ch.verses.map((v) => v.text);
  }
  learnVocabulary(Object.values(guide).flatMap((ch) => Object.values(ch).flat()));

  let cursor = 0, placed = 0;
  const gaps = [];
  const built = [];
  for (const book of books) {
    const counts = VERSE_COUNTS[book];
    const chapters = [];
    for (let c = 1; c <= counts.length; c++) {
      const reference = guide[book][c];
      const window = blocks.slice(cursor, cursor + counts[c - 1] + 6);
      const { slots, consumed } = placeChapter(window, reference);
      cursor += consumed;
      slots.forEach((t, i) => { if (t) placed++; else gaps.push(`${book} ${c}:${i + 1}`); });
      const cleaned = slots.map((t, i) => (t ? stripApparatus(t, reference[i]) : t));
      chapters.push(chapterOf(book, c, cleaned.map((t) => t || MISSING)));
    }
    built.push({ book, chapters });
  }

  // How close is the placed wording to the modern edition? Differences mix
  // genuine older readings with leftover OCR damage, so this is a health
  // signal rather than a pass/fail.
  let n = 0, sum = 0, low = 0;
  for (const b of built) for (const ch of b.chapters) ch.verses.forEach((v, i) => {
    if (v.text === MISSING) return;
    const ref = guide[b.book][ch.chapter][i];
    if (!ref) return;
    const s = similarity(v.text, ref); n++; sum += s;
    if (s < 0.9) low++;
  });
  console.log(`  verses placed: ${placed}/${expected}, not legible: ${gaps.length}`);
  console.log(`  mean wording agreement with the modern edition: ${(sum / n).toFixed(4)}`);
  console.log(`  verses differing by more than 10%: ${low} (older readings and OCR damage mixed)`);
  writeVolume(outFile, built);
  return gaps;
}

// The Doctrine and Covenants is numbered by section rather than book and
// chapter, and it ships in a different shape, so it gets its own pass. Sections
// 137 and 138 were only added to the book in 1979 and are genuinely absent from
// any pre-1929 printing; they are labelled as such rather than as damage.
async function buildSections({ label, path, startRe, endRe, outFile }) {
  console.log(`\n${label}`);
  const blocks = readScan(path, startRe, endRe);
  const counts = VERSE_COUNTS["Doctrine and Covenants"];
  const expected = counts.reduce((a, b) => a + b, 0);
  console.log(`  ${blocks.length} verse blocks recovered from the scan (canonical ${expected})`);

  const modern = await (await fetch("https://cdn.jsdelivr.net/gh/bcbooks/scriptures-json@master/doctrine-and-covenants.json")).json();
  const guide = {};
  for (const s of modern.sections) guide[s.section] = s.verses.map((v) => v.text);
  learnVocabulary(Object.values(guide).flat());

  let cursor = 0, placed = 0;
  const gaps = [], absent = [];
  const sections = [];
  for (let n = 1; n <= counts.length; n++) {
    const reference = guide[n];
    const window = blocks.slice(cursor, cursor + counts[n - 1] + 6);
    const { slots, consumed } = placeChapter(window, reference);
    cursor += consumed;
    // A section the scan yielded nothing at all for is one this edition does
    // not contain, not one the OCR failed on.
    const empty = slots.every((t) => !t);
    slots.forEach((t, i) => {
      if (t) placed++;
      else if (empty) absent.push(`D&C ${n}:${i + 1}`);
      else gaps.push(`D&C ${n}:${i + 1}`);
    });
    sections.push({
      section: n,
      reference: `D&C ${n}`,
      verses: slots.map((t, i) => ({ verse: i + 1, reference: `D&C ${n}:${i + 1}`, text: t ? unfuse(stripApparatus(t, reference?.[i])) : (empty ? NOT_IN_EDITION : MISSING) })),
    });
  }

  let m = 0, sum = 0, low = 0;
  for (const s of sections) s.verses.forEach((v, i) => {
    if (v.text === MISSING || v.text === NOT_IN_EDITION) return;
    const ref = guide[s.section][i];
    if (!ref) return;
    const sc = similarity(v.text, ref); m++; sum += sc;
    if (sc < 0.9) low++;
  });
  const missingSections = [...new Set(absent.map((a) => a.split(":")[0]))];
  console.log(`  verses placed: ${placed}/${expected}, not legible: ${gaps.length}`);
  console.log(`  sections absent from this edition: ${missingSections.join(", ") || "none"} (${absent.length} verses)`);
  console.log(`  mean wording agreement with the modern edition: ${(sum / m).toFixed(4)}`);
  console.log(`  verses differing by more than 10%: ${low} (older readings and OCR damage mixed)`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, outFile), JSON.stringify({ title: modern.title, subtitle: modern.subtitle, sections }));
  console.log(`  wrote ${outFile}: ${sections.length} sections, ${sections.reduce((a, s) => a + s.verses.length, 0)} verses`);
  return gaps;
}

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const bomPath = flag("--bom") ?? (args[0] && !args[0].startsWith("--") ? args[0] : null);
const pgpPath = flag("--pgp");
const dcPath = flag("--dc");
if (!bomPath) {
  console.error("usage: npm run build:scriptures -- --bom <bom_djvu.txt> [--pgp <pgp_djvu.txt>] [--dc <dc_djvu.txt>]");
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

const gaps = [];
gaps.push(...await buildFromScan({
  label: "Book of Mormon (1920 edition, page scan)",
  path: bomPath,
  startRe: /^\s*CHAPTER\s+1\.\s*$/,
  endRe: /^\s*PRONOUNCING\s+VOCABULARY/,
  books: BOM_BOOKS,
  guideFile: "book-of-mormon.json",
  outFile: "book-of-mormon.json",
}));

if (pgpPath) {
  gaps.push(...await buildFromScan({
    label: "Pearl of Great Price (1902 versification, page scan)",
    path: pgpPath,
    startRe: /^\s*THE\s+BOOK\s+OF\s+MOSES\.\s*$/,
    endRe: /^\s*(GAYLORD|PRINTED\s+IN\s+U\.?S\.?A)/i,
    books: PGP_BOOKS,
    guideFile: "pearl-of-great-price.json",
    outFile: "pearl-of-great-price.json",
  }));
}

if (dcPath) {
  gaps.push(...await buildSections({
    label: "Doctrine and Covenants (Orson Pratt versification, page scan)",
    path: dcPath,
    startRe: /^\s*SECTION\s+(I|1)\.\s*$/i,
    endRe: /^\s*(INDEX|CONCORDANCE)\b/i,
    outFile: "doctrine-and-covenants.json",
  }));
}

writeFileSync(resolve(OUT_DIR, "gaps.json"), JSON.stringify({ note: "Verses the page scans did not yield; each shows " + MISSING + " in the reader.", verses: gaps }, null, 1));
console.log(`\nwrote gaps.json listing ${gaps.length} verses still to be keyed in by hand`);
