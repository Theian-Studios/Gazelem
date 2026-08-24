import { useState } from "react";
import LibraryPicker from "./LibraryPicker.jsx";

// The bar across the top of a wide window: the site's name, where the reader
// stands, and the field.
//
// It exists because the floating pill is a phone's answer. A pill has one line
// to work with, so it offers the hierarchy one step at a time and floats over
// the text to do it — which is right where a thumb is the pointer and the
// window is 390px wide, and wrong on a desktop, where there is a whole line of
// chrome going spare and a pointer that can hover.
//
// So the trail comes up here and stays put, the reference in the middle of it
// opens the library whole (see LibraryPicker), and the chapter arrows stand
// either side of the reference rather than over the reader's first line.
//
// Narrow, none of this renders: the pill is still the answer down there, and
// the stylesheet keeps this bar away below the breakpoint.

function Chevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir < 0 ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export default function TopBar({
  volume, volId, books, bookIdx, book, chapter, sections,
  trail, atStart, atEnd, onPrev, onNext,
  onLibrary, onVolume, onBook, onChapter, search,
}) {
  const [open, setOpen] = useState(false);

  // What the middle button says: the deepest thing the reader is actually in.
  // A chapter names itself; a book without a chapter names the book; a volume
  // with neither names the volume; and with nothing open at all it is the
  // invitation rather than a location.
  const label = chapter?.reference
    || (book && volId !== "dc" ? book.name : null)
    || volume?.title
    || "All scriptures";

  // The steps above the reference, which the picker opens anyway — so they are
  // set quiet here and read as the address of the button beside them rather
  // than as a row of controls competing with it.
  const above = (trail || []).filter((c) => !c.icon);

  return (
    <header className="topbar">
      <button className="bar-mark serif" onClick={onLibrary} title="All scriptures">
        Gazelem
      </button>

      <div className="bar-where">
        {above.map((c, i) => (
          <span key={i} className="bar-crumb">
            <button onClick={c.onClick}>{c.label}</button>
            <span className="bar-sep" aria-hidden>›</span>
          </span>
        ))}

        {/* Only where there are chapters to page through. On a shelf or a
            study page they could never do anything, and a control that can
            never act is furniture. */}
        {chapter && (
          <button className="tap bar-step" onClick={onPrev} disabled={atStart}
            aria-label="Previous chapter" title="Previous chapter (←)">
            <Chevron dir={-1} />
          </button>
        )}

        <button className="bar-ref serif" onClick={() => setOpen((v) => !v)}
          aria-expanded={open} aria-haspopup="dialog"
          title="Open the library">
          {label}
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden focusable="false"
            fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {chapter && (
          <button className="tap bar-step" onClick={onNext} disabled={atEnd}
            aria-label="Next chapter" title="Next chapter (→)">
            <Chevron dir={1} />
          </button>
        )}
      </div>

      <div className="bar-search">{search}</div>

      {open && (
        <LibraryPicker
          volId={volId} books={books} bookIdx={bookIdx} chapter={chapter}
          sections={sections}
          onClose={() => setOpen(false)}
          onVolume={(v) => { onVolume(v); setOpen(false); }}
          onBook={(vid, name) => { onBook(vid, name); setOpen(false); }}
          onChapter={(vid, name, n) => { onChapter(vid, name, n); setOpen(false); }}
        />
      )}
    </header>
  );
}
