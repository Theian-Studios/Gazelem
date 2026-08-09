import { glass, ink, inkSoft, gold, cardTint } from "../theme.js";
import { parseCitations } from "../lib/refs.js";
import { chapterRefs, prophetsFor, prophetByName } from "../lib/prophets.js";
import { citedRun } from "./Cited.jsx";

// A reference set as a link into the text it names.
function Cite({ label, onOpenRef, className = "prophet-cite" }) {
  const cite = parseCitations(label)[0];
  if (!cite) return <span className={className}>{label}</span>;
  return (
    <button className={className} onClick={() => onOpenRef(cite)} title={`Open ${label}`}>
      {label}
    </button>
  );
}

// Prose with its references turned into links where they stand — a timeline
// entry often carries two or three through one sentence.
//
// A bracketed reference keeps its brackets and travels with them as one word;
// anything outside the brackets is read by the shared scanner, so a reference
// written into the sentence itself — Abinadi quoting Isaiah 53 — opens as
// readily as one set apart at the end of it.
function Linked({ text, onOpenRef }) {
  const parts = text.split(/(\([^()]*\d[^()]*\))/g);
  return parts.map((part, i) => {
    const inner = part.match(/^\((.+)\)$/);
    if (!inner) return <span key={i}>{citedRun(part, onOpenRef, i)}</span>;
    return (
      <span key={i} className="prophet-ref-group">
        (<Cite label={inner[1]} onOpenRef={onOpenRef} />)
      </span>
    );
  });
}

// The shelf of prophets, as the books of a volume are shelved. It resolves its
// own: they live in lib/prophets.js, which is only fetched when this page is
// opened, so the caller has nothing to hand down but the volume.
export function ProphetGrid({ volume, onOpen }) {
  const prophets = prophetsFor(volume);
  return (
    <div className="pop">
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: "18px 4px 18px" }}>
        Prophets
      </h2>
      <p className="prophet-intro">
        The men whose words carry the {volume.title}, each with what they said, what
        they taught, and where their lives run through the record.
      </p>
      <div className="prophet-grid">
        {prophets.map((p, i) => (
          <button key={p.name} className="tap popin prophet-tile" onClick={() => onOpen(p.name)}
            style={{ ...glass, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            {/* The name alone. What each man was is on his own page, where
                there is room to say it properly; here it only made the tiles
                three times the height of the thing being chosen. */}
            <span className="serif prophet-tile-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// A field with its title set into the rule above it — the study-sheet
// arrangement, where what a prophet was, taught and wrote stand side by side
// as three fields to be read across rather than three headings to scroll past.
function Panel({ title, wide, tail, children }) {
  return (
    <section className="prophet-panel" data-wide={wide || undefined} data-tail={tail || undefined}>
      <h3 className="prophet-panel-head">{title}</h3>
      <div className="prophet-panel-body">{children}</div>
    </section>
  );
}

// The single-word answers — what he was, what he taught — set as a ruled list
// rather than as pills. Both fields hold the same kind of thing, so they are
// set the same way and read as a pair across the sheet.
function PlainList({ items }) {
  return (
    <ul className="prophet-plain">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

// One prophet: what he said, what he was, what he taught, where to read him,
// and the shape of his life.
export function ProphetPage({ volume, name, onOpenRef }) {
  const prophet = prophetByName(volume, name);
  if (!prophet) return null;
  const chapters = prophet.chapters.flatMap(chapterRefs);

  // A citation runs on from the words it belongs to, bracketed, the way the
  // timeline's do — so a quotation and a moment in his life are referenced the
  // same way.
  const quotes = (
    <ul className="prophet-quotes">
      {prophet.quotes.map((q, i) => (
        <li key={i}>
          <p className="serif prophet-quote">
            “{q.text}”
            {q.ref && (
              <> <span className="prophet-ref-group">(<Cite label={q.ref} onOpenRef={onOpenRef} />)</span></>
            )}
          </p>
          {/* Whose words they are, where they are not his own. */}
          {q.said && (
            <p className="prophet-quote-ref"><span className="prophet-said">{q.said}</span></p>
          )}
        </li>
      ))}
    </ul>
  );

  const keyChapters = (
    <ul className="prophet-pills">
      {chapters.map((c) => (
        <li key={c.label}>
          <button className="rel-jump" onClick={() => onOpenRef(c)} title={`Open ${c.label}`}>
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );

  const timeline = (
    /* A thread down the left, as the chapter band has, so the entries read as
       one life rather than as a list. */
    <ol className="prophet-timeline">
      {prophet.timeline.map((t, i) => (
        <li key={i}>
          {t.lead && <p className="prophet-moment">{t.lead}</p>}
          <p className="serif prophet-detail">
            <Linked text={t.rest} onOpenRef={onOpenRef} />
          </p>
        </li>
      ))}
    </ol>
  );

  return (
    <article className="pop prophet-page">
      <div className="reader-card prophet-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="prophet-head">
          <h2 className="serif prophet-name">{prophet.name}</h2>
        </header>

        {/* Roles have no place in the header here: on a sheet laid out like
            this, what he was is one of the things being answered rather than a
            caption under his name. */}
        <div className="prophet-fields">
          {prophet.roles.length > 0 && (
            <Panel title="Roles"><PlainList items={prophet.roles} /></Panel>
          )}
          {prophet.teachings.length > 0 && (
            <Panel title="Key Teachings"><PlainList items={prophet.teachings} /></Panel>
          )}
          {chapters.length > 0 && <Panel title="Key Chapters">{keyChapters}</Panel>}
          {prophet.quotes.length > 0 && <Panel title="Quotes" wide>{quotes}</Panel>}
          {/* A field of its own, set apart from the four above: the others
              answer what he was, this one what he did. */}
          {prophet.timeline.length > 0 && (
            <Panel title="Timeline" wide tail>{timeline}</Panel>
          )}
        </div>
      </div>
    </article>
  );
}
