import { glass } from "../theme.js";
import { resourcesFor, coverFor } from "../lib/resources.js";
import { emphasis } from "../lib/markup.js";
import { citedRun } from "./Cited.jsx";

// Whether a volume has one of these is answered by lib/sections.js instead of
// here: asked here, the question drags this whole page — and the data behind
// it — into the first download, which is what the tile exists to defer.

// Prose with its book titles set in italic, as they would be in print.
function Prose({ text, onOpenRef }) {
  return emphasis(text).map((part, i) => {
    const run = citedRun(part.text, onOpenRef, i);
    return part.italic ? <em key={i}>{run}</em> : <span key={i}>{run}</span>;
  });
}

// One thing on the shelf. A book is shelved with its jacket and everything else
// beside it, so a line of the sentence starts where every other line of it
// does; an article has no jacket, and takes the width.
function Work({ work, onOpenRef }) {
  return (
    <li className="rs-work">
      {work.cover && (
        /* Decorative: the title is alongside in text, so a screen reader gains
           nothing by being read the jacket as well. */
        <img className="rs-cover" src={coverFor(work.cover)} alt=""
          loading="lazy" decoding="async" />
      )}
      <div className="rs-body">
        <h3 className="serif rs-name">{work.title}</h3>
        {(work.author || work.detail) && (
          <p className="rs-byline">
            {work.author}
            {work.detail && <span className="rs-detail">{work.detail}</span>}
          </p>
        )}
        <p className="rs-text"><Prose text={work.body} onOpenRef={onOpenRef} /></p>
        {work.links.length > 0 && (
          <p className="rs-links">
            {/* Off the site altogether, so it opens beside it rather than over
                it, and carries nothing of this page with it. */}
            {work.links.map((l) => (
              <a key={l.href} className="rs-link" href={l.href}
                target="_blank" rel="noopener noreferrer">{l.label}</a>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

// What has been written about the volume, as against what is in it. Shelved
// the way the evidences are — a card to a work: what it is in a sentence, and
// the door to where it can be read, which is all a reading list is for.
export default function Resources({ volume, onOpenRef }) {
  const groups = resourcesFor(volume);
  if (!groups.length) return null;

  // The books are shelved across the page, since a jacket wants the width. The
  // rest are read down a column, and a column of them beside another column of
  // them is two shelves in the room one was taking.
  const shelved = groups.filter((g) => g.works.some((w) => w.cover));
  const listed = groups.filter((g) => !g.works.some((w) => w.cover));

  return (
    <article className="pop">
      <div className="reader-card rs-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="rs-head">
          <h2 className="serif rs-title">Study Resources</h2>
          <p className="rs-sub">{volume.title}</p>
          <p className="rs-intro">
            Where to read further: the critical text, the literary and
            historical studies, the commentaries and the apologetics, and the
            articles and archives behind them — each with a line on what it is
            and where it can be had.
          </p>
        </header>

        {shelved.map((g) => (
          <section key={g.title} className="rs-group">
            <h3 className="rs-group-name">{g.title}</h3>
            <ol className="rs-shelf">
              {g.works.map((w) => <Work key={w.title} work={w} onOpenRef={onOpenRef} />)}
            </ol>
          </section>
        ))}

        <div className="rs-columns">
          {listed.map((g) => (
            <section key={g.title} className="rs-group">
              <h3 className="rs-group-name">{g.title}</h3>
              <ol className="rs-shelf">
                {g.works.map((w) => <Work key={w.title} work={w} onOpenRef={onOpenRef} />)}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
