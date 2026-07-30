import { ink, inkSoft } from "../theme.js";
import { getCommentary, orderedConnections, entryVerse } from "../lib/commentary.js";
import Card from "./Card.jsx";

const PROSE = { color: inkSoft, fontSize: 12, lineHeight: 1.62, margin: "0 0 7px" };

// Who is speaking, to whom, and what the chapter teaches — from the source's
// CHAPTER METADATA block. Chapter-scoped, so it sits above the lens views and
// stays put whichever depth or world is selected.
const META_GROUPS = [
  ["speakers", "Speakers"],
  ["audience", "Audience"],
  ["principles", "Principles"],
];

// A speaker may carry the voices quoted inside their discourse, so the list
// nests one level.
function MetaList({ items }) {
  return (
    <ul className="meta-list">
      {items.map((it, i) => (
        <li key={i}>
          {it.text}
          {it.children.length > 0 && (
            <ul className="meta-sublist">
              {it.children.map((c, j) => <li key={j}>{c}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Overview({ meta, chapter, collapsed, onToggle }) {
  return (
    <Card id="overview" title={`Overview · ${chapter.reference}`} label="Chapter overview"
      className="popin" style={{ marginBottom: 12 }}
      collapsed={collapsed.has("overview")} onToggle={onToggle}
    >
      {META_GROUPS.map(([key, label]) => {
        const g = meta[key];
        if (!g || (!g.text && !g.items.length)) return null;
        return (
          <div key={key} className="meta-group">
            <h4 className="meta-label">{label}</h4>
            {/* Principles arrive as a comma-separated keyword line, which scans
                better as tags than as a run-on sentence. */}
            {key === "principles" && g.text ? (
              <ul className="meta-tags">
                {g.text.split(/\s*,\s*/).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            ) : (
              <>
                {g.text && <p className="meta-text">{g.text}</p>}
                {g.items.length > 0 && <MetaList items={g.items} />}
              </>
            )}
          </div>
        );
      })}
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
// subheadings, with no depth or breadth to filter by.
function WorldView({ groups, title, chapter, collapsed, onToggle }) {
  if (!groups.length) {
    return (
      <Card id="notes" title={`${title} · ${chapter.reference}`} label="Commentary"
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
            title={g.heading ? `${title} · ${g.heading}` : `${title} · ${chapter.reference}`}
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

export default function Commentary({ book, chapter, lens, volId, onJump, collapsed, onToggle }) {
  if (!book || !chapter) return null;

  const bookName = volId === "dc" ? "Doctrine and Covenants" : book.name;
  const data = getCommentary(bookName, chapter.n);

  if (!data) {
    return (
      <Card id="notes" title="Commentary" label="Commentary" className="popin"
        collapsed={collapsed.has("notes")} onToggle={onToggle}>
        <p style={{ ...PROSE, margin: 0 }}>No notes yet for {chapter.reference}.</p>
      </Card>
    );
  }

  // Present in every world and at every depth — it describes the chapter rather
  // than reading it through a lens.
  const overview = data.meta
    ? <Overview meta={data.meta} chapter={chapter} collapsed={collapsed} onToggle={onToggle} />
    : null;

  if (lens.world === "behind") {
    return <>{overview}<WorldView groups={data.worlds.behind} title="Behind" chapter={chapter} collapsed={collapsed} onToggle={onToggle} /></>;
  }
  if (lens.world === "front") {
    return <>{overview}<WorldView groups={data.worlds.front} title="In Front" chapter={chapter} collapsed={collapsed} onToggle={onToggle} /></>;
  }

  const entries = data.levels[lens.level] || [];
  // The index at the end of the notes, regrouped by the same scopes the
  // breadth rings select.
  // Verse order, so the list tracks the reader as it scrolls.
  const connections = orderedConnections(data, lens.breadth);

  return (
    <>
      {overview}
      {/* Keyed so switching level or chapter presents the card afresh. */}
      <Card key={`${lens.level}-${chapter.reference}`} id="notes"
        title={`${lens.level} · ${chapter.reference}`} label="Commentary" className="popin"
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

      {connections.length > 0 && (
        <Card key={`conns-${lens.breadth}-${chapter.reference}`} id="connections"
          title="Cross Connections" label="Cross connections" className="popin"
          style={{ marginTop: 12, animationDelay: "60ms" }}
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
      )}
    </>
  );
}
