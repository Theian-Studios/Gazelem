import { ink, inkSoft } from "../theme.js";
import { useCommentary, orderedConnections, entryVerse } from "../lib/commentary.js";
import { parseCitations, expandVerses } from "../lib/refs.js";
import { scanCites } from "../lib/cites.js";
import { citeGroup } from "./Cited.jsx";
import Card from "./Card.jsx";
import { SpeakerIcon, AudienceIcon, LocationIcon } from "./MetaIcons.jsx";
import { speakerName } from "../lib/manifest.js";

const PROSE = { color: inkSoft, fontSize: 12, lineHeight: 1.62, margin: "0 0 7px" };

// Who is speaking, to whom, where, and what the chapter turns on — from the
// source's CHAPTER METADATA block. Chapter-scoped, so it sits above the lens
// views and stays put whichever depth or world is selected.
const META_FACETS = [
  ["speakers", "Speaker", SpeakerIcon],
  ["audience", "Audience", AudienceIcon],
  ["location", "Location", LocationIcon],
];

// A field may be written as prose or as a list, and a speaker's list may nest
// the voices quoted inside the discourse; all of it reads as one short value
// under the icon.
function facetValue(g) {
  if (!g) return null;
  const fromList = (g.items || []).flatMap((it) => [it.text, ...(it.children || [])]);
  return [g.text, ...fromList].filter(Boolean).join(" · ") || null;
}

// Only the speaker label is counted, since it is the one that reads wrong in
// the plural. A bulleted field is counted by its bullets; prose is counted by
// the separators someone would actually write between names.
function facetCount(g) {
  if (!g) return 0;
  if (g.items?.length) return g.items.length;
  return (g.text || "").split(/\s*[;·]\s*|\s+and\s+/i).filter(Boolean).length;
}

// A facet's value read as the several names it may be, so each can be asked
// about on its own: "Alma · Amulek" is two people, and one of them having a page
// says nothing about the other. The separator is the one facetValue joins with,
// plus the ones a writer uses inside a single field.
const namesIn = (value) => value.split(/\s+·\s+|\s*;\s*/).map((s) => s.trim()).filter(Boolean);

// Where a name is also somewhere the site can take the reader, it is offered as
// a way there. Which names those are is the manifest's to answer — the prophets'
// pages and the map are both fetched only when opened, and asking either of them
// directly would bring it along with every chapter.
function FacetValue({ value, open }) {
  const parts = namesIn(value);
  return parts.map((name, i) => {
    const to = open?.(name);
    // What a speaker is doing is not part of who he is: "Mormon (narrator)"
    // opens Mormon, and the parenthesis stays plain text beside the link rather
    // than inside it, so the door is the man's name and nothing else.
    const lead = to ? speakerName(name) : name;
    return (
      <span key={name + i}>
        {i > 0 && <span className="meta-facet-sep"> · </span>}
        {to ? (
          <>
            <button type="button" className="meta-facet-link" onClick={to.onClick} title={to.title}>
              {lead}
            </button>
            {name.slice(lead.length)}
          </>
        ) : (
          name
        )}
      </span>
    );
  });
}

function Overview({ meta, collapsed, onToggle, openFor }) {
  const facets = META_FACETS
    .map(([key, label, Icon]) => ({
      key,
      label: key === "speakers" && facetCount(meta[key]) > 1 ? "Speakers" : label,
      Icon,
      value: facetValue(meta[key]),
    }))
    .filter((f) => f.value);
  if (!facets.length) return null;

  return (
    <Card id="overview" title="Overview" label="Chapter overview"
      /* Nearly opaque rather than the glass default: this card is drawn marks —
         rings, glyphs, small caps — and the gradient behind the page tints
         them through the glass. */
      className="popin" style={{ background: "rgba(255,255,255,0.93)" }}
      collapsed={collapsed.has("overview")} onToggle={onToggle}
    >
      {/* Columns follow the number of facets, so a chapter without a location
          fills the row rather than leaving a gap where it would have been. */}
      <ul className="meta-facets" style={{ gridTemplateColumns: `repeat(${facets.length}, 1fr)` }}>
        {facets.map(({ key, label, Icon, value }) => {
          // Where the facet names one thing and that thing has somewhere to go,
          // the ring goes there too: the mark and the name are one object to a
          // reader, and a ring that does nothing beside a name that does reads
          // as the name being the only live part of it. Only for a single
          // name — with two, the ring cannot say which it would open.
          const names = namesIn(value);
          const only = names.length === 1 ? openFor?.[key]?.(names[0]) : null;
          return (
            <li key={key} className="meta-facet">
              {only ? (
                <button type="button" className="meta-ring meta-ring-link"
                  onClick={only.onClick} title={only.title} aria-label={only.title}>
                  <Icon />
                </button>
              ) : (
                <span className="meta-ring"><Icon /></span>
              )}
              <span className="meta-facet-label">{label}</span>
              <span className="serif meta-facet-value">
                <FacetValue value={value} open={openFor?.[key]} />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// A door inside running prose.
//
// A span rather than a button: a button is a box the line cannot break inside,
// whatever its display says, so a quoted clause set as one was pushed onto a
// line of its own — centred in it, with the bracket that introduced it stranded
// at the end of the line above. This is the same span-with-a-role the gold runs
// in the verse text are, and it carries the keyboard with it.
function CiteLink({ title, onClick, children }) {
  return (
    <span
      className="cx-cite"
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
    >
      {children}
    </span>
  );
}

// A reference the notes did not mark. Most are marked — the file locates them
// by offset — but not all: "the inventory of vv. 11–13", a "Jer. 36" inside a
// parenthesis, the ", 22" of a "1 Ne. 3:16, 22". Those are read out of what is
// left over between the marks, never out of a marked range, so the file stays
// the authority on everything it does say.
//
// Read only in what the site's own scanner has left behind, so "Alma 7:12" is
// claimed whole rather than half-read as chapter 7 of the book in hand. What
// keeps the rest honest is the test the scanner uses for a book, asked of a
// chapter: it has to exist. The second alternative is the chapter in hand named
// by verse alone — "(v. 3)", "vv. 11–13", "Verses 25–26". The word is required.
// Bare numbers in brackets are not read as verses, because in these notes they
// are chapters — "the war chapters (43–62)" — and guessing between the two
// would turn a chapter range into six wrong verse marks.
const LOOSE_REF = new RegExp(
  "(?<![\\d:])(\\d{1,3}):(\\d{1,3})(?:\\s*[–—-]\\s*(\\d{1,3}))?(?![\\d:])" +
  "|\\b(?:vv?\\.\\s*|[Vv]erses?\\s+)(\\d{1,3}(?:\\s*[–—-]\\s*\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*[–—-]\\s*\\d{1,3})?)*)(?!\\s*\\d)",
  "g",
);

// A quotation carries the verse's own punctuation, and now and then that means
// a bracket whose opening half is outside the quoted run — "dwelt at Jerusalem
// in all his days)". Closing nothing, it reads as a typo in the note. The pair
// the note makes for itself is left alone; only an unmatched one goes.
function balanced(s) {
  let depth = 0;
  let out = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth === 0) continue;
      depth--;
    }
    out += ch;
  }
  return out;
}

// Everything a note's prose points at, made a door.
//
// The notes locate every reference they make by character offset — a quotation
// of this chapter with the verse it comes from, a bare "(v. 18)", a "(ch. 2)",
// a "Morm. 9:32–33" — so the marks are walked in order and each marked range
// becomes the door it names. A range whose target the volume in hand does not
// have stays plain text rather than offering to open nothing. What lies between
// the marks is scanned, since a note may name a passage without marking it.
function noteRun({ book, chapter, volId, onOpenRef, onJump }) {
  const named = volId === "dc" ? "Doctrine and Covenants" : book?.name;
  const here = new Set((chapter?.verses || []).map((v) => v.verse));
  const chapters = book?.chapters;
  const hasChapter = (n) => !!chapters?.some((c) => c.n === n);

  // What the button says it will do. A run is named by its ends and a list by
  // its members: "vv. 1, 3" marks two verses and not the three between them.
  const said = (l) => {
    if (l.length === 1) return `verse ${l[0]}`;
    const run = l[l.length - 1] - l[0] === l.length - 1;
    return `verses ${run ? `${l[0]}–${l[l.length - 1]}` : l.join(", ")}`;
  };

  // A verse of the chapter being read is scrolled to, since it is already on
  // the page beside the note; anywhere else is opened.
  const doorFor = (m) => {
    if (m.kind === "cite") return here.has(m.verse) ? { verses: [m.verse] } : null;
    if (m.kind === "verse") {
      const verses = [];
      for (let v = m.verse_start; v <= (m.verse_end ?? m.verse_start); v++) {
        if (here.has(v)) verses.push(v);
      }
      return verses.length ? { verses } : null;
    }
    // Built through the resolver rather than by hand, so a note's reference is
    // the same kind of thing as a chart's and opens by the same door.
    if (m.kind === "chapter") {
      if (!named || !hasChapter(m.ch_start)) return null;
      const cite = parseCitations(`${named} ${m.ch_start}`)[0];
      return cite ? { cite } : null;
    }
    if (m.kind === "scripture") {
      const cite = parseCitations(m.text)[0];
      return cite ? { cite } : null;
    }
    return null;
  };

  // A stretch the notes left unmarked, read for anything that names a passage.
  const loose = (text, key) => {
    const out = [];
    const bare = (part, k) => {
      if (!chapters || !named) return [<span key={k}>{part}</span>];
      const bits = [];
      let at = 0;
      LOOSE_REF.lastIndex = 0;
      for (let m; (m = LOOSE_REF.exec(part)); ) {
        let cite = null;
        let verses = null;
        if (m[1]) {
          const n = Number(m[1]);
          if (!chapters.some((c) => c.n === n)) continue;
          cite = parseCitations(`${named} ${n}:${m[2]}${m[3] ? `–${m[3]}` : ""}`)[0];
          if (!cite) continue;
          if (n === chapter?.n) verses = cite.verses;
        } else {
          verses = expandVerses(m[4]).filter((v) => here.has(v));
          if (!verses.length) continue;
        }
        if (m.index > at) bits.push(<span key={`${k}-t${at}`}>{part.slice(at, m.index)}</span>);
        bits.push(
          <CiteLink key={`${k}-r${m.index}`}
            title={verses ? `Go to ${said(verses)}` : `Open ${cite.label}`}
            onClick={() => (verses ? onJump?.(verses) : onOpenRef?.(cite))}>
            {m[0]}
          </CiteLink>,
        );
        at = m.index + m[0].length;
      }
      if (!bits.length) return [<span key={k}>{part}</span>];
      if (at < part.length) bits.push(<span key={`${k}-end`}>{part.slice(at)}</span>);
      return bits;
    };
    scanCites(text).forEach((part, i) => {
      if (part.kind === "text") out.push(...bare(part.text, `${key}-${i}`));
      else out.push(citeGroup(part, onOpenRef, `${key}-${i}`));
    });
    return out;
  };

  return (block, key) => {
    const { text, marks } = block;
    if (!marks?.length) return loose(text, key);
    const out = [];
    let at = 0;
    for (const m of marks) {
      if (m.start > at) out.push(...loose(text.slice(at, m.start), `${key}-t${at}`));
      const label = balanced(text.slice(m.start, m.end));
      const door = doorFor(m);
      out.push(
        door ? (
          <CiteLink key={`${key}-c${m.start}`}
            title={door.verses ? `Go to ${said(door.verses)}` : `Open ${door.cite.label}`}
            onClick={() => (door.verses ? onJump?.(door.verses) : onOpenRef?.(door.cite))}>
            {label}
          </CiteLink>
        ) : (
          <span key={`${key}-p${m.start}`}>{label}</span>
        ),
      );
      at = m.end;
    }
    if (at < text.length) out.push(...loose(text.slice(at), `${key}-end`));
    return out;
  };
}

// The refs a note carries on its own `refs:` line are still not drawn here —
// the Cross Connections card is the one place those live, and the notes stay
// readable prose. What is drawn is what the prose itself names, which the
// reader could otherwise only reach by typing it into the search field with the
// note open in front of them.
function Entry({ e, last, prose }) {
  // Verse-anchored notes advertise their verse so the reader's scroll position
  // can pull the matching note into view (see the sync effect in App.jsx).
  const verse = entryVerse(e.title);
  return (
    <article data-note-verse={verse ?? undefined} style={{ marginBottom: last ? 0 : 16 }}>
      {/* The heading stays plain. Its "(vv. 1, 3)" is not a reference the note
          makes — it is the note saying which verses it is about, which is the
          one thing the reader is already looking at. Drawn as a door it put
          gold in every heading in the card and offered to take the reader to
          the passage they were reading the note for. */}
      {e.title && (
        <h4 className="serif" style={{ fontSize: 13.5, fontWeight: 600, color: ink, margin: "0 0 5px", lineHeight: 1.35 }}>
          {e.title}
        </h4>
      )}
      {e.body.map((p, j) => <p key={j} style={PROSE}>{prose(p, `b${j}`)}</p>)}
      {e.items?.length > 0 && (
        /* Numbered, like every other note in the three worlds — these are the
           one thing the notes write as a plain list, and the list can say which
           question is which without a heading apiece. Nothing is marked inside
           them, so there is no door to make. */
        <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {e.items.map((t, j) => (
            <li key={j} style={{ ...PROSE, margin: "0 0 7px" }}>{t}</li>
          ))}
        </ol>
      )}
    </article>
  );
}

// The worlds behind and in front of the text: prose, sometimes under their own
// subheadings, with no depth to filter by.
//
// One card, whatever the world is divided into. The subheadings used to be
// cards of their own, which said the world's name again at the head of each —
// "In Front · Applications", then "In Front · Self-reflection questions",
// wide enough to be cut short — and made two panels out of what a reader
// reads as one: the questions are the applications asked back, not a separate
// commentary. They are sections inside the card now, ruled off from one
// another the way the study pages are ruled off in the Related card.
function WorldView({ groups, world, chapter, collapsed, onToggle, controls, prose }) {
  return (
    // Keyed by world and chapter so the card replays its entrance on arriving
    // at either. Its collapse id is the same "notes" every other reading of
    // the chapter uses: the reader folds the commentary away, not this world's
    // copy of it, and it should stay folded when they change worlds.
    //
    // And it is called Commentary in every world, as it is at every depth. The
    // segments inside it say which world is being read, and said again over
    // them the name was the card announcing what the reader had just pressed.
    <Card key={`${world}-${chapter.reference}`} id="notes" title="Commentary" label="Commentary"
      className="popin" collapsed={collapsed.has("notes")} onToggle={onToggle}>
      {controls}
      {!groups.length && <p style={{ ...PROSE, margin: 0 }}>No notes for this world yet.</p>}
      {groups.map((g, i) => (
        <section key={i} className={i ? "world-group world-group-under" : "world-group"}>
          {g.heading && <h4 className="world-group-head">{g.heading}</h4>}
          {g.entries.map((e, j) => (
            <Entry key={j} e={e} last={j === g.entries.length - 1} prose={prose} />
          ))}
        </section>
      ))}
    </Card>
  );
}

// The notes are placed in three different parts of the layout, so each is its
// own export rather than one block. The chapter is fetched once however many of
// them ask for it, and read from the cache thereafter.
const useNotesFor = (book, chapter, volId) =>
  useCommentary(book && chapter ? (volId === "dc" ? "Doctrine and Covenants" : book.name) : null,
    chapter?.n ?? null);

// Who is speaking, to whom, and where. Chapter-scoped, so it is the same
// whichever lens is selected.
export function ChapterOverview({ book, chapter, volId, collapsed, onToggle, openFor }) {
  const { notes } = useNotesFor(book, chapter, volId);
  if (!notes?.meta) return null;
  return <Overview meta={notes.meta} collapsed={collapsed} onToggle={onToggle} openFor={openFor} />;
}

// The commentary itself, read through the current lens.
export function CommentaryNotes({ book, chapter, lens, volId, collapsed, onToggle, controls, onOpenRef, onJump }) {
  const { notes: data, loading } = useNotesFor(book, chapter, volId);
  if (!book || !chapter) return null;
  const prose = noteRun({ book, chapter, volId, onOpenRef, onJump });

  if (!data) {
    return (
      <Card id="notes" title="Commentary" label="Commentary" className="popin"
        collapsed={collapsed.has("notes")} onToggle={onToggle}>
        {controls}
        {/* Nothing written and nothing downloaded yet are different answers,
            and the card waits rather than telling the reader the wrong one. The
            controls stand either way, so the card does not change height when
            the notes land. */}
        {!loading && (
          <p style={{ ...PROSE, margin: 0 }}>No notes yet for {chapter.reference}.</p>
        )}
      </Card>
    );
  }
  if (lens.world === "behind") {
    return <WorldView groups={data.worlds.behind} world="behind" chapter={chapter} collapsed={collapsed} onToggle={onToggle} controls={controls} prose={prose} />;
  }
  if (lens.world === "front") {
    return <WorldView groups={data.worlds.front} world="front" chapter={chapter} collapsed={collapsed} onToggle={onToggle} controls={controls} prose={prose} />;
  }

  const entries = data.levels[lens.level] || [];
  return (
    // The level rides in the heading: these notes are one reading of the
    // chapter out of five, and which one should be legible from the card
    // rather than only from the controls that set it. Keyed by the chapter
    // alone — the controls sit inside this card now, and keying it by the level
    // too would replay the card's entrance under the reader's finger every time
    // they pressed one.
    <Card key={chapter.reference} id="notes"
      title="Commentary" label={`Commentary, ${lens.level} level`}
      className="popin"
      collapsed={collapsed.has("notes")} onToggle={onToggle}
    >
      {controls}
      {entries.length === 0 && (
        <p style={{ ...PROSE, margin: 0 }}>
          No {lens.level.toLowerCase()}-level notes for this chapter.
        </p>
      )}
      {entries.map((e, i) => (
        <Entry key={i} e={e} last={i === entries.length - 1} prose={prose} />
      ))}
    </Card>
  );
}

// The index of cross references, in verse order so it tracks the reader.
//
// Shown whichever world the commentary is being read through. The lens says how
// this chapter is being read; where else in scripture it is answered does not
// change with that, and a reader who moved to Behind to see what produced the
// chapter lost the index of what it points at — along with every gold run in
// the text and every letter in the margin, which are the same connections said
// in the other direction and go with it.
export function CrossConnections({ book, chapter, volId, onJump, onOpenRef, collapsed, onToggle }) {
  const { notes: data } = useNotesFor(book, chapter, volId);
  if (!book || !chapter || !data) return null;
  const connections = orderedConnections(data);
  if (!connections.length) return null;

  return (
    <Card key={`conns-${chapter.reference}`} id="connections"
      title="Cross Connections" label="Cross connections" className="popin"
      collapsed={collapsed.has("connections")} onToggle={onToggle}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {connections.map((c) => {
          // The entry names two places: the verse here that carries it, and the
          // passage elsewhere that it points at. What the row says is the
          // passage elsewhere, so that is where pressing it goes. The verse
          // here is already on the page — its letter is in the margin — and
          // the row's own words are the other end, which is not.
          const cite = parseCitations(c.source)[0];
          const go = cite && onOpenRef ? () => onOpenRef(cite) : () => onJump?.(c.verse);
          return (
            <li key={c.noteId} style={{ margin: "0 0 9px" }}>
              <button className="conn-jump" onClick={go}
                title={cite ? `Open ${c.source}` : `Go to verse ${c.verse}`}>
                <span className="conn-jump-id">{c.id}</span>
                <span>
                  <span style={{ color: ink, fontWeight: 600 }}>{c.source}</span>
                  {c.gloss && <span style={{ color: inkSoft }}> — {c.gloss}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
