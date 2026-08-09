import { ink, inkSoft } from "../theme.js";
import { getCommentary, orderedConnections, entryVerse } from "../lib/commentary.js";
import Card from "./Card.jsx";
import { SpeakerIcon, AudienceIcon, LocationIcon } from "./MetaIcons.jsx";

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

function Overview({ meta, collapsed, onToggle }) {
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
        {facets.map(({ key, label, Icon, value }) => (
          <li key={key} className="meta-facet">
            <span className="meta-ring"><Icon /></span>
            <span className="meta-facet-label">{label}</span>
            <span className="serif meta-facet-value">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// The refs a note carries are not rendered here — the Cross Connections card
// is the one place citations live, so the notes stay readable prose.
function Entry({ e, last }) {
  // Verse-anchored notes advertise their verse so the reader's scroll position
  // can pull the matching note into view (see the sync effect in App.jsx).
  const verse = entryVerse(e.title);
  return (
    <article data-note-verse={verse ?? undefined} style={{ marginBottom: last ? 0 : 16 }}>
      {e.title && (
        <h4 className="serif" style={{ fontSize: 13.5, fontWeight: 600, color: ink, margin: "0 0 5px", lineHeight: 1.35 }}>
          {e.title}
        </h4>
      )}
      {e.body.map((p, j) => <p key={j} style={PROSE}>{p}</p>)}
      {e.items?.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
          {e.items.map((t, j) => (
            <li key={j} style={{ ...PROSE, margin: "0 0 7px" }}>{t}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

// The worlds behind and in front of the text: prose, sometimes under their own
// subheadings, with no depth to filter by.
function WorldView({ groups, title, chapter, collapsed, onToggle }) {
  if (!groups.length) {
    return (
      <Card id="notes" title={title} label="Commentary"
        className="popin" collapsed={collapsed.has("notes")} onToggle={onToggle}>
        <p style={{ ...PROSE, margin: 0 }}>No notes for this world yet.</p>
      </Card>
    );
  }
  return (
    <>
      {/* Keyed on world + chapter so a new set of cards replays its entrance;
          the stagger presents them one after another. The collapse id is the
          group's position, so folding one keeps it folded across chapters. */}
      {groups.map((g, i) => {
        const id = `world-${i}`;
        return (
          <Card key={`${title}-${chapter.reference}-${i}`} id={id} label="Commentary"
            title={g.heading ? `${title} · ${g.heading}` : title}
            className="popin"
            style={{ ...(i === 0 ? null : { marginTop: 12 }), animationDelay: `${i * 60}ms` }}
            collapsed={collapsed.has(id)} onToggle={onToggle}
          >
            {g.entries.map((e, j) => (
              <Entry key={j} e={e} last={j === g.entries.length - 1} />
            ))}
          </Card>
        );
      })}
    </>
  );
}

// The notes are placed in three different parts of the layout, so each is its
// own export rather than one block. getCommentary caches, so asking for the
// same chapter three times costs one parse.
function notesFor(book, chapter, volId) {
  if (!book || !chapter) return null;
  return getCommentary(volId === "dc" ? "Doctrine and Covenants" : book.name, chapter.n);
}

// Who is speaking, to whom, and where. Chapter-scoped, so it is the same
// whichever lens is selected.
export function ChapterOverview({ book, chapter, volId, collapsed, onToggle }) {
  const data = notesFor(book, chapter, volId);
  if (!data?.meta) return null;
  return <Overview meta={data.meta} collapsed={collapsed} onToggle={onToggle} />;
}

// The finer levels are a card of many small notes, so the heading names them
// as the several things they are. A chapter or a block is read as one, and
// stays singular.
const LEVEL_LABEL = { Verse: "Verses", Phrase: "Phrases", Word: "Words" };

// The commentary itself, read through the current lens.
export function CommentaryNotes({ book, chapter, lens, volId, collapsed, onToggle }) {
  if (!book || !chapter) return null;
  const data = notesFor(book, chapter, volId);

  if (!data) {
    return (
      <Card id="notes" title="Commentary" label="Commentary" className="popin"
        collapsed={collapsed.has("notes")} onToggle={onToggle}>
        <p style={{ ...PROSE, margin: 0 }}>No notes yet for {chapter.reference}.</p>
      </Card>
    );
  }
  if (lens.world === "behind") {
    return <WorldView groups={data.worlds.behind} title="Behind" chapter={chapter} collapsed={collapsed} onToggle={onToggle} />;
  }
  if (lens.world === "front") {
    return <WorldView groups={data.worlds.front} title="In Front" chapter={chapter} collapsed={collapsed} onToggle={onToggle} />;
  }

  const entries = data.levels[lens.level] || [];
  return (
    // The level rides in the heading: these notes are one reading of the
    // chapter out of five, and which one should be legible from the card
    // rather than only from the lens controls that set it. Keyed so switching
    // level or chapter presents the card afresh.
    <Card key={`${lens.level}-${chapter.reference}`} id="notes"
      title="Commentary" subtitle={LEVEL_LABEL[lens.level] ?? lens.level}
      label={`Commentary, ${lens.level} level`}
      className="popin"
      collapsed={collapsed.has("notes")} onToggle={onToggle}
    >
      {entries.length === 0 && (
        <p style={{ ...PROSE, margin: 0 }}>
          No {lens.level.toLowerCase()}-level notes for this chapter.
        </p>
      )}
      {entries.map((e, i) => (
        <Entry key={i} e={e} last={i === entries.length - 1} />
      ))}
    </Card>
  );
}

// The index of cross references, in verse order so it tracks the reader.
// Cross references belong to the text itself, so the other two worlds show none.
export function CrossConnections({ book, chapter, lens, volId, onJump, collapsed, onToggle }) {
  if (!book || !chapter || lens.world !== "text") return null;
  const data = notesFor(book, chapter, volId);
  if (!data) return null;
  const connections = orderedConnections(data);
  if (!connections.length) return null;

  return (
    <Card key={`conns-${chapter.reference}`} id="connections"
      title="Cross Connections" label="Cross connections" className="popin"
      collapsed={collapsed.has("connections")} onToggle={onToggle}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {connections.map((c) => (
          <li key={c.id} id={`conn-${c.id}`} style={{ margin: "0 0 9px" }}>
            <button className="conn-jump" onClick={() => onJump?.(c.verse)} title={`Go to verse ${c.verse}`}>
              <span className="conn-jump-id">{c.id}</span>
              <span>
                <span style={{ color: ink, fontWeight: 600 }}>{c.source}</span>
                {c.gloss && <span style={{ color: inkSoft }}> — {c.gloss}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
