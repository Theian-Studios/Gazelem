import { glass } from "../theme.js";
import { volumeStops } from "../lib/timeline.js";
import { dateFor } from "../lib/dates.js";

export const hasTimeline = (volId, books) => volumeStops(volId, books).length > 0;

// How many columns a book is divided across where there is room for them. The
// band asks for three and takes fewer as the page narrows — see styles.css.
const COLS = 3;

// The stops gathered into the runs they belong to — "Out of Jerusalem", "Lehi's
// dream" — which is the unit the band already names and the unit a column
// should never break in half.
function runsOf(stops) {
  const runs = [];
  let cur = null;
  for (const s of stops) {
    if (!cur || s.opensSection || s.opensBook) {
      cur = {
        key: `${s.bookIdx}-${s.n}`,
        bookName: s.bookName,
        opensBook: !!s.opensBook,
        section: s.opensSection || null,
        stops: [],
      };
      runs.push(cur);
    }
    cur.stops.push(s);
  }
  return runs;
}

// The runs gathered into the books they belong to. A book is divided *across*
// its columns rather than the volume being poured down one column and on to
// the next: poured, the foot of one column and the head of the next stand five
// hundred years apart, and an eye reading across the page falls through the
// whole history every few inches. Divided, everything at one height on the
// page belongs to one book, and the step from column to column is the step
// from one chapter to the next.
//
// A book too short to fill its columns shares a band with the short book after
// it — four one-chapter books in a row would otherwise be four bands of mostly
// white paper. A shared band names its books on their runs instead of over the
// whole band, since no one name covers it.
//
// How short is short is counted in chapters, not in runs: a volume whose
// captions carry no section column has exactly one run to a book, and by that
// reckoning every book of it — Moses with its eight chapters as much as the
// Articles of Faith with its one — was too short to stand alone, so the whole
// Pearl of Great Price came out as two bands with the books running through
// one another's columns.
function bandsOf(runs, cols) {
  const chapters = new Map();
  for (const r of runs) {
    chapters.set(r.bookName, (chapters.get(r.bookName) || 0) + r.stops.length);
  }

  const bands = [];
  let cur = null;
  // A book long enough to fill its own columns keeps them to itself: the band
  // it opens is closed to the short books after it, which would otherwise be
  // swept into the tail of it.
  let closed = false;
  for (const run of runs) {
    const group = cur?.groups[cur.groups.length - 1];
    if (!group || run.bookName !== group.bookName) {
      const fills = chapters.get(run.bookName) >= cols;
      if (!cur || closed || fills || cur.groups.length >= cols) {
        cur = { groups: [] };
        bands.push(cur);
        closed = fills;
      }
      cur.groups.push({ bookName: run.bookName, runs: [] });
    }
    cur.groups[cur.groups.length - 1].runs.push(run);
  }
  // Each band both ways round: its books, each holding its own runs, and the
  // flat run of them — the first is how a shared band is set out, the second
  // is how a single book is divided and how the band is dated.
  return bands.map((b) => ({
    books: b.groups.map((g) => g.bookName),
    groups: b.groups,
    runs: b.groups.flatMap((g) => g.runs),
  }));
}

// The years a band covers, read off its own stops: the era its first dated
// chapter opens in and the era its last one closes in, joined where they
// differ. Set against the book's name, it dates the book at a glance — which
// is what a reader wants of a title, the chapter-by-chapter reckoning being
// the sidebar band's business.
function spanOf(volume, band) {
  const dates = [];
  for (const run of band.runs) {
    for (const s of run.stops) {
      const d = dateFor(volume, s.bookName, s.n);
      if (d) dates.push(d.split(" · ")[0]);
    }
  }
  if (!dates.length) return "";
  const first = dates[0], last = dates[dates.length - 1];
  if (first === last) return first;
  // Both ends are already ranges ("c. 600–592 B.C."), so the span runs from the
  // opening of the first to the close of the last rather than joining them
  // whole and saying the era twice.
  const open = first.split(/[–—]/)[0].trim();
  const close = last.split(/[–—]/).pop().trim();
  return `${open}–${close}`;
}

// A volume's whole arc on one page: every chapter of every book as a numbered
// stop with its caption, gathered under the named runs they belong to and set
// out a book to a band. The sidebar band shows this same thread six rows at a
// time, scoped to where the reader is standing; this is all of it at once,
// which answers a different question — what happens in this volume, and in
// what order.
export default function VolumeTimeline({ volId, volume, books, onOpen }) {
  const stops = volumeStops(volId, books);
  if (!stops.length) return null;

  const sections = books?.[0]?.isSections;
  const bands = bandsOf(runsOf(stops), COLS);

  // One run: its labels, then a numbered stop to a chapter. `named` is whether
  // the run has to say which book it belongs to, which a band under one name
  // has already said for it.
  const renderRun = (run, named) => {
    // The era the run opens in, written once at its head rather than against
    // its first chapter — the block is what is being dated, a date on a row of
    // its own under a caption reads as belonging to the row beneath it, and one
    // against the first caption crowds the words off a column this narrow.
    // Chapter-by-chapter dating is left to the sidebar band, which has an edge
    // of its own to run the years down.
    const date = dateFor(volume, run.bookName, run.stops[0].n);
    return (
      <div key={run.key} className="ct-run">
        {!sections && named && (
          <p className="ct-book" aria-hidden>
            {run.bookName}
            {date && <span className="ct-run-date">{date.split(" · ")[0]}</span>}
          </p>
        )}
        {run.section && <p className="serif ct-section" aria-hidden>{run.section}</p>}
        {run.stops.map((s) => {
          const full = dateFor(volume, s.bookName, s.n);
          return (
            <button key={`${s.bookIdx}-${s.n}`} className="ct-stop"
              onClick={() => onOpen(s.bookIdx, s.chapterIdx)}
              aria-label={`${s.bookName} ${s.n}${s.caption ? ` — ${s.caption}` : ""}${full ? `, ${full}` : ""}`}>
              <span className="ct-dot">{s.n}</span>
              <span className="ct-caption">{s.caption}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <article className="pop">
      <div className="reader-card bt-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="bt-head">
          <h2 className="serif bt-title">{volume.title}</h2>
          <p className="bt-sub">Timeline</p>
        </header>

        <nav className="chapter-timeline" aria-label={`${volume.title} timeline`}>
          {bands.map((band) => {
            // A band of one book is titled once, over the whole width; a band
            // that had to gather several short books names them on their runs.
            const shared = band.books.length > 1;
            const titled = !sections && !shared;
            const span = titled ? spanOf(volume, band) : "";
            return (
              <section key={band.runs[0].key} className="ct-band">
                {titled && (
                  <h3 className="ct-band-name">
                    {band.books[0]}
                    {span && <span className="ct-band-span">{span}</span>}
                  </h3>
                )}
                {/* One book divided across the columns of the band it has to
                    itself; several books given a column apiece where the band
                    had to gather them. */}
                <div className={`ct-band-runs${shared ? " ct-band-books" : ""}`}>
                  {shared
                    ? band.groups.map((g) => (
                        <div key={g.runs[0].key} className="ct-band-book">
                          {g.runs.map((run, i) => renderRun(run, i === 0))}
                        </div>
                      ))
                    : band.runs.map((run) => renderRun(run, !titled && run.opensBook))}
                </div>
              </section>
            );
          })}
        </nav>
      </div>
    </article>
  );
}
