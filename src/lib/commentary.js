// Study notes live as JSON in src/data/commentary, one file per chapter
// (`09-alma-32-notes.json`). The file is written by whoever writes the notes and
// is already the shape the notes have — sections named for the depth they read
// at, an entry list for the cross connections — where the earlier markdown had
// to be recovered from headings, bold leads and bullet indentation.
//
// What is left here is the mapping from that shape to the one the panel wants:
//
//   words / phrases / verses / chapter  →  Level of Analysis
//   world_behind / world_in_front       →  the two framing worlds
//   entries                             →  the connection index, grouped by scope
//
// Each entry's scope names how far afield it reaches — BOOK (elsewhere in this
// book), BOM, SW — and every scope is shown.
//
// A chapter's notes are fetched when that chapter is opened, and not before.
// Vite gives each file a chunk of its own, so the reader of 1 Nephi 1 downloads
// 1 Nephi 1 — where inlining the corpus put every chapter ever written into the
// first paint of the site, and the whole Book of Mormon would eventually be the
// price of opening any page of it.
import { useEffect, useState } from "react";
import { targetVerses } from "./refs.js";

const FILES = import.meta.glob("../data/commentary/*.json", { import: "default" });

// "1 Nephi" → "1-nephi", so a file is found as `<book>-<chapter>.json`.
export const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The same name with the separators taken out, for asking whether two spellings
// of a book are the same book. A file may call 1 Nephi "1nephi" or "1-nephi" —
// its own metadata writes one and the reader's reference makes the other, and a
// chapter matched on the exact spelling was a chapter that never loaded.
const bookKey = (s) => slug(s).replace(/-/g, "");

const SCOPES = ["BOOK", "BOM", "SW"];

// ---- The depth sections ----------------------------------------------------
//
// Every note reads the same way on screen — a heading, then prose — so all four
// sections become the one entry shape the card draws: { title, body, items,
// underlines }. What differs between them is only how the heading is written,
// which is what the makers below say.

// The quotations a note makes are pinned to exact runs of words in the verse,
// which is how a note is checked against the text. Nothing draws them at the
// moment (see underlinesByVerse), but they are the note's anchors and are kept.
const underlinesOf = (cites, chapterN) =>
  (cites || []).flatMap((c) =>
    (c.spans || []).map((s) => ({ chapter: chapterN, verse: c.verse, words: [s.w1, s.w2] }))
  );

// Everything a note's prose points at, in reading order. The text is flat —
// no markdown, nothing to interpret — and every reference in it is already
// located by character offset, so the site never reads the prose to find them.
// `cites` are this chapter quoted ("the words" (v. 11)) and `refs` are bare
// references; the two never overlap, so one list serves.
const marksOf = (e) =>
  [
    ...(e.cites || []).map((c) => ({ kind: "cite", start: c.start, end: c.end, verse: c.verse })),
    ...(e.refs || []),
  ].sort((a, b) => a.start - b.start);

const entryOf = (title, e, chapterN) => ({
  title,
  body: e.text ? [{ text: e.text, marks: marksOf(e) }] : [],
  items: [],
  underlines: underlinesOf(e.cites, chapterN),
});

// A word or a phrase is headed by the string itself, quoted as the chapter
// spells it, and then by the verses it stands in: "compelled" (v. 13–16, 25).
const termEntry = (e, chapterN) =>
  entryOf(`"${e.term}"${e.verse_label ? ` (${e.verse_label})` : ""}`, e, chapterN);

// A verse note is named, and then says which verses it reads — "The turn
// (v. 6)". The name is what the note is about and the label is where to find it,
// which is the order every other heading in the panel puts them in.
const verseEntry = (e, chapterN) =>
  entryOf([e.title, e.label && `(${e.label})`].filter(Boolean).join(" "), e, chapterN);

// Chapter notes are numbered, and the number is part of the heading: the notes
// are written as a sequence and refer to one another by it.
const numberedEntry = (e, chapterN) =>
  entryOf([e.n, e.title].filter((p) => p != null).join(". "), e, chapterN);

// ---- The two framing worlds ------------------------------------------------

// Behind the text is one run of numbered notes under no heading of its own.
const worldBehind = (doc, chapterN) => {
  const entries = (doc.world_behind || []).map((e) => numberedEntry(e, chapterN));
  return entries.length ? [{ heading: null, entries }] : [];
};

// In front of it are two: the applications, written like any other note, and the
// reflection questions, which are a list rather than prose and are drawn as one
// — each question carrying the verses it asks about, the way the notes' own
// bullets carried them.
const worldFront = (doc, chapterN) => {
  const out = [];
  const apps = (doc.world_in_front?.applications || []).map((a) =>
    entryOf(`${a.title}${a.verse_label ? ` (${a.verse_label})` : ""}`, a, chapterN)
  );
  if (apps.length) out.push({ heading: "Applications", entries: apps });

  const questions = (doc.world_in_front?.questions || []).map((q) =>
    `${q.verse_label ? `(${q.verse_label}) ` : ""}${q.text}`
  );
  if (questions.length) {
    out.push({
      heading: "Self-reflection questions",
      entries: [{ title: "", body: [], items: questions, underlines: [] }],
    });
  }
  return out;
};

// ---- The chapter's own description -----------------------------------------

// The overview card reads a field either as prose or as a list, so what is one
// value in the file — a lone audience, a list of speakers — is handed over in
// whichever of the two it already is.
const asText = (v) => (v ? { text: String(v), items: [] } : null);
const asList = (v) =>
  Array.isArray(v) && v.length
    ? { text: "", items: v.map((t) => ({ text: String(t), children: [] })) }
    : null;

function metaOf(meta) {
  if (!meta) return null;
  const out = {
    speakers: asList(meta.speakers),
    audience: asText(meta.audience),
    location: asText(meta.location),
    principles: asList(meta.principles),
  };
  const kept = Object.entries(out).filter(([, g]) => g);
  return kept.length ? Object.fromEntries(kept) : null;
}

// ---- The connection index --------------------------------------------------

// An entry names two places: the run of words here that carries it, and the
// passage elsewhere it points at. Both ends travel together — the anchor marks
// the text and puts a letter in its margin, the head opens the other passage.
//
// The letters come off the file's `markers`, which is the anchors already
// grouped: one element per distinct run of words, listing every entry hanging
// on it. Several entries on one run is normal and wanted — a phrase answered in
// three later places is one phrase with three answers — and lettering them one
// apiece is what stacks superscripts in the margin. So the letter belongs to
// the run, and the entries under it share it.
const markersOf = (doc) => {
  if (doc.markers?.length) return doc.markers;
  // A file written before the grouping was precomputed. Spans within a verse
  // are identical or disjoint, never partly overlapping, so grouping them is a
  // plain equality check.
  const by = new Map();
  for (const e of doc.entries || []) {
    if (!e.anchor) continue;
    const { verse, w1, w2, quote } = e.anchor;
    const key = `${verse}|${w1}|${w2}`;
    if (!by.has(key)) by.set(key, { verse, w1, w2, quote, entries: [] });
    by.get(key).entries.push(e.id);
  }
  return [...by.values()].sort((a, b) => a.verse - b.verse || a.w1 - b.w1);
};

function connectionsOf(doc) {
  const chapterN = doc.meta?.chapter ?? null;
  const byId = new Map((doc.entries || []).map((e) => [e.id, e]));
  const out = {};
  // Footnote letters in scripture style: every marker on a verse takes the next
  // letter in the file's own order, so 16a/16b read the way a printed footnote
  // does and stay put when the notes are written out again.
  let verse = null;
  let n = 0;
  for (const m of markersOf(doc)) {
    if (m.verse !== verse) { verse = m.verse; n = 0; }
    const id = `${m.verse}${String.fromCharCode(97 + n)}`;
    n++;
    for (const eid of m.entries || []) {
      const e = byId.get(eid);
      if (!e) continue;
      const scope = SCOPES.includes(e.scope) ? e.scope : SCOPES[0];
      (out[scope] ||= []).push({
        id,
        // The one the notes gave it: unique where the letter is shared, and
        // stable across every regeneration of the file.
        noteId: e.id,
        // The words the row is known by, which is also what tells two
        // connections apart when the reader's verse is cut into segments.
        text: [e.head, e.reason].filter(Boolean).join(" — "),
        source: e.head || "",
        chapter: chapterN,
        verse: m.verse,
        words: [m.w1, m.w2],
        quote: m.quote || e.anchor?.quote || "",
        gloss: e.reason || "",
        // The wording the two places share is quoted by the targets themselves,
        // so there is nothing to lift back out of the gloss.
        snippet: null,
        // Where the other end is, and which run of it answers this one — the
        // popup shows that run rather than the verse from its beginning.
        targets: (e.targets || []).map((t) => ({
          label: [t.ref, [t.chapter, t.verse].filter((v) => v != null).join(":")]
            .filter(Boolean).join(" ").trim(),
          chapter: t.chapter ?? null,
          verse: t.verse ?? null,
          words: t.w1 != null ? [t.w1, t.w2 ?? t.w1] : null,
          quote: t.quote || "",
        })),
        target: `${chapterN}:${m.verse}`,
      });
    }
  }
  return out;
}

export function parseCommentary(doc) {
  if (!doc) return null;
  const chapterN = doc.meta?.chapter ?? null;

  const levels = {
    Word: (doc.words || []).map((e) => termEntry(e, chapterN)),
    Phrase: (doc.phrases || []).map((e) => termEntry(e, chapterN)),
    Verse: (doc.verses || []).map((e) => verseEntry(e, chapterN)),
    // The chapter section is the coarsest the file writes. Its closing notes do
    // what a block level would have — the chapter's place in its unit, and what
    // it hands the chapters downstream — which is why there is no level over it.
    Chapter: (doc.chapter || []).map((e) => numberedEntry(e, chapterN)),
  };

  return {
    levels,
    connections: connectionsOf(doc),
    meta: metaOf(doc.meta),
    worlds: {
      behind: worldBehind(doc, chapterN),
      front: worldFront(doc, chapterN),
    },
  };
}

// What has been fetched and parsed already, so a chapter is read once however
// many parts of the page ask for it. `null` is an answer too — a chapter with no
// notes written yet is not asked for again.
const cache = new Map();
const pending = new Map();

const keyOf = (bookName, chapterN) => `${bookKey(bookName)}-${chapterN}`;

// Which file holds a chapter, by name.
//
// `alma-34.json`, or with a trailing note like `alma-34-notes.json`, and either
// may carry a volume-order prefix (`09-alma-34-notes.json`) and pad the chapter
// to a fixed width (`04-enos-01-notes.json`). The trailing suffix must start
// with a separator so "alma-3" can't claim "alma-34.json", and the padding is
// leading zeros only, so it can't either. The separators inside the book name
// are optional for the same reason: "01-1nephi-20-notes.json" and
// "01-1-nephi-20-notes.json" name one chapter.
function pathFor(bookName, chapterN) {
  const loose = slug(bookName).replace(/-/g, "-?");
  const re = new RegExp(`/(?:\\d+[-_])?${loose}-0*${chapterN}(?:[-_][^/]*)?\\.json$`);
  return Object.keys(FILES).find((p) => re.test(p)) || null;
}

// Notes for a chapter, fetched if they have not been already. Resolves to null
// where none have been written.
export function loadCommentary(bookName, chapterN) {
  if (!bookName || chapterN == null) return Promise.resolve(null);
  const key = keyOf(bookName, chapterN);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);

  const path = pathFor(bookName, chapterN);
  if (!path) {
    cache.set(key, null);
    return Promise.resolve(null);
  }
  const p = FILES[path]()
    .then((doc) => {
      // The file says which chapter it is, and it is the one thing the name
      // cannot be trusted about — the names are written to sort in a directory
      // listing, and a misfiled one would otherwise show as another chapter's
      // notes without a word.
      if (doc?.meta && keyOf(doc.meta.book_slug, doc.meta.chapter) !== key) {
        console.warn(`${path} holds ${doc.meta.book} ${doc.meta.chapter}, not ${key}.`);
      }
      const parsed = doc ? parseCommentary(doc) : null;
      cache.set(key, parsed);
      return parsed;
    })
    .catch((err) => {
      console.warn(`Could not read the notes at ${path}.`, err);
      cache.set(key, null);
      return null;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

// Notes already in hand, without fetching any — for the parts of the page that
// cannot wait for a promise.
export const getCommentary = (bookName, chapterN) =>
  (bookName && chapterN != null && cache.get(keyOf(bookName, chapterN))) || null;

// A chapter's notes, in a component. Reads what is already in hand on the first
// render and fetches otherwise, so a chapter read a second time draws with its
// notes rather than without them and then with.
//
// `loading` is what keeps a card from saying "no notes yet" in the moment
// before the notes arrive: nothing written is a different answer from nothing
// downloaded, and only one of them is worth telling the reader about.
export function useCommentary(bookName, chapterN) {
  const key = bookName && chapterN != null ? keyOf(bookName, chapterN) : null;
  const [, redraw] = useState(0);
  const have = key ? cache.has(key) : true;

  useEffect(() => {
    if (!key || cache.has(key)) return;
    let alive = true;
    loadCommentary(bookName, chapterN).then(() => alive && redraw((n) => n + 1));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line -- the key is the book and chapter both

  return { notes: key ? cache.get(key) ?? null : null, loading: !have };
}

export { SCOPES };

// The first verse a note's title names — "(v. 9, 10, 13)", "(v. 2–6)" — or null
// for the thematic chapter notes that aren't anchored to a verse.
export function entryVerse(title) {
  const m = title?.match(/\bvv?\.\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// Connections grouped by the verse of THIS chapter they point at, so the reader
// can mark them in the margin. Entries without an anchor in the chapter have no
// verse and are left out.
export function connectionsByVerse(data, chapterN) {
  const map = new Map();
  if (!data) return map;
  const add = (v, c) => {
    if (!map.has(v)) map.set(v, []);
    map.get(v).push(c);
  };
  for (const scope of SCOPES) {
    for (const c of data.connections[scope] || []) {
      // A word-anchored entry names its verse outright; anything else falls
      // back to reading verse numbers out of the target string.
      if (c.verse != null) {
        if (c.chapter === chapterN) add(c.verse, { ...c, scope });
        continue;
      }
      for (const v of targetVerses(c.target, chapterN)) add(v, { ...c, scope });
    }
  }
  return map;
}

// Every connection, in verse order — the order the sidebar lists them and the
// order the reader scrolls past them.
export function orderedConnections(data) {
  if (!data) return [];
  return Object.entries(data.connections)
    .flatMap(([scope, list]) => list.map((c) => ({ ...c, scope })))
    .filter((c) => c.verse != null)
    .sort((a, b) => a.verse - b.verse || a.words[0] - b.words[0]);
}

// The word ranges the current level's notes underline in the reader, keyed by
// verse. Only word/phrase/verse notes carry them — a chapter note reads the
// whole, so it marks nothing.
export function underlinesByVerse(data, level, chapterN) {
  const map = new Map();
  for (const e of data?.levels?.[level] || []) {
    for (const u of e.underlines || []) {
      if (u.chapter !== chapterN) continue;
      if (!map.has(u.verse)) map.set(u.verse, []);
      map.get(u.verse).push(u.words);
    }
  }
  return map;
}

// Splits a verse into runs that share the same set of connections and the same
// underline state, so an overlapping pair ("encircles" inside "encircles them
// in the arms of safety") produces a distinct run for the overlap rather than
// nested highlights.
export function verseSegments(text, connections, underlines) {
  const byWord = new Map();
  for (const c of connections || []) {
    if (!c.words) continue;
    for (let i = c.words[0]; i <= c.words[1]; i++) {
      if (!byWord.has(i)) byWord.set(i, []);
      byWord.get(i).push(c);
    }
  }
  const uWords = new Set();
  for (const [a, b] of underlines || []) for (let i = a; i <= b; i++) uWords.add(i);
  if (!byWord.size && !uWords.size) return [{ text, connections: null, underline: false }];

  const key = (list, u) => `${u ? "u" : ""}|${list ? list.map((c) => c.text).join("|") : ""}`;
  const PLAIN = key(null, false);
  const tokens = text.split(/(\s+)/);
  const segs = [];
  let cur = null;
  let word = 0;

  const push = (part, k, conns, u) => {
    if (cur && cur.key === k) { cur.parts.push(part); return; }
    if (cur) segs.push(cur);
    cur = { key: k, conns, u, parts: [part] };
  };

  for (const t of tokens) {
    if (!t) continue;
    if (/^\s+$/.test(t)) {
      // Whitespace stays inside a run only when the next word shares it.
      const nextKey = key(byWord.get(word + 1), uWords.has(word + 1));
      const same = cur && cur.key === nextKey && nextKey !== PLAIN;
      push(t, same ? cur.key : PLAIN, same ? cur.conns : null, same ? cur.u : false);
      continue;
    }
    word++;
    const conns = byWord.get(word) || null;
    const u = uWords.has(word);
    push(t, key(conns, u), conns, u);
  }
  if (cur) segs.push(cur);
  return segs.map((s) => ({ text: s.parts.join(""), connections: s.conns, underline: s.u }));
}
