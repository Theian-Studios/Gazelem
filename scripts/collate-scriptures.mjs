// Compares the site's text of the three scanned volumes with other scans of the
// same printings, and settles the readings they agree on.
//
//   npm run collate:scriptures
//
// The site's text of each volume comes from one page scan, and one scan's OCR
// is wrong wherever that copy was smudged or that engine guessed badly: a verse
// it could not read at all, "multitu" for multitude, "tidings" for things. The
// Internet Archive holds other copies of the same printings, scanned from other
// libraries' books by other engines, and they are wrong in other places. Where
// independent scans agree against the site's reading, the site's scan is the one
// that erred — and the reading they agree on is still the old printing's own
// words, never the modern edition's.
//
// The scans are downloaded once into scripts/.witnesses (not committed). What
// comes out is scripts/data/witness-readings.json, which proofread-scriptures.mjs
// applies on every run, so a rebuild keeps them. The modern edition plays the
// part it plays everywhere else: a map of where each verse is, and a check that
// a correction moves toward sense rather than away from it — never a source.
//
// Each verse is found in each scan by the words it shares with the site's text,
// snapped to the verse numbers that scan printed. Then, word by word:
//
//   - a word is replaced only when at least two scans, and three in five of those
//     that have the verse, agree on another word, and what they agree on is a
//     word of scripture;
//   - a word is removed only if it is not a word (a stray footnote letter, a
//     figure, a mark), or nearly every scan lacks it and the verse reads better;
//   - a word is added only if it is one to three words every agreeing scan has
//     and the verse reads better for it — a clause is the neighbouring verse;
//   - punctuation is changed where three or more scans agree, a capital only
//     toward the modern text's own, and an apostrophe is never taken away
//     (the build's cleaning strips them from every scan alike);
//   - a verse the site marks illegible is filled only from two or more scans
//     that agree with each other.
//
// What every printed copy shares — footnote keys, headings, the apparatus —
// every scan agrees on, so agreement alone cannot tell it from the text. That is
// why an addition has to read better and a removal has to be a non-word.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, tidy, isHeading } from "./build-scriptures.mjs";
import {
  proofreadScriptures, proofVerse, tokenContext, fetchGuides, versesByRef,
  WITNESS_READINGS, MISSING, ABSENT,
} from "./proofread-scriptures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPTURES = resolve(here, "..", "public/scriptures");
const CACHE = resolve(here, ".witnesses");
const ENGLISH = "/usr/share/dict/words";

// The scans compared, by Internet Archive identifier. Each is a copy of the
// printing the site's text was built from, or a reprint of the same setting of
// the text; `source` is the scan the site's text already comes from, which
// cannot vote against itself.
const VOLUMES = {
  "book-of-mormon": {
    source: "bookofmormonacco00bookuoft",
    // The 1920 edition, in 1920 and 1921 printings, from ten libraries.
    witnesses: [
      "bookofmormonacco00smitrich", "bookofmormonacco00insmit", "bookofmormonacco00smituoft",
      "bookofmormonanac003280mbp", "bookofmormontheh002804mbp", "in.ernet.dli.2015.89211",
      "bookofmormon0000jose_a6j3", "bookofmormon0000vari_o1r3", "bookofmormon0000vari_n8t7",
      "bwb_Y0-DCJ-356", "isbn_9780526640904",
    ],
  },
  "pearl-of-great-price": {
    source: "pearlofgreatpric00smit",
    // The 1902 text (1907, 1917 and 1920 printings), and the 1888 and 1891
    // printings of the 1878 text, which print the same words without verse
    // numbers.
    witnesses: [
      "pearlofgreatpric00smitrich", "thepearlofgreatp00smituoft", "pearlgreatprice00unkngoog",
      "pearlgreatprice03smitgoog", "pearlofgreatpric0000unse_o7d6",
    ],
  },
  "doctrine-and-covenants": {
    source: "doctrinecovenan00smit",
    // Orson Pratt's 1879 text, printed from 1880 to 1908. The 1921 edition
    // (doctrinecovenant0000jose_n3n7) reset the text and does not vote.
    witnesses: [
      "doctenant00prat", "doctrineandcove00pratgoog", "doctrinecovenant0000vari_c2z1",
      "doctrinecovenant0000unse_s5q4", "doctrinecovenant0000jose_r5b4", "doctrinecovenantsmit",
      "doctrinecovenant0000jose_l4s7", "doctrineandcove00saingoog", "doctrinecovenant0000unse_a7t3",
      "thedoctrineandco00smituoft",
    ],
  },
};

const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const keyOf = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const lettersOf = (t) => t.replace(/[^A-Za-z]/g, "");
const wordsOf = (t) => t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
const tokKeys = (toks) => toks.map((t) => keyOf(t) || "#" + t);
function sim(a, b) {
  const A = wordsOf(a), B = wordsOf(b);
  if (!A.length || !B.length) return 0;
  const m = new Map(); for (const w of B) m.set(w, (m.get(w) || 0) + 1);
  let h = 0; for (const w of A) if (m.get(w)) { h++; m.set(w, m.get(w) - 1); }
  return (2 * h) / (A.length + B.length);
}
function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(["=", i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", i, -1]); i++; }
    else { ops.push(["+", -1, j]); j++; }
  }
  while (i < n) ops.push(["-", i++, -1]);
  while (j < m) ops.push(["+", -1, j++]);
  return ops;
}
const orderedVerses = (doc) => [...versesByRef(doc)].map(([ref, v]) => ({ ref, v }));
const PUNCT = /^[.,;:!?—–-]+$/;
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------- the scans
async function download(id) {
  const path = resolve(CACHE, id + ".txt");
  if (existsSync(path)) return path;
  const meta = await (await fetch(`https://archive.org/metadata/${id}/files`)).json();
  const file = (meta.result || []).find((f) => /_djvu\.txt$/.test(f.name));
  if (!file) throw new Error(`${id}: no OCR text on the Internet Archive`);
  const res = await fetch(`https://archive.org/download/${id}/${encodeURIComponent(file.name)}`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path, await res.text());
  return path;
}

// A scan as one stream of words, read line by line exactly as the build reads
// its own, with the verse numbers it printed kept as boundaries.
function streamOf(path) {
  const toks = [], starts = new Set();
  let inApparatus = false, markNext = false;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const kind = classify(line);
    if (kind === "apparatus") { inApparatus = true; continue; }
    if (kind === "head") { inApparatus = false; continue; }
    if (kind === "blank") continue;
    let s = line.trim().replace(/\s+/g, " ");
    if (isHeading(s)) { inApparatus = false; markNext = true; continue; }
    const m = s.match(/^([0-9]{1,3})\s*[.,;:]\s+(.*)$/);
    if (m) { inApparatus = false; s = m[2]; markNext = true; }
    else if (inApparatus) continue;
    const parts = tidy(s).split(" ").filter(Boolean);
    if (toks.length && /[a-z]-$/.test(toks[toks.length - 1]) && parts.length && /^[a-z]/.test(parts[0]) && !markNext)
      toks[toks.length - 1] = toks[toks.length - 1].slice(0, -1) + parts.shift();
    for (const p of parts) {
      if (markNext && keyOf(p).length >= 1) { starts.add(toks.length); markNext = false; }
      toks.push(p);
    }
  }
  const keys = toks.map(keyOf);
  const content = [], boundaries = new Set();
  keys.forEach((k, i) => {
    if (k.length >= 2 || starts.has(i)) { if (starts.has(i)) boundaries.add(content.length); content.push(i); }
  });
  return { toks, keys, content, boundaries };
}

// Each verse of the site's text, as this scan reads it.
function readingsFor({ toks, keys, content, boundaries }, verses, modern) {
  const numbered = boundaries.size > 100;
  const C = content.length;
  const out = new Map();
  let ptr = 0;
  verses.forEach(({ ref, v }, vi) => {
    if (v.text === ABSENT) return;
    const query = v.text === MISSING ? modern.get(ref) : v.text;
    if (!query) return;
    const Q = query.split(/\s+/).map(keyOf).filter((k) => k.length >= 2);
    if (Q.length < 3) return;
    const qCount = new Map(); for (const k of Q) qCount.set(k, (qCount.get(k) || 0) + 1);
    const L = Q.length;
    const best = (lo, hi) => {
      lo = Math.max(0, lo); hi = Math.min(C - L, hi);
      if (hi < lo) return null;
      const w = new Map(); let overlap = 0;
      const add = (k) => { const c = w.get(k) || 0; if (c < (qCount.get(k) || 0)) overlap++; w.set(k, c + 1); };
      const del = (k) => { const c = w.get(k); w.set(k, c - 1); if (c - 1 < (qCount.get(k) || 0)) overlap--; };
      for (let i = lo; i < lo + L; i++) add(keys[content[i]]);
      let bi = lo, bo = overlap;
      for (let i = lo + 1; i <= hi; i++) { del(keys[content[i - 1]]); add(keys[content[i + L - 1]]); if (overlap > bo) { bo = overlap; bi = i; } }
      return { at: bi, score: bo / L };
    };
    let hit = best(ptr - 60, ptr + Math.max(4000, 30 * L));
    if (!hit || hit.score < 0.55) {
      const est = Math.round((vi / verses.length) * C);
      const wide = best(est - 40000, est + 40000);
      if (wide && wide.score >= 0.7) hit = wide; else if (!hit || hit.score < 0.55) return;
    }
    const a = Math.max(0, hit.at - 12), b = Math.min(C, hit.at + L + 12);
    const ops = lcs(Q, content.slice(a, b).map((i) => keys[i]));
    const matched = ops.filter((o) => o[0] === "=").map((o) => ({ q: o[1], c: a + o[2] }));
    if (matched.length < Math.max(3, 0.5 * L)) return;
    // A match standing apart at either edge is a common word of the next or
    // previous verse ("And"), not this verse's first or last word.
    while (matched.length > 3 && matched[1].c - matched[0].c > matched[1].q - matched[0].q + 3) matched.shift();
    while (matched.length > 3) { const n = matched.length; if (matched[n - 1].c - matched[n - 2].c > matched[n - 1].q - matched[n - 2].q + 3) matched.pop(); else break; }
    // Nor across a verse number the scan printed: past it is a heading or a neighbour.
    for (let bnd = matched[1].c; bnd > matched[0].c; bnd--) if (boundaries.has(bnd)) { matched.shift(); break; }
    { const n = matched.length; for (let bnd = matched[n - 1].c; bnd > matched[n - 2].c; bnd--) if (boundaries.has(bnd)) { matched.pop(); break; } }
    let startC = matched[0].c, endC = matched[matched.length - 1].c;
    const firstQ = matched[0].q, lastQ = matched[matched.length - 1].q;
    let snapped = null, next = null;
    if (numbered) {
      for (let d = 0; d <= 4 && snapped === null; d++) {
        if (boundaries.has(startC - d)) snapped = startC - d;
        else if (d && d <= 2 && boundaries.has(startC + d) && firstQ + d <= 3) snapped = startC + d;
      }
      for (let d = 1; d <= 6 && next === null; d++) if (boundaries.has(endC + d)) next = endC + d;
    }
    startC = snapped ?? Math.max(a, startC - Math.min(firstQ, 2));
    endC = next !== null ? next - 1 : Math.min(b - 1, endC + Math.min(L - 1 - lastQ, 2));
    if (endC < startC) return;
    out.set(ref, toks.slice(content[startC], content[endC] + 1).join(" "));
    ptr = endC + 1;
  });
  return out;
}

// ---------------------------------------------------------------- the vote
function collate(baseText, readings, modernText, isWord) {
  const B = baseText.split(/\s+/).filter(Boolean);
  const G = (modernText || "").split(/\s+/).filter(Boolean);
  const bk = tokKeys(B), gk = tokKeys(G);
  const n = readings.length;
  const need = (c) => c >= 2 && c >= Math.ceil(n * 0.6);
  const sub = B.map(() => new Map()), agree = B.map(() => 0), missing = B.map(() => 0), forms = B.map(() => new Map());
  const merge = B.map(() => new Map());
  const ins = Array.from({ length: B.length + 1 }, () => new Map());
  for (const r of readings) {
    const W = r.split(/\s+/).filter(Boolean);
    let h = { b: [], w: [] }, lastB = -1;
    const flush = () => {
      if (h.b.length === 2 && h.w.length === 1) { const f = W[h.w[0]]; const key = keyOf(f) || "#" + f; merge[h.b[0]].set(key, [(merge[h.b[0]].get(key)?.[0] || 0) + 1, f]); }
      else if (h.b.length && h.w.length && h.b.length === h.w.length) h.b.forEach((bi, k) => { const f = W[h.w[k]]; const key = keyOf(f) || "#" + f; sub[bi].set(key, [(sub[bi].get(key)?.[0] || 0) + 1, f]); });
      else if (h.b.length && !h.w.length) h.b.forEach((bi) => missing[bi]++);
      else if (!h.b.length && h.w.length) { const seq = h.w.map((k) => W[k]); const key = tokKeys(seq).join(" "); ins[lastB + 1].set(key, [(ins[lastB + 1].get(key)?.[0] || 0) + 1, seq.join(" ")]); }
      h = { b: [], w: [] };
    };
    for (const [o, i, j] of lcs(bk, tokKeys(W))) {
      if (o === "=") { flush(); agree[i]++; forms[i].set(W[j], (forms[i].get(W[j]) || 0) + 1); lastB = i; continue; }
      if (i >= 0) h.b.push(i);
      if (j >= 0) h.w.push(j);
    }
    flush();
  }

  const cands = [];
  for (let i = 0; i <= B.length; i++) {
    const insBest = [...ins[i].values()].sort((x, y) => y[0] - x[0])[0];
    if (insBest && need(insBest[0])) cands.push({ kind: "insert", at: i, to: insBest[1], votes: insBest[0] });
    if (i === B.length) break;
    const mergeBest = i + 1 < B.length ? [...merge[i].values()].sort((x, y) => y[0] - x[0])[0] : null;
    if (mergeBest && need(mergeBest[0]) && agree[i] <= 1 && agree[i + 1] <= 1) { cands.push({ kind: "merge", i, from: B[i] + " " + B[i + 1], to: mergeBest[1], votes: mergeBest[0] }); i++; continue; }
    const subBest = [...sub[i].values()].sort((x, y) => y[0] - x[0])[0];
    if (subBest && need(subBest[0]) && agree[i] <= 1) { cands.push({ kind: "substitute", i, from: B[i], to: subBest[1], votes: subBest[0] }); continue; }
    // No reading has a majority, but the scans' disagreements are all garbles of
    // one word — "resve", "reveive", "reteive" — and only one of them is a word
    // at all. Two scans reading that word outright are enough.
    if (agree[i] <= 1 && !isWord(B[i])) {
      const words = [...sub[i].values()].filter(([c, f]) => c >= 2 && isWord(f));
      const anyOtherWord = [...sub[i].values()].some(([c, f]) => c < 2 && isWord(f) && keyOf(f) !== keyOf(words[0]?.[1] || ""));
      if (words.length === 1 && !anyOtherWord) { cands.push({ kind: "substitute", i, from: B[i], to: words[0][1], votes: words[0][0] }); continue; }
    }
    if (need(missing[i]) && agree[i] <= 1) {
      // A mark the site's scan set apart ("them ?") that the others set against
      // the word before it ("them?"). It is the printing's own punctuation, so it
      // is joined up, never taken out — and left as it is if the others lost it.
      if (PUNCT.test(B[i])) {
        const prev = i > 0 ? [...forms[i - 1].entries()].sort((x, y) => y[1] - x[1])[0] : null;
        if (prev && prev[0].endsWith(B[i]) && !B[i - 1].endsWith(B[i])) cands.push({ kind: "attach", i, from: B[i], votes: missing[i] });
        continue;
      }
      cands.push({ kind: "delete", i, from: B[i], votes: missing[i] });
      continue;
    }
    const formBest = [...forms[i].entries()].sort((x, y) => y[1] - x[1])[0];
    if (formBest && formBest[0] !== B[i] && need(formBest[1]) && !forms[i].has(B[i])) cands.push({ kind: "form", i, from: B[i], to: formBest[0], votes: formBest[1] });
  }

  const matches = (toks) => lcs(tokKeys(toks), gk).filter((o) => o[0] === "=").length;
  const m0 = matches(B);
  const toModern = new Map(lcs(bk, gk).filter((o) => o[0] === "=").map((o) => [o[1], o[2]]));
  const applyOne = (c) => {
    const t = B.slice();
    if (c.kind === "insert") t.splice(c.at, 0, ...c.to.split(" "));
    else if (c.kind === "delete" || c.kind === "attach") t.splice(c.i, 1);
    else if (c.kind === "merge") t.splice(c.i, 2, c.to);
    else t[c.i] = c.to;
    return t;
  };
  const STD = /^[A-Za-z.,;:!?'"’“”‘()—–-]+$/;
  // A token of footnote apparatus: a figure, an abbreviated book ("Jac."), or a
  // footnote key ("n,"). A word next to one is in the apparatus, not the verse.
  const apparatusAt = (j) => j >= 0 && j < B.length && (/\d/.test(B[j]) || /^[A-Z][a-z]{0,4}\.$/.test(B[j]) || /^[a-z]{1,2}[^A-Za-z\s]*[,.]$/.test(B[j]));
  const safe = (c) => {
    const m1 = matches(applyOne(c));
    if (c.kind === "insert") return c.to.split(" ").length <= 3 && c.to.split(" ").every(isWord) && m1 > m0;
    if (c.kind === "substitute") {
      // Never half of a word the line broke ("cheer-"), never one short word in
      // place of a run of several ("Anditcametopassthatthey" to "they"), and
      // never a scrap inside apparatus, which only lines up with a word by place.
      if (/-$/.test(c.to)) return false;
      if (lettersOf(c.from).length > lettersOf(c.to).length + 4) return false;
      if (apparatusAt(c.i - 1) || apparatusAt(c.i + 1)) return false;
      return isWord(c.to) && STD.test(c.to) && (m1 > m0 || (!isWord(c.from) && m1 >= m0));
    }
    // "&c." is the printing's own "etc.", however little it looks like a word.
    if (c.kind === "delete" && /^&c\.?[,;:]?$/.test(c.from)) return false;
    if (c.kind === "delete") return (!isWord(c.from) && m1 >= m0) || (m1 > m0 && c.votes >= Math.ceil(0.8 * n));
    if (c.kind === "attach") return true;
    if (c.kind === "merge") return !/-$/.test(c.to) && isWord(c.to) && STD.test(c.to) && m1 >= m0 && lev(lettersOf(c.from).toLowerCase(), lettersOf(c.to).toLowerCase()) <= 3;
    if (!STD.test(c.to)) return false;
    if (/['’]/.test(c.from) && !/['’]/.test(c.to)) return false;
    if (lettersOf(c.from).toLowerCase() !== lettersOf(c.to).toLowerCase()) return false;
    if (lettersOf(c.from) !== lettersOf(c.to)) {
      const gj = toModern.get(c.i);
      const g = gj == null ? null : lettersOf(G[gj]);
      return g !== null && lettersOf(c.to) === g && lettersOf(c.from) !== g;
    }
    return c.votes >= 3;
  };
  const accepted = cands.filter(safe);
  const at = new Map(), ix = new Map();
  for (const c of accepted) (c.kind === "insert" ? at.set(c.at, c) : ix.set(c.i, c));
  const out = [];
  for (let i = 0; i <= B.length; i++) {
    if (at.has(i)) out.push(at.get(i).to);
    if (i === B.length) break;
    const c = ix.get(i);
    if (!c) out.push(B[i]);
    else if (c.kind === "attach") { if (!out.length) out.push(B[i]); else if (!out[out.length - 1].endsWith(B[i])) out[out.length - 1] += B[i]; }
    else if (c.kind === "merge") { out.push(c.to); i++; }
    else if (c.kind !== "delete") out.push(c.to);
  }
  return { text: out.join(" "), accepted };
}

// A running head or heading fragment caught at either end of a filled verse:
// one or two tokens past the last word the modern verse shares, each of them a
// non-word, a shout ("OF"), or a word ending in a colon ("tie:"). Nothing that
// could be the verse's own closing words is taken.
function trimEdges(text, modernText, inScripture) {
  const T = text.split(" ");
  const gk = new Set(tokKeys((modernText || "").split(/\s+/).filter(Boolean)));
  // Judged against scripture's own vocabulary rather than what the edition
  // prints: a running head like "Sec." leaked often enough to look printed.
  const scrap = (t) => !gk.has(keyOf(t) || "#" + t) && ((lettersOf(t) && !inScripture(t)) || /^[A-Z]{2,}[.,:]?$/.test(t) || /[a-z]:$/.test(t));
  let a = 0, b = T.length;
  for (let k = 0; k < 2 && a < b - 1 && scrap(T[a]); k++) a++;
  for (let k = 0; k < 2 && b > a + 1 && scrap(T[b - 1]); k++) b--;
  return T.slice(a, b).join(" ");
}

// ---------------------------------------------------------------- the run
async function main() {
  const docs = Object.fromEntries(Object.keys(VOLUMES).map((f) => [f, load(resolve(SCRIPTURES, f + ".json"))]));

  // The text as it read before any scans were compared: take back the readings
  // an earlier collation settled, so they are weighed afresh rather than
  // mistaken for the site's own scan.
  const previous = existsSync(WITNESS_READINGS) ? load(WITNESS_READINGS).readings || [] : [];
  const index = new Map();
  for (const f of Object.keys(VOLUMES)) for (const [ref, v] of versesByRef(docs[f])) index.set(ref, v);
  let reverted = 0;
  for (const r of previous) { const v = index.get(r.ref); if (v && v.text === r.to) { v.text = r.from; reverted++; } }
  if (reverted) console.log(`took back ${reverted} readings from the last collation`);

  // ...and the proofreader over it without them, so the readings are settled
  // against exactly the text they will later be applied to, however the
  // proofreader itself has changed since they were last settled.
  for (const f of Object.keys(VOLUMES)) writeFileSync(resolve(SCRIPTURES, f + ".json"), JSON.stringify(docs[f]));
  await proofreadScriptures({ witnesses: false, log: () => {} });
  for (const f of Object.keys(VOLUMES)) docs[f] = load(resolve(SCRIPTURES, f + ".json"));

  const guides = await fetchGuides();
  const referenceTexts = [];
  for (const f of ["old-testament", "new-testament"]) for (const [, v] of versesByRef(load(resolve(SCRIPTURES, f + ".json")))) referenceTexts.push(v.text);
  for (const f of Object.keys(VOLUMES)) for (const [, v] of versesByRef(guides[f])) referenceTexts.push(v.text);
  const vocab = new Set(referenceTexts.flatMap(wordsOf));
  const printed = new Map();
  for (const f of Object.keys(VOLUMES)) for (const [, v] of versesByRef(docs[f])) {
    if (v.text === MISSING || v.text === ABSENT) continue;
    for (const w of wordsOf(v.text)) printed.set(w, (printed.get(w) || 0) + 1);
  }
  const isWord = (t) => {
    const core = lettersOf(t);
    if (!core) return false;
    if (core.length === 1) return ["a", "A", "I", "O"].includes(core);
    const l = core.toLowerCase();
    return vocab.has(l) || (printed.get(l) || 0) >= 3;
  };
  const inScripture = (t) => {
    const core = lettersOf(t);
    if (!core) return false;
    if (core.length === 1) return ["a", "A", "I", "O"].includes(core);
    return vocab.has(core.toLowerCase());
  };

  const settled = [];
  for (const [f, cfg] of Object.entries(VOLUMES)) {
    const verses = orderedVerses(docs[f]);
    const modern = new Map([...versesByRef(guides[f])].map(([ref, v]) => [ref, v.text]));
    const readings = {};
    for (const id of cfg.witnesses) {
      const rd = readingsFor(streamOf(await download(id)), verses, modern);
      readings[id] = rd;
      console.log(`  ${f} ${id}: ${rd.size} of ${verses.length} verses found`);
    }
    let fills = 0, voted = 0;
    for (const { ref, v } of verses) {
      if (v.text === ABSENT) continue;
      const g = modern.get(ref) || "";
      const rs = cfg.witnesses.map((id) => readings[id].get(ref)).filter(Boolean);
      if (v.text === MISSING) {
        const cands = rs.filter((r) => sim(r, g) >= 0.75);
        if (cands.length < 2) continue;
        // The scan that agrees best with the rest, and among near ties the one
        // with the fewest tokens that are not words.
        const junk = (r) => r.split(/\s+/).filter((t) => lettersOf(t) && !isWord(t)).length;
        const medoid = cands.map((r) => [r, cands.reduce((s, o) => s + (o === r ? 0 : sim(r, o)), 0) - 0.05 * junk(r)]).sort((x, y) => y[1] - x[1])[0][0];
        const others = cands.filter((r) => r !== medoid && sim(r, medoid) >= 0.85);
        if (!others.length) continue;
        const text = trimEdges(collate(medoid, others, g, isWord).text.replace(/^(?:\d{1,3}[.:,]?\s+)+/, "").replace(/(?:\s+\d{1,3}[.:,]?)+$/, ""), g, inScripture);
        settled.push({ vol: f, ref, from: v.text, to: text, modern: g });
        fills++;
        continue;
      }
      const agreeing = rs.filter((r) => sim(r, v.text) >= 0.6);
      if (agreeing.length < 2) continue;
      const res = collate(v.text, agreeing, g, isWord);
      if (res.accepted.length) { settled.push({ vol: f, ref, from: v.text, to: res.text, modern: g }); voted++; }
    }
    console.log(`${f}: ${fills} illegible verses filled, ${voted} verses corrected`);
  }

  // Every settled reading proofread the way the rest of the text is, against
  // the text as it will stand with all of them in it — so the proofreader,
  // running over the finished text later, finds nothing more to do to them.
  const byRef = new Map(settled.map((s) => [s.ref, s]));
  const applied = Object.fromEntries(Object.keys(VOLUMES).map((f) => [f, structuredClone(docs[f])]));
  for (const f of Object.keys(VOLUMES)) for (const [ref, v] of versesByRef(applied[f])) { const s = byRef.get(ref); if (s) v.text = s.to; }
  const english = new Set(readFileSync(ENGLISH, "utf8").split("\n").map((w) => w.toLowerCase()));
  const ctx = tokenContext(Object.values(applied), referenceTexts, english);
  const out = [];
  for (const s of settled) {
    let text = s.to;
    for (let pass = 0; pass < 5; pass++) { const r = proofVerse(text, s.modern, ctx); if (!r.edits.length || r.text === text) break; text = r.text; }
    if (text !== s.from) out.push({ ref: s.ref, from: s.from, to: text });
  }
  mkdirSync(dirname(WITNESS_READINGS), { recursive: true });
  writeFileSync(WITNESS_READINGS, JSON.stringify({
    note: "Readings settled by comparing independent scans of the same printings. Written by scripts/collate-scriptures.mjs; applied by scripts/proofread-scriptures.mjs.",
    witnesses: Object.fromEntries(Object.entries(VOLUMES).map(([f, c]) => [f, { source: c.source, compared: c.witnesses }])),
    readings: out,
  }, null, 1));
  console.log(`wrote ${out.length} readings to ${WITNESS_READINGS.replace(resolve(here, "..") + "/", "")}`);

  // The text as it stood before comparing, then the proofreader over it, which
  // makes the new readings.
  for (const f of Object.keys(VOLUMES)) writeFileSync(resolve(SCRIPTURES, f + ".json"), JSON.stringify(docs[f]));
  await proofreadScriptures({ log: (line) => console.log("  " + line) });

  // The proofreader's last pass can still settle a reading a little further
  // once they all stand together. Each reading records the verse as it finally
  // reads, so the next collation can take it back exactly.
  const finished = new Map();
  for (const f of Object.keys(VOLUMES)) for (const [ref, v] of versesByRef(load(resolve(SCRIPTURES, f + ".json")))) finished.set(ref, v.text);
  const file = load(WITNESS_READINGS);
  let updated = 0;
  file.readings = file.readings.map((r) => {
    const now = finished.get(r.ref);
    if (now !== undefined && now !== r.to && now !== r.from) { updated++; return { ...r, to: now }; }
    return r;
  }).filter((r) => r.to !== r.from);
  writeFileSync(WITNESS_READINGS, JSON.stringify(file, null, 1));
  if (updated) console.log(`recorded ${updated} readings as the proofreader finally left them`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
