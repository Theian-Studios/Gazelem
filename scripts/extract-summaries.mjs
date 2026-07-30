// Extracts chapter summaries / section headings from your own PDF copies of the
// scriptures into public/local/summaries.json (which is gitignored).
//
//   npm run extract:summaries -- ~/Downloads/83512_eng.pdf ~/Downloads/34404_eng.pdf
//
// Requires Python 3 with pypdf:  python3 -m pip install --user pypdf
//
// How it works: in these editions a chapter summary is set in the italic face
// (…Std-Italic) and sits between the "CHAPTER n" heading and the first verse,
// which is set in the regular face. Text alone can't find the boundary — some
// summaries contain no em dash and end mid-line — and the heading itself is
// split across runs by the small-caps font, so we pair the chapter numbers
// found in the page text with the long italic blocks on that page, in order.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BOOK_INDEX } from "../src/data/bookIndex.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "..", "public/local/summaries.json");

const pdfs = process.argv.slice(2);
if (!pdfs.length) {
  console.error("usage: npm run extract:summaries -- <file.pdf> [more.pdf ...]");
  process.exit(1);
}
for (const p of pdfs) {
  if (!existsSync(p)) { console.error(`no such file: ${p}`); process.exit(1); }
}

const CANON = new Map(BOOK_INDEX.map((b) => [b.n.toUpperCase(), b.n]));
const ALIASES = {
  "SONG OF SOLOMON": "Solomon's Song",
  "THE SONG OF SOLOMON": "Solomon's Song",
  "JOSEPH SMITH-MATTHEW": "Joseph Smith—Matthew",
  "JOSEPH SMITH-HISTORY": "Joseph Smith—History",
  "THE ARTICLES OF FAITH": "Articles of Faith",
  "ARTICLES OF FAITH": "Articles of Faith",
  "DOCTRINE AND COVENANTS": "Doctrine and Covenants",
  "THE DOCTRINE AND COVENANTS": "Doctrine and Covenants",
};

// Extraction sprays stray spaces through small-caps headings ("CO VENANTS",
// "HAGG AI"), so also compare with every space removed.
const DESPACED = new Map();
for (const [k, v] of [...CANON, ...Object.entries(ALIASES)]) {
  DESPACED.set(k.replace(/\s+/g, ""), v);
}
DESPACED.set("PSALM", "Psalms");

const canonical = (raw) => {
  if (!raw) return null;
  const key = raw.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim().toUpperCase();
  return (
    CANON.get(key) ||
    ALIASES[key] ||
    CANON.get(key.replace(/-/g, "—")) ||
    DESPACED.get(key.replace(/\s+/g, "")) ||
    DESPACED.get(key.replace(/\s+/g, "").replace(/-/g, "—")) ||
    null
  );
};

// "391 1 SAMUEL 7:11–8:13" and "3841 SAMUEL 2:5–21" both mean 1 Samuel: the page
// number runs straight into a book number. Try both splits and keep whichever
// resolves to a real book.
function bookOfSegment(seg, stripPageNo) {
  let s = seg.replace(/\s+/g, " ").trim().replace(/\s*\d+\s*[:.]\s*\d+.*$/, "");
  s = s.replace(/\s*\d+\s*$/, "");
  if (!stripPageNo) return canonical(s);
  const digits = s.match(/^(\d+)\s*/);
  if (!digits) return canonical(s);
  const rest = s.slice(digits[0].length);
  return canonical(rest) || (digits[1].length > 1 ? canonical(`${digits[1].slice(-1)} ${rest}`) : null);
}

const firstChapter = (seg) => {
  const m = seg.match(/(\d+)\s*[:.]\s*\d+/);
  return m ? Number(m[1]) : null;
};

// A page can straddle two books ("343 JOSHuA 24:28–JuDGES 1:7"). Return both so
// each chapter heading on the page can be attributed to the right one —
// otherwise chapter 1 of the incoming book is filed under the outgoing one.
function parseHead(head) {
  if (!head) return null;
  const s = head.replace(/\s+/g, " ").trim();
  const [left, right = ""] = s.split(/[–—]/);
  const first = bookOfSegment(left, true);
  const second = right ? bookOfSegment(right, false) : null;
  return {
    first,
    second: second && second !== first ? second : null,
    secondStart: right ? firstChapter(right) : null,
  };
}

const PY = String.raw`
import json, re, sys
from pypdf import PdfReader

# "CHAPTER 12", "SECTION 76", "PSALM 23" — tolerant of the small-caps casing
# the extractor emits (e.g. "CHAPTEr").
HEAD = re.compile(r"(?:CHAPTER|SECTION|PSALM)\s*(\d+)", re.I)

out = []
for path in sys.argv[1:]:
    reader = PdfReader(path)
    for pno, page in enumerate(reader.pages):
        runs = []
        def visit(text, cm, tm, font_dict, font_size, runs=runs):
            if not text or not text.strip():
                return
            runs.append((text, str((font_dict or {}).get("/BaseFont", "") or "")))
        try:
            text = page.extract_text(visitor_text=visit) or ""
        except Exception:
            continue

        # Rebuild the page from the runs so headings and italic blocks share one
        # coordinate space, then pair each heading with the italic block that
        # FOLLOWS it. Pairing by index instead would mis-assign chapter 1 on a
        # book's opening page, where the book's own introduction is the first
        # italic block on the page.
        full, spans, pos = [], [], 0
        for t, font in runs:
            full.append(t)
            spans.append((pos, pos + len(t), font))
            pos += len(t)
        full = "".join(full)

        blocks, cur, start = [], [], None
        for s, e, font in spans:
            if font.endswith("-Italic") or font.endswith("-italic"):
                if start is None:
                    start = s
                cur.append(full[s:e])
            elif cur:
                blocks.append((start, "".join(cur)))
                cur, start = [], None
        if cur:
            blocks.append((start, "".join(cur)))
        blocks = [b for b in blocks if len(b[1].strip()) >= 40]

        # Verse 1 opens with a drop cap set in the display face, and the rest of
        # that first word continues in caps. The display face is also used for
        # book titles, but those carry the -Medium weight — so a plain
        # CentaurMTldsDsp run marks exactly where a chapter's text begins, and
        # the italic block just before it is that chapter's summary. This holds
        # even where no "CHAPTER 1" is printed, as in single-chapter books.
        caps, titles = [], []
        for (s, e, font) in spans:
            if "CentaurMTldsDsp" not in font:
                continue
            if font.endswith("-Medium"):
                titles.append([s, full[s:e]])
            elif len(full[s:e].strip()) == 1:
                caps.append(s)

        pairs = []
        for m in HEAD.finditer(full):
            word = m.group(0)
            letters = [c for c in word if c.isalpha()]
            # Headings are set in caps; skip the word "chapter" in running prose.
            if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.6:
                continue
            nxt = next((b for b in blocks if b[0] >= m.end()), None)
            if nxt:
                pairs.append([m.group(1), nxt[1]])

        # Every page is emitted, including those with no chapter heading: a
        # single-chapter book (Enos, Jude, Obadiah…) prints no "CHAPTER 1", so
        # its summary is only reachable as a loose italic block.
        out.append({
            "head": text.split("\n")[0],
            "pairs": pairs,
            "blocks": [[b[0], b[0] + len(b[1]), b[1]] for b in blocks],
            "caps": caps,
            "titles": titles,
        })
    print("  read %d pages from %s" % (len(reader.pages), path), file=sys.stderr)

json.dump(out, sys.stdout)
`;

// PAGES_CACHE=<file> reuses a previous parse instead of re-reading the PDFs,
// which makes iterating on the rules below seconds rather than minutes.
let pages;
if (process.env.PAGES_CACHE && existsSync(process.env.PAGES_CACHE)) {
  console.error(`Using cached parse: ${process.env.PAGES_CACHE}`);
  pages = JSON.parse(readFileSync(process.env.PAGES_CACHE, "utf8"));
} else {
  console.error("Reading PDFs (this takes a minute)…");
  const raw = execFileSync("python3", ["-c", PY, ...pdfs], {
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  pages = JSON.parse(raw.toString());
  if (process.env.PAGES_CACHE) writeFileSync(process.env.PAGES_CACHE, JSON.stringify(pages));
}

const FUNCTION_WORDS = new Set(
  ("a an the be to of in on at is it as by he we so no or up us do if my me and are was for not but all out who " +
   "had has him her his its one two six ye thy thee thou shall will may can that this they them their from with " +
   "into unto upon over when what which then than there here were been have does did such more most")
    .split(" ")
);

// Justified type makes the extractor drop spaces inside words ("chil dren",
// "thr ough"). Rejoin a pair only when the dictionary confirms the merged form
// is a word — and never across a function word: web2 has no inflected forms
// ("held", "paid", "excels" are all absent), so "be held" would become "beheld".
let DICT = null;
try {
  DICT = new Set(
    readFileSync("/usr/share/dict/words", "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean)
  );
} catch {
  console.error("note: /usr/share/dict/words not found - skipping word repair.");
}

const merges = new Map();
const bareWord = (x) => x.replace(/[^A-Za-z\u2019']/g, "").replace(/[\u2019']s$/i, "");

// web2 lists only headwords, so "verses" and "ponders" look like non-words and a
// footnote marker beside them would be merged in. Strip common inflections
// before deciding whether a token is a real word.
function looksReal(x) {
  if (!DICT || !x) return false;
  const w = x.toLowerCase();
  if (DICT.has(w) || FUNCTION_WORDS.has(w)) return true;
  for (const stem of [w.replace(/s$/, ""), w.replace(/es$/, ""), w.replace(/ed$/, ""),
                      w.replace(/ing$/, ""), w.replace(/ies$/, "y"), w.replace(/eth$/, "")]) {
    if (stem !== w && stem.length >= 3 && DICT.has(stem)) return true;
  }
  return false;
}

// A line-break hyphen that survived with no space after it ("Amu-lek",
// "miracu-lously"). Join only when neither side is a word on its own, so real
// compounds — "Latter-day", "Anti-Nephi-Lehies" — keep their hyphen.
function mendHyphens(s) {
  if (!DICT) return s;
  return s.replace(/\b([A-Za-z]{2,})-([a-z]{2,})\b/g, (whole, l, r) =>
    looksReal(l) || looksReal(r) ? whole : l + r
  );
}

// Verified by eye against the printed page; no general rule resolves these
// safely (a proper noun the dictionary doesn't know, or a space dropped between
// two real words).
const CORRECTIONS = [
  [/\bselfev ident\b/g, "self evident"],
  [/\bAmmoni-ha h\b/g, "Ammonihah"],
  [/\bAmu-lek\b/g, "Amulek"],          // "lek" is a currency in web2, so the hyphen survives
  [/\bpreeart h\b/g, "preearth"],
  [/\bJosephF\./g, "Joseph F."],
  // "t he" is never valid English, but the merge pass can't fix it: "he" is a
  // function word, and exempting those would let "h and" become "hand".
  [/\bt he\b/g, "the"],
];

function repair(s) {
  if (!DICT) return s;
  const parts = s.split(" ");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const a = parts[i];
    const b = parts[i + 1];
    if (!b) { out.push(a); continue; }
    const sa = bareWord(a);
    const sb = bareWord(b);
    // Two standalone words that happen to concatenate into a third are a
    // legitimate phrase, not a split word \u2014 "under heaven", "go back" and
    // "man go" must survive. Only a 1-letter fragment is exempt.
    const bothReal =
      sa.length >= 2 && sb.length >= 2 && DICT.has(sa.toLowerCase()) && DICT.has(sb.toLowerCase());

    // A lone letter can be a broken-off prefix ("false r eports") or a footnote
    // marker that leaked into the block ("h and"). They differ by what follows:
    // a prefix is followed by a fragment, a marker by a whole word. "a", "I" and
    // the vocative "O" are words in their own right and never merge.
    const realNext = looksReal(sb);
    const stray = (x, tok) => x.length === 1 && !/^[aio]$/i.test(x) && !/[.,;:!?)"”]$/.test(tok);
    if (stray(sa, a) && !realNext) {
      const joined = a + b;
      const key = `${a} ${b} -> ${joined}`;
      merges.set(key, (merges.get(key) || 0) + 1);
      out.push(joined);
      i++;
      continue;
    }

    // A stray letter attaches to whichever side needs it. If the token after it
    // is already a whole word the letter cannot belong there, so it must close
    // the word before: "Smit h in" is "Smith in", while "false r eports" is
    // "false reports". Only hold off when the letter is genuinely rightbound.
    const after = parts[i + 2];
    const strayB = stray(sb, b);
    // Both directions can yield a real word — "Smit h in" gives Smith or hin,
    // "to t he" gives tot or the. Prefer the right when the left is not a word,
    // or when the right forms a function word: "the" beats "tot", while "Smith"
    // beats "hin" (a Hebrew liquid measure that web2 happens to list).
    const rightWord = (sb + bareWord(after || "")).toLowerCase();
    const leftWord = (sa + sb).toLowerCase();
    const preferRight =
      sb.length <= 2 && after && DICT.has(rightWord) &&
      (!DICT.has(leftWord) || FUNCTION_WORDS.has(rightWord));

    const bindsRight = (strayB && !looksReal(bareWord(after || ""))) || preferRight;

    // The function-word guard protects phrases like "be held"; it must not block
    // a single stray letter, or "an d verses" can never become "and verses".
    const functionBlocked =
      (FUNCTION_WORDS.has(sa.toLowerCase()) && !strayB) || FUNCTION_WORDS.has(sb.toLowerCase());

    if (
      sa && sb && !bothReal && !bindsRight && !functionBlocked &&
      !/[.,;:!?\u2014\u2013)"\u201d]$/.test(a) &&
      DICT.has((sa + sb).toLowerCase())
    ) {
      const joined = a.replace(/[-\u00ad]$/, "") + b;
      const key = a + " " + b + " -> " + joined;
      merges.set(key, (merges.get(key) || 0) + 1);
      out.push(joined);
      i++;
      continue;
    }
    out.push(a);
  }
  return out.join(" ");
}

const clean = (s) =>
  repair(
    s
      .replace(/[   ]/g, "")   // hair/thin spaces between letters
      .replace(/\u00ad\s*/g, "")                 // soft hyphens from justified text
      .replace(/-\s+(?=[a-z])/g, "")          // rejoin words hyphenated across lines
      .replace(/\s+/g, " ")
    .trim()
  );

// Hyphen mending and the verified corrections run last, on settled text.
const finish = (s) => CORRECTIONS.reduce((acc, [re, to]) => acc.replace(re, to), mendHyphens(clean(s)));

// A book's opening page carries no running head — it shows the book title
// instead — so the book must be filled in from the NEXT page that has one.
// Carrying the *previous* page's book forward instead silently files chapter 1
// of every book under the book before it (Exodus 1 landing on Genesis 1).
const heads = pages.map((p) => parseHead(p.head));
const bookPerPage = heads.map((h) => h?.first || null);
for (let i = bookPerPage.length - 2; i >= 0; i--) {
  if (!bookPerPage[i]) bookPerPage[i] = bookPerPage[i + 1];
}

const summaries = {};
const used = new Set();          // blocks already claimed, so the fallback below can't reuse one
let found = 0;
let unpaired = 0;
const unmatchedHeads = new Map();

pages.forEach(({ head, pairs }, idx) => {
  const currentBook = bookPerPage[idx];
  if (!currentBook) {
    if (head && /[A-Za-z]{3}/.test(head)) {
      const g = head.replace(/\s+/g, " ").trim().slice(0, 40);
      unmatchedHeads.set(g, (unmatchedHeads.get(g) || 0) + 1);
    }
    return;
  }

  const span = heads[idx];
  for (const [num, block] of pairs) {
    const text = finish(block);
    if (!text || text.length < 25) { unpaired++; continue; }
    // On a page that straddles two books, only a heading at (or just past) the
    // second book's first chapter belongs to it. An unbounded ">=" would drag
    // the outgoing book's high chapters across too — "PSALM 149:5–PROVERBS 1:11"
    // would file Psalms 149 and 150 under Proverbs.
    const n = Number(num);
    const book =
      span?.second && span.secondStart != null && n >= span.secondStart && n <= span.secondStart + 1
        ? span.second
        : currentBook;
    (summaries[book] ||= {});
    if (!summaries[book][num]) { summaries[book][num] = text; found++; used.add(block); }
  }
});

// A book's own title is set in the display face at -Medium weight, its first
// verse opens with a drop cap in that same face at normal weight, and the
// summary is the italic block between them. That sequence identifies chapter 1
// outright — no running head, no "CHAPTER 1", no guessing which book a loose
// block belongs to. It is how single-chapter books (Jude, Obadiah, 2-3 John…)
// print their summary, and it is unambiguous even on a page shared by two books.
// Titles print the book name in words ("The First Book of Samuel", "The Book of
// Enos"), and the extractor sprinkles spaces through them. Match on the letters
// alone, by suffix, and let a spelled-out ordinal choose between 1/2/3 Samuel.
const ORDINALS = [["FIRST", "1"], ["SECOND", "2"], ["THIRD", "3"], ["FOURTH", "4"]];
const flatten = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const BY_BASE = new Map();
for (const b of BOOK_INDEX) {
  const key = flatten(b.n.replace(/^[1-4]\s+/, ""));
  if (!BY_BASE.has(key)) BY_BASE.set(key, []);
  BY_BASE.get(key).push(b.n);
}

function bookFromTitle(raw) {
  const flat = flatten(raw);
  if (!flat) return null;

  // Longest matching suffix wins, so "SOLOMONSSONG" beats "SONG".
  let bestKey = null;
  for (const key of BY_BASE.keys()) {
    if (key && flat.endsWith(key) && (!bestKey || key.length > bestKey.length)) bestKey = key;
  }
  if (!bestKey) return canonical(raw);

  const candidates = BY_BASE.get(bestKey);
  if (candidates.length === 1) return candidates[0];

  const ord = ORDINALS.find(([word]) => flat.includes(word));
  if (ord) {
    const hit = candidates.find((n) => n.startsWith(ord[1] + " "));
    if (hit) return hit;
  }
  // "The Gospel According to St John" has no ordinal: that is plain John.
  return candidates.find((n) => !/^[1-4] /.test(n)) || candidates[0];
}

let recovered = 0;
// The Articles of Faith are a numbered list, not a narrative chapter, and carry
// no summary in print.
const NO_SUMMARY = new Set(["Articles of Faith"]);

for (const [pageIdx, page] of pages.entries()) {
  const nextPage = pages[pageIdx + 1];
  const titles = page.titles || [];
  const blocks = page.blocks || [];
  const caps = page.caps || [];
  if (!titles.length || !blocks.length || !caps.length) continue;

  // Titles arrive as several runs ("THE GENERAL EPISTLE OF" then "JUDE");
  // stitch adjacent ones so the book name is whole.
  const merged = [];
  for (const [off, txt] of titles) {
    const last = merged[merged.length - 1];
    if (last && off - last.end < 6) { last.text += " " + txt; last.end = off + txt.length; }
    else merged.push({ start: off, end: off + txt.length, text: txt });
  }

  for (const title of merged) {
    const book = bookFromTitle(title.text);
    if (!book || NO_SUMMARY.has(book) || summaries[book]?.["1"]) continue;

    // The summary is the italic block that runs straight into a drop cap.
    // Prefer one printed after the title, but the content stream sometimes
    // emits the title last (1 Samuel), so fall back to the first such block.
    const abuts = ([bs, be]) => caps.some((c) => c >= be - 2 && c - be < 60);
    // A summary can end its page with verse 1 opening overleaf (Alma, 3 Nephi),
    // so a trailing block also counts when the next page starts with a drop cap.
    const nextStartsWithCap = (nextPage?.caps || []).some((c) => c < 80);
    const isLast = (b) => blocks.indexOf(b) === blocks.length - 1;
    const ok = (b) => abuts(b) || (isLast(b) && nextStartsWithCap);
    const blk = blocks.find((b) => b[0] >= title.end && ok(b)) || blocks.find(ok);
    if (!blk) continue;

    const text = finish(blk[2]);
    if (text.length < 25) continue;
    (summaries[book] ||= {});
    summaries[book]["1"] = text;
    used.add(blk[2]);
    found++;
    recovered++;
  }
}

// Supplied by hand for the few chapters the PDFs don't yield: Solomon's Song
// and Isaiah 23 sit on pages whose layout defeats the drop-cap rule, and the
// rest open a book on a shared spread. Applied only where a chapter is still
// missing, so a better extraction would take precedence.
const MANUAL = {
  "Solomon's Song": {
    "1": "The bride and bridegroom express their love for each other.",
    "2": "The bridegroom speaks of his love for the bride\u2014The bride describes her beloved.",
    "6": "The bridegroom describes the beauty of the bride.",
    "7": "The bridegroom praises the beauty of the bride.",
    "8": "Love is strong as death\u2014Many waters cannot quench love.",
  },
  Isaiah: {
    "23": "Tyre will be laid waste\u2014Her trade and merchandise will be forgotten for seventy years, then restored.",
  },
  "1 John": {
    "2": "We know God by keeping His commandments\u2014Love not the world\u2014Antichrists will come in the last days.",
    "5": "Saints are born of God through belief in Christ\u2014There are three that bear record in heaven and three on earth\u2014Believers have eternal life.",
  },
  "3 Nephi": {
    "1": "Nephi, the son of Helaman, departs out of the land, and his son Nephi keeps the records\u2014Though signs and wonders abound, the wicked plan to slay the righteous\u2014The night of Christ\u2019s birth arrives\u2014The sign is given, and a new star arises\u2014Lies and deceits increase, and the Gadianton robbers slaughter many.",
  },
};

let manualAdded = 0;
for (const [book, chapters] of Object.entries(MANUAL)) {
  for (const [ch, text] of Object.entries(chapters)) {
    if (summaries[book]?.[ch]) continue;
    (summaries[book] ||= {});
    summaries[book][ch] = text;
    found++;
    manualAdded++;
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ label: "Chapter summary", summaries }, null, 1) + "\n");

console.error(`\nExtracted ${found} summaries across ${Object.keys(summaries).length} books.`);
if (recovered) console.error(`${recovered} recovered from a book's opening page (no CHAPTER heading).`);
if (manualAdded) console.error(`${manualAdded} supplied by hand (see MANUAL in this script).`);
if (unpaired) console.error(`${unpaired} heading(s) had no italic block to pair with.`);
if (merges.size) {
  const n = [...merges.values()].reduce((a, b) => a + b, 0);
  console.error(`\nRejoined ${n} split word(s) using /usr/share/dict/words:`);
  for (const [k, c] of [...merges].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.error(`  ${String(c).padStart(3)}x  ${k}`);
  }
  if (merges.size > 10) console.error(`  …and ${merges.size - 10} more`);
}
if (unmatchedHeads.size) {
  console.error("\nRunning heads that did not map to a book:");
  for (const [h, n] of [...unmatchedHeads].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.error(`  ${String(n).padStart(4)}×  ${JSON.stringify(h)}`);
  }
}
console.error(`\nWrote ${OUT}`);
console.error("Now run:  npm run check:summaries\n");
