import { glass } from "../theme.js";
import { comingForthFor, portraitFor } from "../lib/comingForth.js";
import { emphasis } from "../lib/markup.js";
import { citedRun } from "./Cited.jsx";

// Whether a volume has one of these is answered by lib/sections.js instead of
// here: asked here, the question drags this whole page — and the data behind
// it — into the first download, which is what the tile exists to defer.

// Prose with its book titles set in italic, as they would be in print, and its
// references opening into the text — the account of the lost pages names the
// revelation that answered them, and that name should be a door like any other.
function Prose({ text, onOpenRef }) {
  return emphasis(text).map((part, i) => {
    const run = citedRun(part.text, onOpenRef, i);
    return part.italic ? <em key={i}>{run}</em> : <span key={i}>{run}</span>;
  });
}

// The other timeline in this volume runs inside the record — Lehi leaving
// Jerusalem through to Moroni burying the plates. This one runs outside it:
// how the book got from the plates to the page, and then to the shelf it is
// read from. One thread, one figure to a stop, in the order the years fall.
export default function ComingForth({ volume, onOpenRef }) {
  const figures = comingForthFor(volume);
  if (!figures.length) return null;

  const span = `${figures[0].year}–${figures[figures.length - 1].year}`;
  // The year is written where it changes, so two people who share one are read
  // as one moment rather than as a repetition.
  let last = null;

  return (
    <article className="pop">
      <div className="reader-card cf-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="cf-head">
          <h2 className="serif cf-title">Coming Forth</h2>
          <p className="cf-sub">{volume.title} · {span}</p>
          <p className="cf-intro">
            Tracing the journey of a sacred record—from its coming forth from
            the dust to its translation, printing, dividing, study, and
            elevation across generations.
          </p>
        </header>

        <ol className="cf-thread">
          {figures.map((f) => {
            const opensYear = f.year !== last && (last = f.year);
            return (
              <li key={`${f.year}-${f.name}`} className="cf-stop">
                {opensYear && <p className="cf-year" aria-hidden>{f.year}</p>}
                {/* The portrait and the name are one row, and the prose is its
                    own block beneath. On a wide screen that reads as one
                    paragraph with a plate beside it; on a phone, where there
                    is no room for both, the prose keeps the full width and a
                    reading measure rather than a column two dozen characters
                    across. */}
                <div className="cf-figure">
                  {/* Decorative: the name is alongside in text, so a screen
                      reader gains nothing by being read the portrait twice. */}
                  <img className="cf-portrait" src={portraitFor(f.image)} alt=""
                    loading="lazy" decoding="async" width="112" height="140" />
                  <div className="cf-body">
                    <h3 className="serif cf-name">
                      {f.name}
                      {f.years && <span className="cf-years">{f.years}</span>}
                    </h3>
                    {f.role && <p className="cf-role">{f.role}</p>}
                  </div>
                </div>
                <p className="cf-text"><Prose text={f.body} onOpenRef={onOpenRef} /></p>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
