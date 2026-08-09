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

export default function Reader({ volId, book, chapter, targetVerse, flipDir = 0, connections, find, onOpenRef, study, onOpenStudy }) {
  const versesRef = useRef(null);
  const local = useLocalSummaries();
  const summary = resolveSummary(local, volId, book, chapter.n);
  const entrance = flipDir > 0 ? "flip-next" : flipDir < 0 ? "flip-prev" : "pop";
  return (
    <article className={entrance}>
      {/* Padding is in CSS so the three-column layout can tighten it. */}
      <div className="reader-card" style={{ ...glass, borderRadius: 26 }}>
        {/* Pinned while the chapter scrolls — position and backdrop in CSS. */}
        <div className="chapter-head">
          <h2 className="serif chapter-title" style={{ fontSize: "clamp(20px, 3vw, 25px)", fontWeight: 600, letterSpacing: "0.01em", margin: 0 }}>
            {volId === "dc" ? `Section ${chapter.n}` : `${book.name} ${chapter.n}`}
          </h2>
          {/* Pages that treat the chapter as a whole and name no verse in it
              have no verse to stand beside, so they are marked here — in the
              margin beside the title, the same mark the verses carry. */}
          {study?.whole.length > 0 && (
            <span className="sm-head">
              <StudyMarker pages={study.whole} onOpen={onOpenStudy} wide />
            </span>
          )}
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
          {chapter.verses.map((v) => (
            <p key={v.verse} id={`verse-${v.verse}`} className={`serif${targetVerse === v.verse ? " vhl" : ""}`}
              style={{ position: "relative", display: "grid", gridTemplateColumns: "34px 1fr", gap: 6, margin: "0 0 14px", fontSize: 17.5, lineHeight: 1.8, fontWeight: 400 }}>
              {/* In the gutter, outside the verse-number column: the pages that
                  begin their treatment of this chapter here. A page stands at
                  the first verse it names and nowhere else, so one chart never
                  puts four marks down one chapter. */}
              {study?.verses.get(v.verse) && (
                <span className="sm-gutter">
                  <StudyMarker pages={study.verses.get(v.verse)} onOpen={onOpenStudy} />
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
