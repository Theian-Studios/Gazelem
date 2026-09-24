// Proofreads the three volumes built from page scans — the Book of Mormon, the
// Pearl of Great Price and the Doctrine and Covenants — in public/scriptures,
// and rewrites gaps.json from what is still illegible.
//
//   npm run proof:scriptures                 corrects public/scriptures in place
//   npm run proof:scriptures -- --out <dir>  writes the corrected files elsewhere
//
// build-scriptures.mjs runs this after every build, so the corrections are made
// again from the scans rather than living only in the files it overwrites.
//
// Two passes, and the modern edition (bcbooks/scriptures-json) is the map for
// both, exactly as it is for the build: it says where a verse belongs and what
// the verse is about to say, and it never supplies the words.
//
// 1. Re-slotting. The build places scanned text in verse slots, and in places
//    it placed a verse one slot early — leaving "[not legible]" behind it — or
//    glued two verses into one behind a mangled verse number ("3 9.", "1.4.",
//    "6Q."), or shifted a whole run of verses into the wrong section (D&C 13 to
//    19 held the text of 14 to 20). The words were all there; only their
//    addresses were wrong. Each book's text is cut at every token that could be
//    a verse number and aligned, in reading order, to the modern verses by the
//    words they share. Nothing is rewritten and nothing reordered, and a result
//    is refused outright if it would drop real words, empty out a verse that
//    held its own text, or make a verse that read well read worse.
//
// 2. Word by word. Each verse is aligned with the modern verse and only the
//    places they disagree are looked at. A token is corrected only where it is
//    not a word of scripture at all, and only onto a spelling the scanned
//    edition itself prints elsewhere — so "Saviour", "intrusted" and
//    "Methusaleh" keep the edition's spelling, and a genuine older reading, being
//    a word, is never touched. Footnote keys fused onto words ("amy church"),
//    stray letters and figures, apparatus runs, words run together or broken in
//    two, and letters the scan misread are what it corrects. Names the older
//    Doctrine and Covenants printed where the modern text prints others ("Baurak
//    Ale", "Gazelam") are never removed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPTURES = resolve(here, "..", "public/scriptures");
export const MISSING = "[not legible in the page scan]";
export const ABSENT = "[not in this edition]";
const VOLUMES = ["book-of-mormon", "pearl-of-great-price", "doctrine-and-covenants"];
const GUIDE = (file) => `https://cdn.jsdelivr.net/gh/bcbooks/scriptures-json@master/${file}.json`;
const ENGLISH = "/usr/share/dict/words";

// ---------------------------------------------------------------- shared
const isPlaceholder = (t) => t === MISSING || t === ABSENT;
const wordsOf = (t) => t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
const bagOf = (ws) => { const m = new Map(); for (const w of ws) m.set(w, (m.get(w) || 0) + 1); return m; };
const hitsOf = (bag, vbag) => { let h = 0; for (const [w, c] of bag) { const d = vbag.get(w); if (d) h += Math.min(c, d); } return h; };
const letters = (t) => t.toLowerCase().replace(/[^a-z]/g, "");
const chaptersOf = (doc) => (doc.sections ? doc.sections : doc.books.flatMap((b) => b.chapters));

function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------- re-slotting
const ATTACH_JUNK = 0.3;   // cost of each unmatched word kept in a verse
const DROP_REAL = 5;       // cost of each real word dropped: real text is kept wherever it can be placed
const HOME_BONUS = 0.35;   // a piece left in the verse it came from, per word
const PIECES_PER_VERSE = 8;
const BAND = 10;           // verses searched either side of where a piece seems to belong
const MIN_SIM = 0.5;
const HOME_CONTAIN = 0.75; // a fragment stays home if this share of its words are in its own verse
const RELOCATE_SIM = 0.8;  // a slot is only believed to belong elsewhere on a strong match
const MAX_DROPPED_REAL = 2;

// A token that may be a verse number, as printed or as the scan mangled it.
const markerish = (tok) => /\d/.test(tok) || /^[A-Z]{1,2}[.:]$/.test(tok);

// A verse number left at either end of a verse — "53.", "3 4." — up to three
// digits, since a year at the end of a verse is text.
function stripNumbers(t) {
  if (isPlaceholder(t)) return t;
  const toks = t.split(" ");
  let a = 0, b = toks.length;
  const num = (x) => /^\d{1,3}(?:[.:,]\d?)*[.:,]*$/.test(x);
  while (a < b - 1 && a < 3 && num(toks[a])) a++;
  while (b > a + 1 && toks.length - b < 3 && num(toks[b - 1])) b--;
  return toks.slice(a, b).join(" ");
}

function reslot(scanChapters, guideChapters, realWords) {
  const G = [], S = [];
  guideChapters.forEach((ch, ci) => ch.forEach((t, vi) => { const ws = wordsOf(t); G.push({ ci, vi, t, bag: bagOf(ws), n: ws.length }); }));
  scanChapters.forEach((ch, ci) => ch.forEach((t, vi) => S.push({ ci, vi, t })));
  if (G.length !== S.length) return { skipped: `${S.length} slots against ${G.length} verses` };

  const anchor = S.map((s, i) => {
    if (isPlaceholder(s.t)) return i;
    const ws = wordsOf(s.t), bag = bagOf(ws);
    const simAt = (j) => (2 * hitsOf(bag, G[j].bag)) / Math.max(1, ws.length + G[j].n);
    const own = simAt(i);
    if (own >= 0.7) return i;
    let best = i, bs = own;
    for (let j = Math.max(0, i - 80); j <= Math.min(G.length - 1, i + 80); j++) { const x = simAt(j); if (x > bs) { bs = x; best = j; } }
    return bs >= RELOCATE_SIM ? best : i;
  });

  const P = [];
  S.forEach((s, i) => {
    if (isPlaceholder(s.t)) return;
    let cur = [];
    const flush = () => { if (cur.length) { const t = cur.join(" "); const ws = wordsOf(t); P.push({ slot: i, t, bag: bagOf(ws), n: ws.length, real: realWords(t) }); cur = []; } };
    for (const tok of s.t.split(/\s+/).filter(Boolean)) { if (markerish(tok)) { flush(); cur.push(tok); flush(); } else cur.push(tok); }
    flush();
  });
  const n = P.length, m = G.length;
  if (!n) return { skipped: "no text" };

  // Bands smoothed over neighbouring pieces, so a real shift stays joined to the
  // text on either side of it.
  const c = P.map((p) => anchor[p.slot]);
  const band = P.map((_, i) => {
    let lo = Infinity, hi = -Infinity;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { lo = Math.min(lo, c[k], P[k].slot); hi = Math.max(hi, c[k], P[k].slot); }
    return [Math.max(0, lo - BAND), Math.min(m, hi + BAND + 1)];
  });

  const NEG = -1e18;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(NEG));
  const back = Array.from({ length: n + 1 }, () => new Int32Array(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    let jl, jh;
    if (i === n) { jl = 0; jh = m; }
    else { jl = i === 0 ? 0 : Math.min(band[i][0], band[i - 1][0]); jh = i === 0 ? band[0][1] : Math.max(band[i][1], band[i - 1][1]); }
    for (let j = jl; j <= jh; j++) {
      const cur = dp[i][j]; if (cur <= NEG / 2) continue;
      if (j < m && cur > dp[i][j + 1]) { dp[i][j + 1] = cur; back[i][j + 1] = 0; }       // a verse the scan does not have
      if (i === n) continue;
      const drop = cur - DROP_REAL * P[i].real;                                           // a piece with nowhere to go
      if (drop > dp[i + 1][j]) { dp[i + 1][j] = drop; back[i + 1][j] = 1; }
      if (j < m) {                                                                         // pieces i.. make verse j
        const gbag = new Map(); let gn = 0, homeN = 0, allHome = true;
        for (let k = 1; k <= PIECES_PER_VERSE && i + k <= n; k++) {
          const p = P[i + k - 1];
          for (const [w, cnt] of p.bag) gbag.set(w, (gbag.get(w) || 0) + cnt);
          gn += p.n;
          if (p.slot === j) homeN += p.n; else allHome = false;
          if (gn > G[j].n * 2.5 + 12) break;
          const h = hitsOf(gbag, G[j].bag);
          const sim = (2 * h) / Math.max(1, gn + G[j].n);
          const fragmentHome = allHome && h / Math.max(1, gn) >= HOME_CONTAIN;
          if (sim < MIN_SIM && !fragmentHome && !(allHome && gn > 0 && h === 0 && p.real === 0)) continue;
          const score = cur + h - ATTACH_JUNK * (gn - h) + HOME_BONUS * homeN + 1e-6;
          if (score > dp[i + k][j + 1]) { dp[i + k][j + 1] = score; back[i + k][j + 1] = 2 + k; }
        }
      }
    }
  }
  if (dp[n][m] <= NEG / 2) return { skipped: "no alignment within the band" };

  const assigned = Array.from({ length: m }, () => []);
  const dropped = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const b = back[i][j];
    if (b === 0) j--;
    else if (b === 1) { dropped.push(P[i - 1]); i--; }
    else if (b >= 3) { const k = b - 2; for (let q = i - k; q < i; q++) assigned[j - 1].push(P[q]); i -= k; j--; }
    else return { skipped: `alignment broke at ${i},${j}` };
  }

  const simText = (t, g) => { const ws = wordsOf(t); return (2 * hitsOf(bagOf(ws), g.bag)) / Math.max(1, ws.length + g.n); };
  const out = scanChapters.map((ch) => ch.slice());
  let changed = 0, degraded = 0, emptiedBad = 0;
  G.forEach((g, k) => {
    const old = S[k].t;
    let text = assigned[k].length ? stripNumbers(assigned[k].map((p) => p.t).join(" ").replace(/\s+/g, " ").trim()) : (old === ABSENT ? ABSENT : MISSING);
    if (!isPlaceholder(old) && !isPlaceholder(text) && stripNumbers(old) === text) text = old;
    // A verse that already read well, gaining only apparatus at one end — the
    // tail of its neighbour, moved rather than removed. It stays as it was.
    if (!isPlaceholder(old) && !isPlaceholder(text) && text !== old) {
      const so = simText(old, g), sn = simText(text, g);
      if (so >= 0.85 && sn < so) {
        const extra = text.startsWith(old) ? text.slice(old.length) : text.endsWith(old) ? text.slice(0, text.length - old.length) : null;
        if (extra !== null) { const ew = wordsOf(extra); if (hitsOf(bagOf(ew), g.bag) <= Math.max(1, ew.length * 0.2)) text = old; }
      }
    }
    if (text !== old) {
      changed++;
      const so = isPlaceholder(old) ? null : simText(old, g);
      const sn = isPlaceholder(text) ? null : simText(text, g);
      if (so !== null && sn !== null && ((so >= 0.85 && sn < so - 0.15) || (so >= 0.6 && sn < so - 0.1))) degraded++;
      if (so !== null && sn === null) { const ws = wordsOf(old); if (realWords(old) >= 3 && hitsOf(bagOf(ws), g.bag) / Math.max(1, ws.length) >= 0.7) emptiedBad++; }
    }
    out[g.ci][g.vi] = text;
  });
  const quality = (texts) => texts.reduce((a, t, k) => (isPlaceholder(t) ? a : a + hitsOf(bagOf(wordsOf(t)), G[k].bag)), 0);
  return {
    out, changed, degraded, emptiedBad,
    droppedReal: dropped.reduce((a, p) => a + p.real, 0),
    before: quality(S.map((s) => s.t)), after: quality(out.flat()),
  };
}

const acceptable = (r) => !r.skipped && r.droppedReal <= MAX_DROPPED_REAL && r.after >= r.before && r.degraded === 0 && r.emptiedBad === 0;

// A volume in place: each book whole, and where that is refused, each chapter,
// and then each run of refused chapters with a chapter either side of it.
function reslotDoc(doc, guide, realWords) {
  const units = doc.sections
    ? [{ label: "D&C", ch: doc.sections, g: guide.sections }]
    : doc.books.map((b, bi) => ({ label: b.book, ch: b.chapters, g: guide.books[bi].chapters }));
  let total = 0;
  const refusedUnits = [];
  for (const u of units) {
    const s = u.ch.map((c) => c.verses.map((v) => v.text));
    const g = u.g.map((c) => c.verses.map((v) => v.text));
    const result = s.map((texts) => texts.slice());
    let changed = 0;
    const whole = reslot(s, g, realWords);
    if (acceptable(whole)) {
      whole.out.forEach((texts, k) => { result[k] = texts; });
      changed = whole.changed;
    } else {
      const refused = [];
      for (let ci = 0; ci < s.length; ci++) {
        const r = reslot([s[ci]], [g[ci]], realWords);
        if (acceptable(r)) { if (r.changed) { result[ci] = r.out[0]; changed += r.changed; } }
        else if (!r.skipped && r.changed) refused.push(ci);
      }
      const windows = [];
      for (const ci of refused) {
        const a = Math.max(0, ci - 1), b = Math.min(s.length - 1, ci + 1);
        if (windows.length && a <= windows[windows.length - 1][1] + 1) windows[windows.length - 1][1] = b; else windows.push([a, b]);
      }
      for (const [a, b] of windows) {
        const r = reslot(s.slice(a, b + 1), g.slice(a, b + 1), realWords);
        if (acceptable(r)) {
          for (let k = a; k <= b; k++) if (result[k].some((t, vi) => t !== s[k][vi])) changed -= result[k].filter((t, vi) => t !== s[k][vi]).length;
          r.out.forEach((texts, k) => { result[a + k] = texts; });
          for (let k = a; k <= b; k++) changed += result[k].filter((t, vi) => t !== s[k][vi]).length;
        } else refusedUnits.push(`${u.label} ${u.ch[a].chapter ?? u.ch[a].section}–${u.ch[b].chapter ?? u.ch[b].section}`);
      }
    }
    result.forEach((texts, ci) => u.ch[ci].verses.forEach((v, vi) => { v.text = texts[vi]; }));
    total += changed;
  }
  return { changed: total, refused: refusedUnits };
}

// ---------------------------------------------------------------- word by word
const key = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
const STD_PUNCT = /^[—–\-;:,.!?()'"’“”‘]+$/;
const leadOf = (t) => t.match(/^[^A-Za-z]*/)[0];
const trailOf = (t) => t.match(/[^A-Za-z]*$/)[0];
const coreOf = (t) => t.replace(/^[^A-Za-z]*/, "").replace(/[^A-Za-z]*$/, "");
const tidyPunct = (s) => s.replace(/[^.,;:!?'"’“”‘()\[\]—–\-]/g, "");
const nameLike = (t) => /^[A-Z][a-z]{2,}[,;:!?]?$/.test(t);
const wordSim = (a, b) => { const A = wordsOf(a), B = wordsOf(b); if (!A.length || !B.length) return 0; return (2 * hitsOf(bagOf(A), bagOf(B))) / (A.length + B.length); };
const sentenceStart = (prev) => !prev || /[.?!:]["'’”)]*$/.test(prev);

// Two spellings of one word rather than one word misread as another: the
// shorter is the whole start or end of the longer ("voice"/"voiced",
// "sample"/"ensample"), or, for long words, all but two letters at one end are
// shared ("agreeably"/"agreeable", "intrusted"/"entrusted").
const variantForm = (a, b) => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  let p = 0; while (p < s.length && s[p] === l[p]) p++;
  let q = 0; while (q < s.length && s[s.length - 1 - q] === l[l.length - 1 - q]) q++;
  return p === s.length || q === s.length || (s.length >= 7 && (p >= s.length - 2 || q >= s.length - 2));
};

// Scan errors no rule can safely reach, each looked at by hand: a real English
// word standing where the edition plainly printed another. Keyed by the token
// exactly as the scan has it.
const REVIEWED = {
  "D&C 20:1": { arise: "rise" },
  "D&C 85:9": { Availing: "wailing" },
  "D&C 88:13": { ife: "life" },
  "D&C 95:4": { rune: "prune" },
  "D&C 117:12": { feneration: "generation" },
};

// A capital where the modern word has one, or where the scan has one at the
// start of a sentence. A capital the scan put mid-sentence is the scan's.
const cased = (word, scanCore, guideCore, prev) => {
  const up = /^[A-Z]/.test(guideCore || "") || (/^[A-Z]/.test(scanCore) && sentenceStart(prev));
  return (up ? word[0].toUpperCase() : word[0].toLowerCase()) + word.slice(1);
};

function diff(a, b) {
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

export function proofVerse(text, modern, { vocab, printed, english, nearestPrinted }) {
  if (isPlaceholder(text) || !modern) return { text, edits: [] };
  const S = text.split(/\s+/).filter(Boolean), G = modern.split(/\s+/).filter(Boolean);
  const ops = diff(S.map((t, i) => key(t) || "#s" + i), G.map((t, j) => key(t) || "#g" + j));
  const edits = [];
  const isWord = (l) => l && vocab.has(l);
  const good = (w) => printed(w) >= 3;

  // Words both texts agree on: marks stuck to the word that are not
  // punctuation ("?Idumea", "&If", "lies,°"), and a lowercase i the scan read as
  // a capital.
  for (const [o, i, j] of ops) {
    if (o !== "=") continue;
    let t = S[i], cat = null;
    // Only a word: a figure is text ("19th", "1829,"), and its digits are not marks.
    if (/[A-Za-z]/.test(t)) {
      const lead = leadOf(t), trail = trailOf(t);
      const cleanLead = lead.replace(/[^0-9“"'‘’(\[—–\-]/g, "");
      // A mark that is not punctuation is usually punctuation misread — the Pearl
      // of Great Price scan prints its commas as "/" — so where nothing is left,
      // the modern text's mark stands in its place.
      const tidied = tidyPunct(trail);
      const cleanTrail = tidied || (trail ? trailOf(G[j]) : "");
      if (lead !== cleanLead || trail !== cleanTrail) { t = cleanLead + coreOf(t) + cleanTrail; cat = "stray-mark"; }
    }
    const sc = coreOf(t), g = coreOf(G[j]);
    if (i > 0 && sc.length > 1 && sc[0] === "I" && g[0] === "i" && !sentenceStart(S[i - 1])) { t = t.replace("I", "i"); cat = cat || "capital-i"; }
    // A point the scan set between words ("the. earth", "say. unto"): the
    // modern word has none, the next word runs on in lowercase, and it is not
    // an abbreviation.
    const nextTok = S[i + 1];
    if (/[A-Za-z]\.$/.test(t) && !/\./.test(G[j]) && nextTok && /^[a-z]/.test(nextTok) && !/^[A-Z][a-z]{0,3}\.$/.test(t)) {
      // Usually a comma or semicolon misread, so the modern mark stands in where
      // there is one.
      const mark = trailOf(G[j]);
      t = t.slice(0, -1) + (/^[,;:]$/.test(mark) ? mark : "");
      cat = cat || "stray-mark";
    }
    if (cat && t) edits.push({ i, span: 1, to: t, cat });
  }

  let h = null; const hunks = [];
  for (const op of ops) {
    if (op[0] === "=") { if (h) { hunks.push(h); h = null; } continue; }
    if (!h) h = { si: [], gj: [] };
    if (op[1] >= 0) h.si.push(op[1]);
    if (op[2] >= 0) h.gj.push(op[2]);
  }
  if (h) hunks.push(h);

  for (const hk of hunks) {
    if (!hk.si.length) continue;
    const gToks = hk.gj.map((j) => G[j]);
    const gL = gToks.map(letters);
    const pure = gL.every((l) => !l);
    const toks = hk.si.map((i) => S[i]);

    // Footnote apparatus the modern text has nothing for — never a run holding
    // a name, which may be one the older edition printed. A capitalised token
    // counts as a name when the edition prints it again, scripture knows it, or
    // it is long enough to be one; a short one printed once ("Nepul", for Nephi,
    // inside a line of apparatus) is the scan's.
    const aName = (t) => nameLike(t) && (printed(letters(t)) >= 2 || isWord(letters(t)) || letters(t).length >= 6);
    // Apparatus that carries its own signposts — "see Sec. 18.", "vers. 4" — comes
    // out whole, names and glosses and all: nothing in scripture is written
    // "Sec.", and a gloss like "West of Missouri" inside such a run is the
    // footnote's, not the verse's.
    if (pure && toks.length >= 2 && toks.length <= 30 && toks.some((t) => /^(?:Sec|Chap|Ver|Vers|Vera)\.?[,;:]?$/i.test(t))) {
      edits.push({ i: hk.si[0], span: toks.length, to: "", cat: "apparatus" });
      continue;
    }
    if (pure && toks.length >= 2 && !toks.some(aName)) {
      const junk = toks.filter((t) => { const l = letters(t); return !l || !isWord(l) || /^[A-Z][a-z]{0,4}\.$/.test(t) || /\d/.test(t); }).length;
      if ((toks.length >= 3 && junk / toks.length >= 0.6) || junk === toks.length) {
        edits.push({ i: hk.si[0], span: toks.length, to: "", cat: "apparatus" });
        continue;
      }
    }

    const guideFor = (w) => { const k = gL.indexOf(w); return k >= 0 ? gToks[k] : null; };
    // The corrected token: the scan's leading marks, the word, and the scan's
    // trailing marks — or the modern word's, only where the scan had one and
    // buried it inside the token ("Look,fl").
    const build = (tok, word, guideTok, prev, trailTok = tok) => {
      const own = tidyPunct(trailOf(trailTok));
      const buried = /[^A-Za-z]/.test(coreOf(trailTok)) && guideTok ? trailOf(guideTok) : "";
      return tidyPunct(leadOf(tok)) + cased(word, coreOf(tok), guideTok ? coreOf(guideTok) : "", prev) + (own || buried);
    };
    // The spelling to land on: the edition's own, where it prints one near the
    // modern word.
    const spellingFor = (L, g) => {
      const own = (nearestPrinted(L) || []).filter((w) => w !== g && lev(w, g) <= 2 && lev(L, w) <= lev(L, g));
      if (own.length && (!good(g) || lev(L, own[0]) < lev(L, g))) return own[0];
      return g;
    };
    // The modern token's inner punctuation kept ("Lehi-Nephi").
    const wordShape = (spelling, guideTok) => {
      const gc = guideTok ? coreOf(guideTok) : "";
      return gc && letters(gc) === spelling && /[^A-Za-z]/.test(gc) ? gc : spelling;
    };

    for (let k = 0; k < hk.si.length; k++) {
      const i = hk.si[k], tok = S[i], L = letters(tok), prev = S[i - 1];
      const next = k + 1 < hk.si.length ? S[hk.si[k + 1]] : null;

      // A word broken in two.
      if (L && next && letters(next)) {
        const g = gL.find((x) => x === L + letters(next));
        if (g && (!isWord(L) || !isWord(letters(next))) && good(g)) {
          edits.push({ i, span: 2, to: build(tok, wordShape(g, guideFor(g)), guideFor(g), prev, next), cat: "split-word" });
          k++; continue;
        }
      }

      // A running head or a library stamp in capitals — "COVENANTS", "APPENDIX.",
      // "DATE DUE" — where the modern verse has nothing at all. A capitalised
      // word the verse does have ("I AM") is matched there, and never reaches this.
      if (pure && /^[A-Z]{2,}[.,:;]?$/.test(tok)) {
        edits.push({ i, span: 1, to: "", cat: "running-head" });
        continue;
      }

      // A stray figure or mark.
      if (!L) {
        if (!STD_PUNCT.test(tok) && pure) edits.push({ i, span: 1, to: "", cat: /\d/.test(tok) ? "stray-number" : "stray-mark" });
        continue;
      }

      // A single letter: a short word misread, or a footnote key left standing.
      if (L.length === 1 && tok.replace(/[^A-Za-z]/g, "").length === 1) {
        const core = coreOf(tok);
        const close = gL.find((g) => g && g.length <= 3 && lev(L, g) <= Math.min(2, g.length));
        // A word in its own right, never a misreading: "O" is not a misread "Oh".
        const reading = ["a", "A", "I", "O"].includes(core);
        if (!pure && !reading && close && hk.si.length === 1 && good(close)) {
          edits.push({ i, span: 1, to: build(tok, close, guideFor(close), prev), cat: "short-word" });
        } else if (pure && !reading) {
          edits.push({ i, span: 1, to: "", cat: "stray-letter" });
        }
        continue;
      }

      if (isWord(L)) continue;

      // Junk after a mark that ended the word ("Look,fl") — only where what
      // follows is not a word: "cannot.be" is two words run together.
      const tj = coreOf(tok).match(/^([A-Za-z]+)([.,;:!?])([A-Za-z]{1,2})$/);
      if (tj && gL.includes(tj[1].toLowerCase()) && !isWord(tj[3].toLowerCase()) && !["a", "i", "o"].includes(tj[3].toLowerCase())) {
        edits.push({ i, span: 1, to: tidyPunct(leadOf(tok)) + tj[1] + tj[2] + tidyPunct(trailOf(tok)), cat: "trailing-junk" });
        continue;
      }

      // Words run together — not a hyphenated compound, and not a form the
      // edition prints more than once ("olive-tree", "helpmeet").
      let run = null;
      const mayBeRun = !/[A-Za-z]-[A-Za-z]/.test(tok) && printed(L) <= 1;
      for (let a = 0; mayBeRun && a < gToks.length && !run; a++) {
        let concat = "";
        // Up to nine words: "Anditcametopassthatthey" is seven of them.
        for (let b = a; b < Math.min(gToks.length, a + 9); b++) {
          concat += gL[b];
          if (b === a) continue;
          const d = concat.length >= 10 ? lev(L, concat) : (L === concat ? 0 : 9);
          if (d <= (concat.length >= 10 ? 1 : 0) && gL.slice(a, b + 1).every((w) => w && good(w))) { run = gToks.slice(a, b + 1); break; }
        }
      }
      if (run) {
        const inner = run.map((t, idx) => (idx < run.length - 1 ? t.replace(/^[^A-Za-z]*/, "") : coreOf(t))).join(" ");
        edits.push({ i, span: 1, to: tidyPunct(leadOf(tok)) + cased(inner, coreOf(tok), coreOf(run[0]), prev) + tidyPunct(trailOf(tok)), cat: "run-together" });
        continue;
      }

      const core = coreOf(tok);

      // A footnote key of one or two letters fused onto the word it marks: what
      // is left must be the modern word here, or the edition's own spelling of
      // it — which it keeps.
      if (/^[A-Za-z]+$/.test(core)) {
        let stripped = null;
        for (const cut of [1, 2]) {
          const R = L.slice(cut);
          if (R.length < 2) break;
          const exact = gL.includes(R) && good(R) && printed(R) >= 3 * printed(L);
          const sameWord = (g) => g && g !== R && g[0] === R[0] && Math.abs(g.length - R.length) <= 1 && lev(R, g) <= 2;
          const ownSpelling = R.length >= 3 && isWord(R) && gL.some(sameWord);
          if (exact || ownSpelling) { stripped = { R, g: exact ? R : gL.find(sameWord) }; break; }
        }
        if (stripped) {
          const guideTok = guideFor(stripped.g);
          edits.push({ i, span: 1, to: tidyPunct(leadOf(tok)) + cased(stripped.R, core.slice(L.length - stripped.R.length), guideTok ? coreOf(guideTok) : "", prev) + trailOf(tok), cat: "footnote-key" });
          continue;
        }
      }

      // A misread letter or two. Never a truncated word made whole, and never a
      // clean English word that is only another form of the modern one.
      const clean = /^[A-Za-z]+$/.test(tok.replace(/^[“"'‘(]+/, "").replace(/[.,;:!?”"'’)]+$/, ""));
      const mis = gL
        .map((g) => [g, g ? lev(L, g) : 99])
        .filter(([g, d]) => g && Math.abs(L.length - g.length) <= 1 && (
          d <= 1 ||
          (d === 2 && L.length >= 4 && (L.length >= 6 || L[0] === g[0])) ||
          (d <= Math.floor(L.length / 3) && L.length === g.length && L[0] === g[0])))
        .filter(([g]) => !(clean && english.has(L) && variantForm(L, g)))
        .sort((x, y) => x[1] - y[1])[0];
      if (mis) {
        const target = spellingFor(L, mis[0]);
        if (good(target) && printed(target) >= 3 * printed(L)) {
          const guideTok = guideFor(mis[0]);
          edits.push({ i, span: 1, to: build(tok, wordShape(target, guideTok), guideTok, prev), cat: "misread" });
        }
      }
    }
  }

  edits.sort((a, b) => b.i - a.i);
  const out = S.slice();
  const applied = [];
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.i + e.span > lastStart) continue;
    applied.push({ cat: e.cat, from: S.slice(e.i, e.i + e.span).join(" "), to: e.to });
    out.splice(e.i, e.span, ...(e.to ? [e.to] : []));
    lastStart = e.i;
  }
  // Only the marks that really follow a word without a space, as the build has
  // it: a ! or ? standing alone is the scan's reading of a letter.
  // And a comma, colon or semicolon followed by a stray point ("me,. I give").
  const result = out.join(" ").replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").replace(/([,;:])\.(?=\s|$)/g, "$1").trim();
  return { text: result || text, edits: applied.reverse() };
}

function proofDoc(doc, guide, ctx) {
  const pairs = doc.sections
    ? doc.sections.flatMap((s, si) => s.verses.map((v, vi) => [`D&C ${s.section}:${v.verse}`, v, guide.sections[si]?.verses[vi]?.text]))
    : doc.books.flatMap((b, bi) => b.chapters.flatMap((c, ci) => c.verses.map((v, vi) => [`${b.book} ${c.chapter}:${v.verse}`, v, guide.books[bi]?.chapters[ci]?.verses[vi]?.text])));
  const counts = {};
  for (const [ref, v, modern] of pairs) {
    // Again until nothing changes: one correction can bring the next into reach
    // (a figure left beside a word just joined back together), and a verse
    // already proofread should have nothing more to give a second run.
    const r = proofVerse(v.text, modern, ctx);
    for (let pass = 0; pass < 4; pass++) {
      const again = proofVerse(r.text, modern, ctx);
      if (!again.edits.length || again.text === r.text) break;
      r.text = again.text;
      r.edits.push(...again.edits);
    }
    for (const [from, to] of Object.entries(REVIEWED[ref] || {})) {
      const toks = r.text.split(" ");
      const k = toks.findIndex((t) => t === from || coreOf(t) === from);
      if (k < 0) continue;
      const was = toks[k];
      toks[k] = was === from ? to : leadOf(was) + to + trailOf(was);
      r.edits.push({ cat: "reviewed" });
      r.text = toks.join(" ");
    }
    // Scan noise rather than text: mostly not letters, and sharing almost
    // nothing with the verse it stands for. Better to say it could not be read.
    const nonspace = r.text.replace(/\s/g, "");
    const letterShare = (nonspace.match(/[A-Za-z]/g) || []).length / Math.max(1, nonspace.length);
    if (modern && !isPlaceholder(r.text) && letterShare < 0.6 && wordSim(r.text, modern) < 0.2) {
      r.text = MISSING;
      r.edits.push({ cat: "garbage-verse" });
    }
    for (const e of r.edits) counts[e.cat] = (counts[e.cat] || 0) + 1;
    v.text = r.text;
  }
  return counts;
}

export function tokenContext(docs, referenceTexts, english) {
  const vocab = new Set();
  for (const t of referenceTexts) for (const w of t.split(/\s+/)) { const l = letters(w); if (l) vocab.add(l); }
  const counts = new Map();
  for (const d of docs) for (const c of chaptersOf(d)) for (const v of c.verses) {
    if (isPlaceholder(v.text)) continue;
    for (const w of v.text.split(/\s+/)) { const l = letters(w); if (l) counts.set(l, (counts.get(l) || 0) + 1); }
  }
  const byFirst = new Map();
  for (const [w, c] of counts) if (c >= 3) { if (!byFirst.has(w[0])) byFirst.set(w[0], []); byFirst.get(w[0]).push(w); }
  const nearestPrinted = (L) => (byFirst.get(L[0]) || [])
    .filter((w) => Math.abs(w.length - L.length) <= 1 && w !== L && lev(L, w) <= 1)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  return { vocab, printed: (w) => counts.get(w) || 0, english, nearestPrinted };
}

// ---------------------------------------------------------------- furniture
// Printed matter that is not verse, carried into a verse by the column-splitter:
// the section headings the 1920 Book of Mormon sets between chapters ("The
// Record of Zeniff. — An account of his people… Comprising chapters 9 to 22"),
// the Doctrine and Covenants' section headings and running heads, back matter,
// and lines of footnote apparatus. The words are real print, which is why no
// rule above will take them — so each was found by hand and is named here by
// the words it opens with (`from`, to the end of the verse) or its exact text
// (`cut`).
//
// Nothing is taken out unless taking it out brings the verse closer to the
// verse it is. That is what keeps this safe to run twice: a second run either
// finds nothing, or finds the words somewhere they belong and leaves them.
const FURNITURE = [
  { ref: "2 Nephi 12:14", cut: "lee Im. diapi. to inclusive, an quoted in the noxt cbopterti, taken by Nepul from tbo brava platei" },
  { ref: "Mosiah 8:21", from: "The Eecobd of Zeniff." },
  { ref: "Mosiah 22:16", from: "An account of Alma and the people of the Lord, who were driven" },
  { ref: "Alma 8:32", from: "The words of Alma, and also the words of Amulelc," },
  { ref: "Alma 16:21", from: "An account of the sons of Mosiah, who rejected" },
  { ref: "Alma 20:26", cut: "o, we n, Jac. 7. p, no b. 9, aee v>, Al," },
  { ref: "Alma 20:30", from: "An account of the preaching of Aaron," },
  { ref: "Alma 35:16", from: "The commandments of Alma to his son, Helaman." },
  { ref: "Alma 38:15", from: "The commandments of Alma to his son, Corianton." },
  { ref: "Alma 44:24", from: "The account of the people of Nephi, and their wars and dissensions," },
  { ref: "Alma 60:36", from: "I, Pahoran, who am the chief governor of this land,", moveTo: "Alma 61:2" },
  { ref: "Alma 63:17", from: "An account of the Nephites. Their wars and contentions," },
  { ref: "Helaman 12:26", from: "The prophecy of Samuel, the Lamanite, to the Nephites." },
  { ref: "3 Nephi 10:19", from: "Jesus Christ did show himself unto the people of Nephi, as the multitude" },
  { ref: "Moroni 10:34", from: "THE END SYNOPSIS OF CHAPTERS" },
  { ref: "Moses 8:30", from: "No. I. iMljIMOHHn Explanation of the above Cut." },
  { ref: "Abraham 5:21", from: "And Jesus went out, and departed from the temple;", moveTo: "Joseph Smith—Matthew 1:2" },
  { ref: "Abraham 5:21", from: "KDMUHSHHSS" },
  { ref: "Joseph Smith—Matthew 1:55", from: "II. Extracts from the History of Joseph Smith." },
  { ref: "D&C 25:1", cut: "Great miracles to be wrought only by command. see a. COVENANTS AND [sec. XXV." },
  { ref: "D&C 42:93", from: "Revelation given through Joseph, the Seer, at Kirtland, Ohio, February," },
  { ref: "D&C 65:6", from: "SECTION Revelation given through Joseph, the Seer," },
  // The minutes' signature, set as two names braced against "Clerks".
  { ref: "D&C 102:34", cut: "Oliver Cowdery, Clerks> Orson Hyde, )", replace: "Oliver Cowdery, Orson Hyde, Clerks." },
  // A footnote gloss set down in the middle of a word the line broke in two.
  { ref: "D&C 123:17", cut: "cheerb3 Elder A. M. Musser is appointed to gather up these libelous reports. fully", replace: "cheerfully" },
];

// Where the words are scripture after all, only in the wrong verse, `moveTo`
// names the verse they belong to — and they go there only if that verse is
// still marked illegible and the words are recognisably its own. `replace`
// resets a printed layout the scan scrambled, with the same words in it.
function removeFurniture(doc, guide, ctx) {
  const at = new Map(), modern = new Map();
  if (doc.sections) doc.sections.forEach((s, si) => s.verses.forEach((v, vi) => { const r = `D&C ${s.section}:${v.verse}`; at.set(r, v); modern.set(r, guide.sections[si]?.verses[vi]?.text || ""); }));
  else doc.books.forEach((b, bi) => b.chapters.forEach((c, ci) => c.verses.forEach((v, vi) => { const r = `${b.book} ${c.chapter}:${v.verse}`; at.set(r, v); modern.set(r, guide.books[bi]?.chapters[ci]?.verses[vi]?.text || ""); })));
  const done = [];
  for (const e of FURNITURE) {
    const v = at.get(e.ref);
    if (!v || isPlaceholder(v.text)) continue;
    const text = v.text;
    const start = text.indexOf(e.cut ?? e.from);
    if (start < 0) continue;
    const end = e.cut ? start + e.cut.length : text.length;
    const piece = text.slice(start, end).trim();
    const rest = (text.slice(0, start) + " " + (e.replace ?? "") + " " + text.slice(end)).replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
    if (!rest || wordSim(rest, modern.get(e.ref)) < wordSim(text, modern.get(e.ref))) continue;
    if (e.moveTo) {
      const target = at.get(e.moveTo);
      if (!target || target.text !== MISSING || wordSim(piece, modern.get(e.moveTo)) < 0.8) continue;
      target.text = proofVerse(piece, modern.get(e.moveTo), ctx).text;
    }
    v.text = rest;
    done.push(e.moveTo ? `${e.ref} to ${e.moveTo}` : e.ref);
  }
  return done;
}

// ---------------------------------------------------------------- witnesses
// Readings settled by comparing independent scans of the same printings — see
// collate-scriptures.mjs, which writes this file. Each holds a verse as it read
// before the scans were compared (`from`) and as they settled it (`to`), and is
// applied only to a verse that still reads `from`: so a rebuild from the scans
// takes every one of them again, a second run finds them already made, and a
// verse that has since changed for any other reason is left for the next
// collation rather than overwritten.
export const WITNESS_READINGS = resolve(here, "data/witness-readings.json");

export function versesByRef(doc) {
  const out = new Map();
  if (doc.sections) doc.sections.forEach((s) => s.verses.forEach((v) => out.set(`D&C ${s.section}:${v.verse}`, v)));
  else doc.books.forEach((b) => b.chapters.forEach((c) => c.verses.forEach((v) => out.set(`${b.book} ${c.chapter}:${v.verse}`, v))));
  return out;
}

function applyWitnessReadings(docs, log) {
  if (!existsSync(WITNESS_READINGS)) return;
  const { readings = [] } = JSON.parse(readFileSync(WITNESS_READINGS, "utf8"));
  const index = new Map();
  for (const f of VOLUMES) for (const [ref, v] of versesByRef(docs[f])) index.set(ref, v);
  let applied = 0, already = 0, stale = 0;
  for (const r of readings) {
    const v = index.get(r.ref);
    if (!v) { stale++; continue; }
    if (v.text === r.to) already++;
    else if (v.text === r.from) { v.text = r.to; applied++; }
    else stale++;
  }
  log(`witnesses ${applied} readings applied, ${already} already in place${stale ? `, ${stale} no longer match and were left` : ""}`);
}

export async function fetchGuides() {
  const guides = {};
  for (const f of VOLUMES) {
    const res = await fetch(GUIDE(f));
    if (!res.ok) throw new Error(`modern edition ${f}: HTTP ${res.status}`);
    guides[f] = await res.json();
  }
  return guides;
}

// ---------------------------------------------------------------- the run
export async function proofreadScriptures({ dir = SCRIPTURES, out = dir, log = console.log, witnesses = true } = {}) {
  if (!existsSync(ENGLISH)) throw new Error(`${ENGLISH} is needed to tell a reading from a misreading, and is missing`);
  const load = (p) => JSON.parse(readFileSync(p, "utf8"));
  const docs = Object.fromEntries(VOLUMES.map((f) => [f, load(resolve(dir, f + ".json"))]));
  const guides = await fetchGuides();

  // Words of scripture: the King James text and the modern text of the three.
  const referenceTexts = [];
  for (const f of ["old-testament", "new-testament"]) for (const c of chaptersOf(load(resolve(dir, f + ".json")))) for (const v of c.verses) referenceTexts.push(v.text);
  for (const f of VOLUMES) for (const c of chaptersOf(guides[f])) for (const v of c.verses) referenceTexts.push(v.text);
  const vocab = new Set();
  for (const t of referenceTexts) for (const w of wordsOf(t)) vocab.add(w);
  const realWords = (t) => t.split(/\s+/).filter((tok) => { const l = tok.toLowerCase().replace(/[^a-z]/g, ""); return l.length > 1 && vocab.has(l); }).length;

  for (const f of VOLUMES) {
    const r = reslotDoc(docs[f], guides[f], realWords);
    log(`re-slot   ${f}: ${r.changed} verses${r.refused.length ? `; left as scanned: ${r.refused.join(", ")}` : ""}`);
  }

  const english = new Set(readFileSync(ENGLISH, "utf8").split("\n").map((w) => w.toLowerCase()));
  const ctx = tokenContext(Object.values(docs), referenceTexts, english);
  for (const f of VOLUMES) {
    const counts = proofDoc(docs[f], guides[f], ctx);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    log(`proofread ${f}: ${total} corrections (${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")})`);
  }

  for (const f of VOLUMES) {
    const done = removeFurniture(docs[f], guides[f], ctx);
    if (done.length) log(`furniture ${f}: ${done.length} (${done.join("; ")})`);
  }

  // `witnesses: false` is the text as it stands before the scans are compared,
  // which is what collate-scriptures.mjs settles its readings against.
  if (witnesses) {
    applyWitnessReadings(docs, log);

    // The readings just applied can bring a word into the proofreader's reach — a
    // spelling now printed often enough to count as the edition's own — so the
    // text is gone over once more against itself as it now stands. Without this a
    // second run would make the correction the first one should have.
    const settledCtx = tokenContext(Object.values(docs), referenceTexts, english);
    let again = 0;
    for (const f of VOLUMES) again += Object.values(proofDoc(docs[f], guides[f], settledCtx)).reduce((a, b) => a + b, 0);
    if (again) log(`proofread ${again} more corrections with the readings in place`);
  }

  const gaps = [];
  for (const f of VOLUMES) {
    const d = docs[f];
    if (d.sections) d.sections.forEach((s) => s.verses.forEach((v) => { if (v.text === MISSING) gaps.push(`D&C ${s.section}:${v.verse}`); }));
    else d.books.forEach((b) => b.chapters.forEach((c) => c.verses.forEach((v) => { if (v.text === MISSING) gaps.push(`${b.book} ${c.chapter}:${v.verse}`); })));
    writeFileSync(resolve(out, f + ".json"), JSON.stringify(d));
  }
  const note = "Verses the page scans did not yield; each shows " + MISSING + " in the reader.";
  writeFileSync(resolve(out, "gaps.json"), JSON.stringify({ note, verses: gaps }, null, 1));
  log(`gaps.json ${gaps.length} verses still to be keyed in by hand`);
  return { gaps: gaps.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--out");
  const out = i === -1 ? SCRIPTURES : resolve(process.argv[i + 1]);
  proofreadScriptures({ out }).catch((e) => { console.error(e.message); process.exit(1); });
}
