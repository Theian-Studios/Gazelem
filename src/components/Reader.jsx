import { useRef } from "react";
import { glass, gold, inkSoft } from "../theme.js";
import { useLocalSummaries, resolveSummary } from "../lib/summaries.js";
import SelectionMenu from "./SelectionMenu.jsx";
import ConnectionAnchor from "./VerseConnections.jsx";
import StudyMarker from "./StudyMarker.jsx";
import { verseSegments } from "../lib/commentary.js";
import { splitFind } from "../lib/find.js";

// A run of verse text with whatever is being looked for on the page marked in
// it. The marks are real elements rather than a paint over the top, so the bar
// that steps between them can find them by walking the document in order.
function Found({ text, find }) {
  if (!find) return text;
  const parts = splitFind(text, find);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    p.hit ? <mark key={i} className="find-hit">{p.text}</mark> : <span key={i}>{p.text}</span>
  );
}

// The chapter waiting either side, seen only in the sliver a drag opens up.
//
// Its head and its first verses, and no more: what shows is a strip down one
// edge, and what it has to say there is which chapter is coming. The gold runs,
// the footnote letters and the margin marks are all left off — they cost the
// most to draw and are the least visible at this width, and the real chapter
// arrives a moment later carrying every one of them.
const PEEK_VERSES = 12;

function Peek({ volId, book, chapter, side }) {
  return (
    <aside className="page-peek" data-side={side} aria-hidden>
      <div className="reader-card" style={{ ...glass, borderRadius: 26 }}>
        <div className="chapter-head">
          <h2 className="serif chapter-title" style={{ fontSize: "clamp(20px, 3vw, 25px)", fontWeight: 600, letterSpacing: "0.01em", margin: 0 }}>
            {volId === "dc" ? `Section ${chapter.n}` : `${book.name} ${chapter.n}`}
          </h2>
        </div>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          {chapter.verses.slice(0, PEEK_VERSES).map((v) => (
            <p key={v.verse} className="serif"
              style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 6, margin: "0 0 14px", fontSize: 17.5, lineHeight: 1.8, fontWeight: 400 }}>
              <span style={{ color: gold, fontSize: 13, lineHeight: "2.35", textAlign: "right", paddingRight: 4, fontVariantNumeric: "oldstyle-nums", fontWeight: 500 }}>
                {v.verse}
              </span>
              <span>{v.text}</span>
            </p>
          ))}
        </div>
      </div>
    </aside>
  );
}

// What the mark beside a verse should open.
//
// A page that names verses stands at the first one it names. A page that treats
// the chapter as a whole names none, and used to be marked up beside the title
// instead — a second place to look, in a header that pins and scrolls, for the
// same kind of thing the verses carry in their margin. It stands at the first
// verse now, with whatever else is there: one mark, one margin, and the card it
// opens says which pages are about the chapter and which about the verse.
function marksAt(study, verse, first) {
  if (!study) return null;
  const here = study.verses.get(verse) || [];
  const pages = first ? [...study.whole, ...here] : here;
  return pages.length ? pages : null;
}

export default function Reader({ volId, book, chapter, targetVerse, flipDir = 0, connections, find, onOpenRef, study, onOpenStudy, pageRef, prev, next }) {
  const versesRef = useRef(null);
  const local = useLocalSummaries();
  const summary = resolveSummary(local, volId, book, chapter.n);
  const entrance = flipDir > 0 ? "flip-next" : flipDir < 0 ? "flip-prev" : "pop";
  return (
    // The element a sideways drag moves — see lib/swipe.js, which writes its
    // transform directly. `page` carries the touch-action that lets it, and the
    // chapters either side ride with it, standing off its edges.
    <article ref={pageRef} className={`page ${entrance}`}>
      {prev && <Peek volId={volId} book={prev.book} chapter={prev.chapter} side="prev" />}
      {next && <Peek volId={volId} book={next.book} chapter={next.chapter} side="next" />}
      {/* Padding is in CSS so the three-column layout can tighten it. */}
      <div className="reader-card" style={{ ...glass, borderRadius: 26 }}>
        {/* Pinned while the chapter scrolls — position and backdrop in CSS. */}
        <div className="chapter-head">
          <h2 className="serif chapter-title" style={{ fontSize: "clamp(20px, 3vw, 25px)", fontWeight: 600, letterSpacing: "0.01em", margin: 0 }}>
            {volId === "dc" ? `Section ${chapter.n}` : `${book.name} ${chapter.n}`}
          </h2>
        </div>

        {((chapter.n === 1 && book.heading && !book.isSections) || summary) && (
          <header style={{ textAlign: "center", margin: "0 0 18px" }}>
            {chapter.n === 1 && book.heading && !book.isSections && (
              <p className="serif" style={{ color: inkSoft, fontSize: 14.5, fontStyle: "italic", lineHeight: 1.65, maxWidth: 560, margin: "0 auto" }}>
                {book.heading}
              </p>
            )}
            {summary && (
              /* Same 620 measure as the verse column, indented by the verse-number
                 gutter (34px + 6px gap) so the summary starts on the same line as
                 the verse text below it. */
              <p className="serif" style={{ color: inkSoft, fontSize: 14.5, fontStyle: "italic", lineHeight: 1.7, maxWidth: 620, margin: "10px auto 0", paddingLeft: 40, textAlign: "left" }}>
                {summary}
              </p>
            )}
          </header>
        )}

        <div ref={versesRef} style={{ maxWidth: 620, margin: "0 auto" }}>
          {chapter.verses.map((v, vi) => (
            <p key={v.verse} id={`verse-${v.verse}`} className={`serif${targetVerse === v.verse ? " vhl" : ""}`}
              style={{ position: "relative", display: "grid", gridTemplateColumns: "34px 1fr", gap: 6, margin: "0 0 14px", fontSize: 17.5, lineHeight: 1.8, fontWeight: 400 }}>
              {/* In the gutter, outside the verse-number column: the pages that
                  begin their treatment of this chapter here. A page stands at
                  the first verse it names and nowhere else, so one chart never
                  puts four marks down one chapter. */}
              {marksAt(study, v.verse, vi === 0) && (
                <span className="sm-gutter">
                  <StudyMarker pages={marksAt(study, v.verse, vi === 0)} onOpen={onOpenStudy} />
                </span>
              )}
              <span aria-hidden style={{ color: gold, fontSize: 13, lineHeight: "2.35", textAlign: "right", paddingRight: 4, fontVariantNumeric: "oldstyle-nums", fontWeight: 500, userSelect: "none" }}>
                {v.verse}
              </span>
              {/* Runs carrying a cross connection are set in gold; the rest is
                  plain text. Segments rebuild the verse exactly, so selecting
                  and copying still yields the original wording. */}
              <span data-verse-text>
                {verseSegments(v.text, connections?.get(v.verse)).map((seg, i) =>
                  seg.connections ? (
                    <ConnectionAnchor key={i} connections={seg.connections} onOpenRef={onOpenRef}>
                      <Found text={seg.text} find={find} />
                    </ConnectionAnchor>
                  ) : (
                    <span key={i}><Found text={seg.text} find={find} /></span>
                  )
                )}
              </span>
            </p>
          ))}
        </div>
      </div>
      <SelectionMenu containerRef={versesRef} reference={chapter.reference} />
    </article>
  );
}
