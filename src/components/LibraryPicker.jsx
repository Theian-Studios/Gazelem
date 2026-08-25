import { useEffect, useMemo, useRef, useState } from "react";
import { VOLUMES } from "../data/volumes.js";
import { getCached, loadVolume } from "../lib/api.js";
import { volumeStops } from "../lib/timeline.js";

// The whole library, opened at once.
//
// The bottom pill can only offer the way back up one step at a time, because a
// pill is one line long: a reader wanting Helaman 5 from Alma 32 walked back to
// the volume, down to the book, and down a list of chapters. Nothing about the
// library needs that — it is a shallow tree, four volumes deep at the most, and
// a window has room to show the whole of it. So this is three panes side by
// side, and any chapter of any volume is two presses away.
//
// Hover moves between the panes and click commits, which is what a menu on a
// desktop does; the panes are the same three the trail names, in the same
// order, so the panel reads as the trail written out rather than as another
// place to learn.

// A book's chapters, with what each is about — the captions the timeline band
// already carries, so the two cannot say different things about one chapter.
function captionsFor(volId, books, book) {
  if (!volId || !books || !book) return new Map();
  const out = new Map();
  for (const stop of volumeStops(volId, books)) {
    if (stop.bookName === book.name && stop.caption) out.set(stop.n, stop.caption);
  }
  return out;
}

export default function LibraryPicker({
  volId, books, bookIdx, chapter, sections, onClose,
  onVolume, onBook, onChapter,
}) {
  // What the panes are showing, which follows the pointer and only becomes
  // where the reader is going when they press. Opening on the chapter in hand
  // means the panel is already scrolled to the shelf they are standing on.
  const [overVol, setOverVol] = useState(volId);
  const [overBook, setOverBook] = useState(bookIdx ?? 0);
  const [shelf, setShelf] = useState(() => (volId ? getCached(volId) : null) || books);
  const [caption, setCaption] = useState(null);
  const box = useRef(null);

  // A volume the reader has never opened has no books in hand, so hovering it
  // fetches them. Cached after the first time, and the pane says it is coming
  // rather than standing empty.
  useEffect(() => {
    let alive = true;
    const cached = getCached(overVol);
    if (cached) { setShelf(cached); return; }
    setShelf(null);
    const vol = VOLUMES.find((v) => v.id === overVol);
    if (!vol) return;
    loadVolume(vol).then((data) => alive && setShelf(data)).catch(() => {});
    return () => { alive = false; };
  }, [overVol]);

  // Moving to another volume's shelf starts at its first book, unless it is the
  // shelf the reader is actually standing on.
  useEffect(() => {
    setOverBook(overVol === volId ? (bookIdx ?? 0) : 0);
  }, [overVol, volId, bookIdx]);

  // Escape closes, and so does a press anywhere outside — the panel is a menu,
  // and a menu that will not go away is a modal in disguise.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    const onDown = (e) => {
      if (box.current?.contains(e.target)) return;
      if (e.target.closest?.(".bar-ref")) return;   // its own button toggles it
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const book = shelf?.[overBook] || null;
  const captions = useMemo(() => captionsFor(overVol, shelf, book), [overVol, shelf, book]);
  const isDC = overVol === "dc";

  return (
    <div className="picker" ref={box} role="dialog" aria-label="Library">
      <div className="picker-panes">
        <div className="picker-pane picker-vols">
          <p className="picker-head">Volumes</p>
          {VOLUMES.map((v) => (
            <button key={v.id} className="picker-row"
              data-on={v.id === overVol || undefined}
              onMouseEnter={() => setOverVol(v.id)}
              onFocus={() => setOverVol(v.id)}
              onClick={() => onVolume(v)}>
              {v.title}
            </button>
          ))}
        </div>

        <div className="picker-pane picker-books">
          <p className="picker-head">{isDC ? "Sections" : "Books"}</p>
          {!shelf && <p className="picker-waiting">Fetching…</p>}
          {shelf && !isDC && shelf.map((b, i) => (
            <button key={b.name} className="picker-row"
              data-on={i === overBook || undefined}
              onMouseEnter={() => setOverBook(i)}
              onFocus={() => setOverBook(i)}
              onClick={() => onBook(overVol, b.name)}>
              {b.name}
            </button>
          ))}
          {/* The D&C is one long book of sections rather than a shelf, so the
              middle pane has nothing of its own to say and the numbers in the
              third pane are the sections themselves. */}
          {shelf && isDC && <p className="picker-waiting">Numbered straight through</p>}
        </div>

        <div className="picker-pane picker-chapters">
          <p className="picker-head">
            {book ? `${book.name} — ${book.chapters.length} ${isDC ? "sections" : "chapters"}` : "Chapters"}
          </p>
          <div className="picker-grid">
            {book?.chapters.map((c) => {
              // Where the reader actually is, which is the volume and the book
              // they came in on — not whichever shelf the pointer is over.
              const here = overVol === volId && overBook === (bookIdx ?? 0) && chapter?.n === c.n;
              return (
                <button key={c.n} className="picker-ch"
                  data-on={here || undefined}
                  title={captions.get(c.n) || undefined}
                  onMouseEnter={() => setCaption(captions.get(c.n) ? { n: c.n, label: captions.get(c.n) } : null)}
                  onMouseLeave={() => setCaption(null)}
                  onClick={() => onChapter(overVol, book.name, c.n)}>
                  {c.n}
                </button>
              );
            })}
          </div>
          {/* One line under the grid rather than a tooltip on each: the caption
              is what the chapter is about, and reading a shelf means reading
              them one after another with the eye in one place. */}
          <p className="picker-caption">
            {caption ? <><span className="picker-caption-n">{caption.n}</span>{caption.label}</> : " "}
          </p>
        </div>
      </div>

      {/* The ways into the volume that are not its text. Only for the volume
          being read: they are fetched per volume, and offering another one's
          would be offering a page that is not there yet. */}
      {overVol === volId && sections?.length > 0 && (
        <div className="picker-sections">
          {sections.map((s) => (
            <button key={s.id} className="picker-section" data-on={s.on || undefined}
              onClick={() => { s.onClick(); onClose(); }}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
