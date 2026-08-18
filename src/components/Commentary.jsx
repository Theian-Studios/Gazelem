import { ink, inkSoft } from "../theme.js";
import { useCommentary, orderedConnections, entryVerse } from "../lib/commentary.js";
import { parseCitations } from "../lib/refs.js";
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

// Everything a note's prose points at, made a door.
//
// Nothing here reads the prose. The notes locate every reference they make by
// character offset — a quotation of this chapter with the verse it comes from,
// a bare "(v. 18)", a "(ch. 2)", a "Morm. 9:32–33" — so the marks are walked in
// order, the stretches between them are emitted as they stand, and each marked
// range becomes the door it names. A range whose target the volume in hand does
// not have stays plain text rather than offering to open nothing.
function noteRun({ book, chapter, volId, onOpenRef, onJump }) {
  const named = volId === "dc" ? "Doctrine and Covenants" : book?.name;
  const here = new Set((chapter?.verses || []).map((v) => v.verse));
  const hasChapter = (n) => !!book?.chapters?.some((c) => c.n === n);

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

  return (block, key) => {
    const { text, marks } = block;
    if (!marks?.length) return <span key={key}>{text}</span>;
    const out = [];
    let at = 0;
    for (const m of marks) {
      if (m.start > at) out.push(<span key={`${key}-t${at}`}>{text.slice(at, m.start)}</span>);
      const label = text.slice(m.start, m.end);
      const door = doorFor(m);
      out.push(
        door ? (
          <button key={`${key}-c${m.start}`} className="cx-cite"
            title={door.verses ? `Go to ${said(door.verses)}` : `Open ${door.cite.label}`}
            onClick={() => (door.verses ? onJump?.(door.verses) : onOpenRef?.(door.cite))}>
            {label}
          </button>
        ) : (
          <span key={`${key}-p${m.start}`}>{label}</span>
        ),
      );
      at = m.end;
    }
    if (at < text.length) out.push(<span key={`${key}-end`}>{text.slice(at)}</span>);
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
        <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
          {e.items.map((t, j) => (
            /* The reflection questions are the one thing the notes write as a
               plain list, with nothing marked inside them to make a door of. */
            <li key={j} style={{ ...PROSE, margin: "0 0 7px" }}>{t}</li>
          ))}
        </ul>
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
function WorldView({ groups, title, chapter, collapsed, onToggle, controls, prose }) {
  return (
    // Keyed by world and chapter so the card replays its entrance on arriving
    // at either. Its collapse id is the same "notes" every other reading of
    // the chapter uses: the reader folds the commentary away, not this world's
    // copy of it, and it should stay folded when they change worlds.
    <Card key={`${title}-${chapter.reference}`} id="notes" title={title} label="Commentary"
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

// The finer levels are a card of many small notes, so the heading names them
// as the several things they are. A chapter or a block is read as one, and
// stays singular.
const LEVEL_LABEL = { Verse: "Verses", Phrase: "Phrases", Word: "Words" };

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
    return <WorldView groups={data.worlds.behind} title="Behind" chapter={chapter} collapsed={collapsed} onToggle={onToggle} controls={controls} prose={prose} />;
  }
  if (lens.world === "front") {
    return <WorldView groups={data.worlds.front} title="In Front" chapter={chapter} collapsed={collapsed} onToggle={onToggle} controls={controls} prose={prose} />;
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
      title="Commentary" subtitle={LEVEL_LABEL[lens.level] ?? lens.level}
      label={`Commentary, ${lens.level} level`}
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
