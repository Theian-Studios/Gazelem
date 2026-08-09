import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { volumeStops } from "../lib/timeline.js";
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

  // One flat list for the volume — the same thread the volume's timeline page
  // lays out in full, built in lib/timeline.js so the two cannot diverge.
  const stops = useMemo(() => volumeStops(volId, books), [books, volId]);

  // Which edges of the band still have chapters beyond them. The fade at an
  // edge is what says the list carries on; at the first chapter of a volume
  // there is nothing above, and fading there only greys out the book's name.
  const [fade, setFade] = useState("none");
  const syncFade = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const above = box.scrollTop > 4;
    const below = box.scrollTop + box.clientHeight < box.scrollHeight - 4;
    setFade(above && below ? "both" : above ? "top" : below ? "bottom" : "none");
  }, []);

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
      // The glide arrives later; the listener below catches its end, this
      // catches a jump.
      syncFade();
      return true;
    };

    const placed = place();
    wasFolded.current = folded;
    if (placed) return;
    // Place it again as soon as the card is given room.
    const ro = new ResizeObserver(() => { if (place()) ro.disconnect(); });
    ro.observe(box);
    return () => ro.disconnect();
  }, [chapterN, bookName, stops, folded, syncFade]);

  // Follows the band wherever it comes to rest, including the end of a glide.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    syncFade();
    box.addEventListener("scroll", syncFade, { passive: true });
    return () => box.removeEventListener("scroll", syncFade);
  }, [syncFade, stops, folded]);

  if (!stops.length || !chapter || !book) return null;

  const unit = book.isSections ? "Section" : "Chapter";
  const title = volumeTitle || book.name;

  return (
    <Card id="timeline" title="Timeline" label={`${unit} timeline`}
      /* Nearly opaque, like the overview: the band is a drawn thread of rules
         and dots, and the page's gradient reads through plainer glass. */
      style={{ background: "rgba(255,255,255,0.93)" }}
      collapsed={folded} onToggle={onToggle}>
      {/* data-fade names the edges that have chapters past them, and only
          those are faded — see .ct-scroll in styles.css. */}
      <div className="ct-scroll" ref={scroller} data-fade={fade}>
        <nav className="chapter-timeline" aria-label={`${unit}s of ${title}`}>
          {/* The rule is drawn by the rows themselves (see styles.css), so a
              section title leaves a gap in it rather than covering it over. */}
          {stops.map((s) => {
            const on = s.bookName === book.name && s.n === chapter.n;
            return (
              <div key={`${s.bookIdx}-${s.n}`}>
                {/* The name of the book this stop opens, sitting in the gutter
                    beside the rule so the thread is unbroken across the join. */}
                {s.opensBook && !book.isSections && (
                  <p className="ct-book" aria-hidden>{s.bookName}</p>
                )}
                {/* The narrative run this chapter opens. Sits below the book's
                    name where both fall together, so the wider frame is read
                    first. */}
                {s.opensSection && (
                  <p className="serif ct-section" aria-hidden>{s.opensSection}</p>
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
