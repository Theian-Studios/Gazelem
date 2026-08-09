// Turns the citation strings in the notes ("2 Ne. 9:7", "Philip. 2:12–13") into
// something the reader can look up, and fetches the passage text on demand.
import { BOOK_INDEX } from "../data/bookIndex.js";
import { VOLUMES } from "../data/volumes.js";
import { loadVolume, getCached } from "./api.js";

// Every abbreviation that appears in the commentary, plus the obvious siblings.
const ABBREV = {
  "gen.": "Genesis", "ex.": "Exodus", "lev.": "Leviticus", "num.": "Numbers",
  "deut.": "Deuteronomy", "josh.": "Joshua", "judg.": "Judges", "ps.": "Psalms",
  "prov.": "Proverbs", "eccl.": "Ecclesiastes", "isa.": "Isaiah", "jer.": "Jeremiah",
  "lam.": "Lamentations", "ezek.": "Ezekiel", "dan.": "Daniel", "hosea": "Hosea",
  "amos": "Amos", "obad.": "Obadiah", "jonah": "Jonah", "micah": "Micah",
  "mal.": "Malachi", "zech.": "Zechariah",
  "hos.": "Hosea",
  "matt.": "Matthew", "mark": "Mark", "luke": "Luke", "john": "John",
  // The clipped forms the charts cite parallels in — "(Mk 9:19; Lk 9:41)".
  "mt.": "Matthew", "mk.": "Mark", "lk.": "Luke", "jn.": "John",
  "acts": "Acts", "rom.": "Romans", "1 cor.": "1 Corinthians", "2 cor.": "2 Corinthians",
  "gal.": "Galatians", "eph.": "Ephesians", "philip.": "Philippians", "phil.": "Philippians",
  "col.": "Colossians", "1 thes.": "1 Thessalonians", "2 thes.": "2 Thessalonians",
  "1 tim.": "1 Timothy", "2 tim.": "2 Timothy", "titus": "Titus", "philem.": "Philemon",
  "heb.": "Hebrews", "james": "James", "1 pet.": "1 Peter", "2 pet.": "2 Peter",
  "1 jn.": "1 John", "2 jn.": "2 John", "3 jn.": "3 John", "jude": "Jude", "rev.": "Revelation",
  "1 sam.": "1 Samuel", "2 sam.": "2 Samuel", "1 kgs.": "1 Kings", "2 kgs.": "2 Kings",
  "1 chr.": "1 Chronicles", "2 chr.": "2 Chronicles", "neh.": "Nehemiah", "esth.": "Esther",
  "song of sol.": "Solomon's Song",
  "hab.": "Habakkuk", "zeph.": "Zephaniah", "hag.": "Haggai",
  "1 ne.": "1 Nephi", "2 ne.": "2 Nephi", "jacob": "Jacob", "enos": "Enos",
  "jarom": "Jarom", "omni": "Omni", "w of m": "Words of Mormon", "mosiah": "Mosiah",
  "alma": "Alma", "hel.": "Helaman", "3 ne.": "3 Nephi", "4 ne.": "4 Nephi",
  "morm.": "Mormon", "ether": "Ether", "moro.": "Moroni",
  "d&c": "Doctrine and Covenants", "dc": "Doctrine and Covenants",
  "moses": "Moses", "abr.": "Abraham", "abraham": "Abraham",
  "js—m": "Joseph Smith—Matthew", "js—h": "Joseph Smith—History", "a of f": "Articles of Faith",
  // Singular forms people write when naming one chapter of a plural book.
  "psalm": "Psalms", "song of solomon": "Solomon's Song",
};

const BY_NAME = new Map(BOOK_INDEX.map((b) => [b.n.toLowerCase(), b]));

// One spelling out of however many ways the same name gets typed: the dashes of
// "JS—H" and the apostrophe of "Solomon's Song" each have three characters in
// common use, and which one a file happens to carry is not a difference between
// books.
const normalize = (raw) =>
  raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/[’]/g, "'").replace(/[—–-]/g, "—");

export function resolveBook(raw) {
  const key = normalize(raw);
  const name = ABBREV[key] || ABBREV[`${key}.`] || null;
  if (name) return BY_NAME.get(name.toLowerCase()) || null;
  return BY_NAME.get(key) || BY_NAME.get(key.replace(/\.$/, "")) || null;
}

// Every spelling of a book name this file answers to, longest first — so
// "Words of Mormon" is read as itself rather than as the Mormon at the end of
// it. The scanner in cites.js builds its pattern out of this rather than
// guessing at the shape of a name, which is what keeps what it finds and what
// the resolver accepts the same set.
export const BOOK_SPELLINGS = [...BOOK_INDEX.map((b) => b.n), ...Object.keys(ABBREV)]
  .sort((a, b) => b.length - a.length);

// "11–12", "4, 30", "18" → [11, 12] / [4, 30] / [18]
export function expandVerses(spec) {
  const out = [];
  for (const part of String(spec).split(",")) {
    const m = part.trim().match(/^(\d+)\s*[–—-]\s*(\d+)$/);
    if (m) {
      for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
      continue;
    }
    const one = part.trim().match(/^(\d+)/);
    if (one) out.push(Number(one[1]));
  }
  return out;
}

// "Alma 1:13–14, 18; Alma 10–11" → one entry per citation that names a chapter
// and verses. Chapter-only citations are kept without verses.
export function parseCitations(source) {
  const cites = [];
  let lastBook = null;
  for (const chunk of String(source).split(";")) {
    const s = chunk.trim();
    if (!s) continue;
    const m = s.match(/^((?:[1-4]\s+)?[A-Za-z][A-Za-z.&—–'’\s]*?)\s*(\d[\d\s:,–—-]*)$/);
    let bookRaw = m ? m[1] : null;
    let nums = m ? m[2] : s;
    // "Alma 5:21, 27" then a bare "13:11–12" continues the same book.
    const book = bookRaw ? resolveBook(bookRaw) : lastBook;
    if (!book) continue;
    lastBook = book;
    const withVerses = nums.match(/^(\d+)\s*:\s*([\d\s,–—-]+)$/);
    if (withVerses) {
      cites.push({ book, chapter: Number(withVerses[1]), verses: expandVerses(withVerses[2]), label: s });
    } else {
      const ch = nums.match(/^(\d+)/);
      if (ch) cites.push({ book, chapter: Number(ch[1]), verses: [], label: s });
    }
  }
  return cites;
}

// The chapter's own verses named on the right of the arrow ("34:11–12").
export function targetVerses(target, chapterN) {
  const out = new Set();
  const re = /(\d+)\s*:\s*([\d\s,–—-]+)/g;
  let m;
  while ((m = re.exec(String(target)))) {
    if (Number(m[1]) !== chapterN) continue;
    for (const v of expandVerses(m[2])) out.add(v);
  }
  return [...out];
}

// Loads (and caches) the passage text. Returns [] for anything unresolvable
// rather than throwing — a missing cross-reference must not break the reader.
export async function loadPassage({ book, chapter, verses }) {
  const vol = VOLUMES.find((v) => v.id === book.v);
  if (!vol) return [];
  let data = getCached(vol.id);
  if (!data) {
    try { data = await loadVolume(vol); } catch { return []; }
  }
  const entry = vol.id === "dc" ? data[0] : data.find((b) => b.name === book.n);
  if (!entry) return [];
  const ch = entry.chapters.find((c) => c.n === chapter);
  if (!ch) return [];
  const wanted = verses.length ? new Set(verses) : null;
  return ch.verses
    .filter((v) => !wanted || wanted.has(v.verse))
    .slice(0, 12) // a whole chapter would swamp the popup
    .map((v) => ({ verse: v.verse, text: v.text }));
}
