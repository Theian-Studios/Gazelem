import { useEffect, useRef } from "react";
import { captionsFor } from "../lib/timeline.js";
import Card from "./Card.jsx";

// The chapter band: every chapter of the book as a numbered stop with its
// caption beside it, threaded by a rule that runs past both ends so it reads as
// continuing. The box scrolls, and glides to the chapter being read.
export default function ChapterTimeline({ volId, book, chapter, onOpen, collapsed, onToggle }) {
  // The D&C has no book level — its one "book" is called Sections in the data,
  // while its captions are filed under the volume's name.
  const captions = captionsFor(volId === "dc" ? "Doctrine and Covenants" : book?.name);
  const scroller = useRef(null);
  // The first placement jumps; later ones glide, so changing chapter reads as
  // the band travelling to its new position.
  const settled = useRef(false);

  const chapterN = chapter?.n;
  const folded = !!collapsed?.has("timeline");
  // Reopening the card rebuilds the scroll box at zero, so that placement
  // jumps; only a chapter change while already open is worth a glide.
  const wasFolded = useRef(folded);
  useEffect(() => {
    const box = scroller.current;
    const stop = box?.querySelector('[aria-current="page"]');
    if (!box || !stop) { wasFolded.current = folded; return; }
    const top = stop.offsetTop - (box.clientHeight - stop.offsetHeight) / 2;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glide = settled.current && !wasFolded.current && !still;
    box.scrollTo({ top, behavior: glide ? "smooth" : "auto" });
    settled.current = true;
    wasFolded.current = folded;
  }, [chapterN, captions, folded]);

  if (!captions || !chapter || !book?.chapters?.length) return null;

  const unit = book.isSections ? "Section" : "Chapter";

  return (
    <Card id="timeline" title={`Timeline · ${book.name}`} label={`${unit} timeline`}
      collapsed={folded} onToggle={onToggle}>
      {/* data-more turns on the edge fades once there is something to scroll to. */}
      <div className="ct-scroll" ref={scroller} data-more={book.chapters.length > 7}>
        <nav className="chapter-timeline" aria-label={`${unit}s of ${book.name}`}>
          {/* Runs the full height of the list, so it passes beyond the first and
              last visible stop instead of stopping at them. */}
          <span className="ct-line" aria-hidden />
          {book.chapters.map((c) => {
            const on = c.n === chapter.n;
            const caption = captions.get(c.n) || "";
            return (
              <button
                key={c.n}
                className="ct-stop"
                onClick={() => !on && onOpen(c.n)}
                aria-current={on ? "page" : undefined}
                aria-label={`${unit} ${c.n}${caption ? ` — ${caption}` : ""}`}
                title={caption}
              >
                <span className="ct-dot" data-on={on}>{c.n}</span>
                {/* Captions clamp to two lines; the row's fixed height keeps the
                    stops evenly spaced however long the text runs. */}
                <span className="serif ct-caption" data-on={on}>{caption}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </Card>
  );
}
