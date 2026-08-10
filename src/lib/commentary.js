// Study notes live as markdown in src/data/commentary, one file per chapter
// (`alma-34.md`). Their headings become the axis the lens panel controls:
//
//   ## DEPTH: <NAME> LEVEL   →  Level of Analysis  (BOOK reads as "Block")
//
// Cross references carry a scope tag ([ALMA] / [BOM] / [SW]) naming how far
// afield they reach; every scope is shown.
//
// Vite inlines every match at build time, so no network fetch is involved.
import { targetVerses } from "./refs.js";

const FILES = import.meta.glob("../data/commentary/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

// "1 Nephi" → "1-nephi", so a file is found as `<book>-<chapter>.md`.
export const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The same name with the separators taken out, for asking whether two spellings
// of a book are the same book. A file may call 1 Nephi "1nephi" or "1-nephi" —
// its own front matter writes one and the reader's reference makes the other,
// and a chapter matched on the exact spelling was a chapter that never loaded.
const bookKey = (s) => slug(s).replace(/-/g, "");

// A file may open with a YAML block naming the chapter it belongs to. That is
// surer than reading the name off the file: the names are written to sort in a
// directory listing — a volume-order prefix, a padded chapter number — and
// neither is part of the reference the reader arrives with.
//
// Only the two fields that answer "which chapter is this" are read. The rest of
// the block is the file describing itself for whoever is writing it; what the
// site shows comes from ## CHAPTER METADATA, which is prose and can say more
// than a YAML scalar can.
function frontMatter(md) {
  const block = md.match(/^---\r?\n([\s\S]*?)\r?\n---\s*$/m);
  if (!block) return null;
  const out = {};
  for (const line of block[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

// Built once, at module load: every file that states its own chapter, keyed the
// way a reader asks for one.
const DECLARED = new Map();
for (const [path, md] of Object.entries(FILES)) {
  const fm = frontMatter(md);
  const n = Number(fm?.chapter);
  if (!fm?.book_slug || !Number.isFinite(n)) continue;
  const key = `${bookKey(fm.book_slug)}-${n}`;
  // First wins, and the path is reported rather than silently preferred: two
  // files claiming one chapter is a mistake in the notes, not a thing to pick
  // between.
  if (DECLARED.has(key)) {
    console.warn(`Two commentary files claim ${key}; using the first.`, path);
    continue;
  }
  DECLARED.set(key, md);
}

// The UI's topmost level is labelled "Block"; the notes call it BOOK.
const DEPTH_TO_LEVEL = {
  WORD: "Word",
  PHRASE: "Phrase",
  VERSE: "Verse",
  CHAPTER: "Chapter",
  BOOK: "Block",
};

const SCOPES = ["ALMA", "BOM", "SW"];

// Strip the emphasis markers and inline scope tags; the tags are structure, not
// prose, and the panel shows scope as a chip instead.
//
// Word spans are structure too, but they cannot be taken out here: the
// connection index is parsed out of this same text, and there the span is the
// anchor itself. So this stops short of them and clean() finishes the job —
// see below.
const tidy = (s) =>
  s
    // "vv. 7–8" reads as a typo on screen; one v covers both.
    .replace(/\bvv\.\s*/g, "v. ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s*\[(ALMA|BOM|SW)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// "Jacob 7:26 w59–66 "like as it were unto us a dream,"" — the span pins the
// quotation to an exact run of words in the verse, which is how a note is
// checked against the text. Read as a sentence it is noise between a reference
// and the words it names, so it comes out of everything shown and stays in
// everything parsed.
const SPAN = /\s+w\d+(?:\s*[–—-]\s*\d+)?\b/g;
const clean = (s) => tidy(s).replace(SPAN, "");

function parseEntryBody(lines) {
  const body = [];
  const refs = [];
  const items = [];
  const underlines = [];
  let para = [];
  const flush = () => {
    const t = clean(para.join(" "));
    para = [];
    if (t) body.push(t);
  };
  // Points at the last bullet so its wrapped continuation lines rejoin it
  // instead of becoming stray paragraphs.
  let open = null;
  const extend = (line) => {
    if (open.key) open.arr[open.arr.length - 1][open.key] = clean(`${open.arr[open.arr.length - 1][open.key]} ${line}`);
    else open.arr[open.arr.length - 1] = clean(`${open.arr[open.arr.length - 1]} ${line}`);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); open = null; continue; }
    // A markdown rule separates sections in the source; it is not content.
    if (/^-{3,}$/.test(line)) { flush(); open = null; continue; }
    // "- underline: 34:9 w4 "expedient" · 34:13 w47–50 "every jot and tittle,""
    // — anchors for the reader to mark, not prose for the panel.
    const ul = line.match(/^-\s+underline:\s*(.*)$/i);
    if (ul) {
      flush();
      for (const part of ul[1].split(/\s*·\s*/)) {
        const m = part.match(/^(\d+)\s*:\s*(\d+)\s+w(\d+)(?:\s*[–—-]\s*(\d+))?/);
        if (m) underlines.push({ chapter: Number(m[1]), verse: Number(m[2]), words: [Number(m[3]), Number(m[4] ?? m[3])] });
      }
      open = null;
      continue;
    }
    const ref = line.match(/^-\s+\[(ALMA|BOM|SW)\]\s*(.*)$/);
    if (ref) { flush(); refs.push({ scope: ref[1], text: clean(ref[2]) }); open = { arr: refs, key: "text" }; continue; }
    // An untagged bullet is prose (the reflection questions), not a
    // cross-reference — giving it a scope chip would invent a scope it lacks.
    if (/^-\s+/.test(line)) { flush(); items.push(clean(line.replace(/^-\s+/, ""))); open = { arr: items, key: null }; continue; }
    // Indented under a bullet, so it belongs to that bullet.
    if (open && /^\s/.test(raw)) { extend(line); continue; }
    open = null;
    para.push(line);
  }
  flush();
  return { body, refs, items, underlines };
}

function parseSection(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Word and phrase notes are "### heading" blocks.
  if (/^###\s/m.test(trimmed)) {
    return trimmed
      .split(/\n(?=###\s)/)
      .map((chunk) => {
        const lines = chunk.split("\n");
        const title = clean(lines[0].replace(/^###\s*/, ""));
        return { title, ...parseEntryBody(lines.slice(1)) };
      })
      .filter((e) => e.title);
  }

  // Verse, chapter and book notes open each entry with a bold lead —
  // "**(v. 32)**" or "**1. Architecture.**".
  //
  // Chapter and book notes are also written the other way round, as a markdown
  // ordered list that bolds only the name and runs its items together:
  //
  //   1. **Structure:** three concentric circles of prayer — self (vv. 2–8),
  //      brethren (vv. 9–10), enemies (vv. 11–18) — each opened by a desire
  //   2. **The small plates' purest specimen.** Nephi set these plates apart…
  //
  // Numbered that way the notes are not separated by a blank line, so the
  // splitter below found one entry where there were five and every note ran
  // into a single paragraph. Both spellings mean one note per number, so the
  // list form is folded into the bold form and one splitter serves them both.
  // A no-op on files already written the first way.
  const leaded = trimmed.replace(
    /^(\d+)\.[ \t]+\*\*(.+?)\*\*/gm,
    (_, n, title) => `\n\n**${n}. ${title.replace(/[:.]\s*$/, "")}.**`
  );

  return leaded
    .split(/\n\s*\n(?=\*\*)/)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const lead = lines[0].match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (!lead) return { title: "", ...parseEntryBody(lines) };
      const rest = [lead[2], ...lines.slice(1)];
      return { title: clean(lead[1]).replace(/\.$/, ""), ...parseEntryBody(rest) };
    })
    .filter((e) => e.title || e.body.length || e.refs.length || e.items.length);
}

// The two hermeneutical sections that frame the depth sections. They may carry
// "###" subheadings (Applications, Self-reflection questions) or run straight
// into bold-led paragraphs, so handle both.
function parseWorldSection(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n(?=###\s)/)
    .map((chunk) => {
      // Match the first line only: an unanchored /^###.*$/ never matches a
      // multi-line chunk without the m flag, and with it could catch a later one.
      const c = chunk.trimStart();
      const nl = c.indexOf("\n");
      const head = (nl === -1 ? c : c.slice(0, nl)).match(/^###\s+(.*)$/);
      const heading = head ? clean(head[1]) : null;
      const body = head ? (nl === -1 ? "" : c.slice(nl + 1)) : c;
      return { heading, entries: parseSection(body) };
    })
    .filter((g) => g.entries.length);
}

// The trailing "## CONNECTION INDEX" regroups every reference by scope; the
// whole index becomes its own section, every scope included.
function parseConnections(md) {
  // The scope lists may sit under a "## CONNECTION INDEX" heading or stand on
  // their own; either way it is the "### Scope: [X]" headings that matter.
  const idx = md.split(/^##\s+CONNECTION INDEX\s*$/m)[1] ?? md;
  const out = {};
  const parts = idx.split(/^###\s+Scope:\s*\[(ALMA|BOM|SW)\]\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i]] = bullets(parts[i + 1])
      .map(({ text: raw, targets }) => {
        // Every entry opens with a stable handle — "[al34-001]" — which is how
        // a `mirror:` line in the target chapter's own index names it. It is an
        // identifier, not prose, and belongs no more on screen than the scope
        // tags do; without lifting it here it rides along on the source and is
        // printed in front of the reference.
        const tag = raw.match(/^\[([a-z]+\d*-\d+)\]\s*/i);
        const text = tag ? raw.slice(tag[0].length) : raw;
        // Alma 1:13–14, 18 → 34:11 w28–29 "our law," — the capital statute…
        //                    ^ch ^v  ^word span  ^quote   ^gloss
        const [source, rest = ""] = text.split(/\s*→\s*/);
        const m = rest.match(
          /^(\d+)\s*:\s*(\d+)\s+w(\d+)(?:\s*[–—-]\s*(\d+))?\s*"([^"]*)"\s*[—–]\s*(.*)$/
        );
        if (m) {
          // The anchor above has been read off by now, so what is left of the
          // entry is prose and any span still standing in it is not.
          const gloss = m[6].trim().replace(SPAN, "");
          // A quoted run inside the gloss is lifted from the referenced verse,
          // so the popup can bold it in the passage it loads.
          const snippet = gloss.match(/[""]([^""]{4,})[""]|"([^"]{4,})"/);
          return {
            // `id` is the footnote letter the reader sees (16a), assigned
            // later in verse order; this is the one the notes gave it.
            noteId: tag ? tag[1] : null,
            text, source: source.trim(),
            chapter: Number(m[1]), verse: Number(m[2]),
            words: [Number(m[3]), Number(m[4] ?? m[3])],
            quote: m[5],
            gloss,
            snippet: snippet ? (snippet[1] || snippet[2]) : null,
            targets,
            target: `${m[1]}:${m[2]}`,
          };
        }
        // Older shape, or an entry without a word anchor: keep it in the list.
        const gloss = rest.match(/\(([^)]*)\)\s*$/);
        return {
          noteId: tag ? tag[1] : null,
          text,
          source: source.trim(),
          targets,
          target: rest.replace(/\s*\([^)]*\)\s*$/, "").replace(SPAN, "").trim(),
          gloss: gloss ? gloss[1].replace(SPAN, "") : "",
        };
      });
  }
  return out;
}

// A scope list read as bullets. An entry stands at the margin; the indented
// "- target:" lines under it name the verse it points at and quote the wording
// the two places share, and belong to the entry above rather than standing as
// entries of their own — which is what they were read as while the line was
// trimmed before its indentation could be seen, and each of them then dropped
// for having no verse.
function bullets(block) {
  const out = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^(\s*)-\s+(.+)$/);
    if (!m) continue;
    // tidy, not clean: the entry's own word span is what pins the connection
    // to the verse, and it is read back out of this string just below.
    const text = tidy(m[2]);
    if (!text) continue;
    const under = m[1] && text.match(/^target:\s*(.*)$/i);
    if (!under) { out.push({ text, targets: [] }); continue; }
    if (!out.length) continue;
    // "Alma 1:18 w22–28 "he that murdered was punished unto death.""
    const q = under[1].match(/^(.*?)\s*"([^"]*)"\s*$/);
    out[out.length - 1].targets.push({
      label: (q ? q[1] : under[1]).replace(/\s+w\d+(?:\s*[–—-]\s*\d+)?$/, "").trim(),
      quote: q ? q[2] : "",
    });
  }
  return out;
}

// "## CHAPTER METADATA" holds three labelled bullet lists — Speaker(s),
// Audience, Principles — that describe the chapter rather than comment on it,
// so they become their own overview panel instead of a depth level.
const META_FIELDS = {
  "speaker(s)": "speakers", speakers: "speakers", speaker: "speakers",
  audience: "audience",
  location: "location", place: "location", setting: "location",
  principles: "principles", principle: "principles",
};

// Each field may be written either as prose or as a bullet list, and a list may
// carry one level of nesting (the voices quoted inside a speaker's discourse),
// so every group collects both a `text` and `items` with `children`.
function parseMeta(md) {
  const body = md.split(/^##\s+CHAPTER METADATA\s*$/m)[1];
  if (!body) return null;
  const out = {};
  let group = null;
  let para = [];
  const flushPara = () => {
    if (group && para.length) group.text = clean([group.text, ...para].filter(Boolean).join(" "));
    para = [];
  };

  for (const raw of body.split(/^##\s+/m)[0].split("\n")) {
    const line = raw.trim();
    if (!line || /^-{3,}$/.test(line)) { flushPara(); continue; }

    // "**Audience:**" opens a field; everything under it belongs to that field.
    const label = line.match(/^\*\*(.+?):?\*\*:?\s*$/);
    if (label) {
      flushPara();
      const key = META_FIELDS[clean(label[1]).toLowerCase().replace(/:$/, "")];
      group = key ? (out[key] = out[key] || { text: "", items: [] }) : null;
      continue;
    }
    if (!group) continue;

    const indent = raw.match(/^\s*/)[0].length;
    const bullet = line.match(/^-\s+(.*)$/);
    const last = group.items[group.items.length - 1];
    if (bullet) {
      flushPara();
      const text = clean(bullet[1]);
      // Indented bullets hang under the bullet above them.
      if (indent >= 2 && last) last.children.push(text);
      else group.items.push({ text, children: [] });
      continue;
    }
    // Indented prose is a wrapped line, so it rejoins whatever it wrapped from.
    if (indent >= 2 && last) {
      if (last.children.length) last.children[last.children.length - 1] = clean(`${last.children.at(-1)} ${line}`);
      else last.text = clean(`${last.text} ${line}`);
      continue;
    }
    para.push(line);
  }
  flushPara();

  const kept = Object.entries(out).filter(([, g]) => g.text || g.items.length);
  return kept.length ? Object.fromEntries(kept) : null;
}

export function parseCommentary(md) {
  const levels = {};
  // Everything before the first DEPTH heading is front matter; the CONNECTION
  // INDEX at the end is a regrouping of refs already attached to entries.
  const parts = md.split(/^##\s+DEPTH:\s*(.+?)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    // A short chapter may have nothing to say at one level that it does not
    // say at the next, and writes the two as one heading — "CHAPTER & BOOK
    // LEVEL". Read as a single name that matches nothing, the section and both
    // its levels would simply vanish from the panel, so the heading is split
    // and the one body stands for each level it names.
    const names = parts[i]
      .replace(/\s*\(.*\)\s*$/, "")
      .replace(/\s*LEVEL\s*$/i, "")
      .split(/\s*(?:&|\band\b|\/|\+)\s*/i);
    const body = parts[i + 1].split(/^##\s+/m)[0];
    let section = null;
    for (const name of names) {
      const level = DEPTH_TO_LEVEL[name.trim().toUpperCase()];
      if (level) levels[level] = section ||= parseSection(body);
    }
  }
  const section = (re) => {
    const m = md.split(re)[1];
    return m ? parseWorldSection(m.split(/^##\s+/m)[0]) : [];
  };

  // Footnote ids in scripture style: every connection on a verse gets a letter
  // in verse order, so 16a/16b read the same way as a printed footnote.
  const connections = parseConnections(md);
  const anchored = Object.values(connections).flat().filter((c) => c.verse != null);
  anchored.sort((a, b) => a.verse - b.verse || a.words[0] - b.words[0]);
  let verse = null;
  let n = 0;
  for (const c of anchored) {
    if (c.verse !== verse) { verse = c.verse; n = 0; }
    c.id = `${c.verse}${String.fromCharCode(97 + n)}`;
    n++;
  }

  return {
    levels,
    connections,
    meta: parseMeta(md),
    worlds: {
      behind: section(/^##\s+WORLD BEHIND THE TEXT\s*$/m),
      front: section(/^##\s+WORLD IN FRONT OF THE TEXT\s*$/m),
    },
  };
}

const cache = new Map();

// Notes for a chapter, or null when none have been written yet.
export function getCommentary(bookName, chapterN) {
  if (!bookName || chapterN == null) return null;
  const book = slug(bookName);
  const key = `${bookKey(bookName)}-${chapterN}`;
  if (cache.has(key)) return cache.get(key);
  // What the file says it is, first; only then what it is called.
  //
  // By name: `alma-34.md`, or with a trailing note like `alma-34-notes.md`, and
  // either may carry a volume-order prefix (`09-alma-34-notes.md`) and pad the
  // chapter to a fixed width (`04-enos-01-notes.md`). The trailing suffix must
  // start with a separator so "alma-3" can't claim "alma-34.md", and the
  // padding is leading zeros only, so it can't either.
  let md = DECLARED.get(key);
  if (!md) {
    // The separators inside the book are optional here for the same reason:
    // "01-1nephi-20-notes.md" and "01-1-nephi-20-notes.md" name one chapter.
    const loose = book.replace(/-/g, "-?");
    const re = new RegExp(`/(?:\\d+[-_])?${loose}-0*${chapterN}(?:[-_][^/]*)?\\.md$`);
    const path = Object.keys(FILES).find((p) => re.test(p));
    md = path ? FILES[path] : null;
  }
  const parsed = md ? parseCommentary(md) : null;
  cache.set(key, parsed);
  return parsed;
}

export { SCOPES };

// The first verse a note's title names — "(v. 9, 10, 13)", "(v. 2–6)" — or null
// for thematic entries (chapter/block notes) that aren't anchored to a verse.
// clean() has already folded "vv." into "v.", so one pattern covers both.
export function entryVerse(title) {
  const m = title?.match(/\bv\.\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// Connections grouped by the verse of THIS chapter they point at, so the reader
// can mark them in the margin. Entries whose target is a chapter- or book-level
// note ("book note 6") have no verse and are left out.
export function connectionsByVerse(data, chapterN) {
  const map = new Map();
  if (!data) return map;
  const add = (v, c) => {
    if (!map.has(v)) map.set(v, []);
    map.get(v).push(c);
  };
  for (const scope of SCOPES) {
    for (const c of data.connections[scope] || []) {
      // A word-anchored entry names its verse outright; anything older falls
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
// verse. Only word/phrase/verse notes carry them — chapter and block notes
// read whole units, so they mark nothing.
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
