import { useEffect, useMemo, useRef } from "react";
import { captionsFor } from "../lib/timeline.js";
import Card from "./Card.jsx";

// The chapter band: every chapter of the whole volume as a numbered stop with
// its caption beside it, threaded by a rule that runs past both ends so it
// reads as continuing. It runs straight on through the end of one book into
// the next, with the book's name marking the join, so the last chapter of Alma
// sits directly above the first of Helaman. The box scrolls, and glides to the
// chapter being read.
export default function ChapterTimeline({ volId, volumeTitle, books, book, chapter, onOpen, collapsed, onToggle }) {
  const scroller = useRef(null);
  // The first placement jumps; later ones glide, so changing chapter reads as
  // the band travelling to its new position.
  const settled = useRef(false);

  // One flat list for the volume. The D&C has no book level — its single
  // "book" is called Sections in the data, while its captions are filed under
  // the volume's name.
  const stops = useMemo(() => {
    const list = [];
    (books || []).forEach((b, bookIdx) => {
      const captions = captionsFor(volId === "dc" ? "Doctrine and Covenants" : b.name);
      if (!captions) return;
      b.chapters.forEach((c, i) => {
        list.push({
          bookIdx,
          bookName: b.name,
          // Only the first chapter of a book carries its name, so the label
          // appears once at the join rather than against every stop.
          opensBook: i === 0,
          n: c.n,
          caption: captions.get(c.n) || "",
        });
      });
    });
    return list;
  }, [books, volId]);

  const chapterN = chapter?.n;
  const bookName = book?.name;
  const folded = !!collapsed?.has("timeline");
  // Reopening the card rebuilds the scroll box at zero, so that placement
  // jumps; only a chapter change while already open is worth a glide.
  const wasFolded = useRef(folded);
  useEffect(() => {
    const box = scroller.current;
    if (!box) { wasFolded.current = folded; return; }

    const place = () => {
      const stop = box.querySelector('[aria-current="page"]');
      // The column is hidden at narrow widths, where the card lays out at zero
      // height and there is nothing to scroll yet.
      if (!stop || !box.clientHeight) return false;
      const top = stop.offsetTop - (box.clientHeight - stop.offsetHeight) / 2;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A whole volume is long — the Old Testament runs to some 40,000px — so
      // gliding is right for a step to a neighbouring chapter and wrong for a
      // jump across books, which would sail through hundreds of stops.
      const far = Math.abs(top - box.scrollTop) > 1500;
      const glide = settled.current && !wasFolded.current && !still && !far;
      box.scrollTo({ top, behavior: glide ? "smooth" : "auto" });
      settled.current = true;
      return true;
    };

    const placed = place();
    wasFolded.current = folded;
    if (placed) return;
    // Place it again as soon as the card is given room.
    const ro = new ResizeObserver(() => { if (place()) ro.disconnect(); });
    ro.observe(box);
    return () => ro.disconnect();
  }, [chapterN, bookName, stops, folded]);

  if (!stops.length || !chapter || !book) return null;

  const unit = book.isSections ? "Section" : "Chapter";
  const title = volumeTitle || book.name;

  return (
    <Card id="timeline" title={`Timeline · ${title}`} label={`${unit} timeline`}
      collapsed={folded} onToggle={onToggle}>
      {/* data-more turns on the edge fades once there is something to scroll to. */}
      <div className="ct-scroll" ref={scroller} data-more={stops.length > 7}>
        <nav className="chapter-timeline" aria-label={`${unit}s of ${title}`}>
          {/* Runs the full height of the list, so it passes beyond the first and
              last visible stop instead of stopping at them. */}
          <span className="ct-line" aria-hidden />
          {stops.map((s) => {
            const on = s.bookName === book.name && s.n === chapter.n;
            return (
              <div key={`${s.bookIdx}-${s.n}`}>
                {/* The name of the book this stop opens, sitting in the gutter
                    beside the rule so the thread is unbroken across the join. */}
                {s.opensBook && !book.isSections && (
                  <p className="ct-book" aria-hidden>{s.bookName}</p>
                )}
                <button
                  className="ct-stop"
                  onClick={() => !on && onOpen(s.bookIdx, s.n)}
                  aria-current={on ? "page" : undefined}
                  aria-label={`${s.bookName} ${s.n}${s.caption ? ` — ${s.caption}` : ""}`}
                  title={s.caption}
                >
                  <span className="ct-dot" data-on={on}>{s.n}</span>
                  {/* Captions clamp to two lines; the row's fixed height keeps
                      the stops evenly spaced however long the text runs. */}
                  <span className="serif ct-caption" data-on={on}>{s.caption}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>
    </Card>
  );
}
