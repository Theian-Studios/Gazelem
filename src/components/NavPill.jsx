import { Fragment } from "react";
import { glassPill, ink, blue } from "../theme.js";

// The library glyph on the bottom pill: a shelf of volumes — two upright
// spines and a third leaning against them, the universal "books" silhouette.
function LibraryIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden focusable="false" fill="currentColor">
      <rect x="0.6" y="0.5" width="3.6" height="15" rx="1.7" />
      <rect x="5.5" y="2.4" width="3.6" height="13.1" rx="1.7" />
      <rect x="11.9" y="0.6" width="3.6" height="14.9" rx="1.7" transform="rotate(-14 13.7 15.5)" />
    </svg>
  );
}

// An open book, for the button that returns the reader to the chapter they
// were studying — as against the ↩ beside it, which retraces one step.
function ReadingIcon() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" aria-hidden focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8.5 3.1C7.2 1.9 5.4 1.4 3 1.5c-.9 0-1.4.1-1.4.8v8.9c0 .6.4.8 1.1.8 2.4-.1 4.4.3 5.8 1.5 1.4-1.2 3.4-1.6 5.8-1.5.7 0 1.1-.2 1.1-.8V2.3c0-.7-.5-.8-1.4-.8-2.4-.1-4.2.4-5.5 1.6ZM8.5 3.1v9.4" />
    </svg>
  );
}

// The floating dock. One rule holds the whole of it: the trail says where you
// are, and the two buttons before it say how you got here.
//
//   ↩ Alma 32        one step back, named by what it returns to
//   ▤ 1 Nephi 16     the chapter being studied, however far off it you have gone
//   ⌂ › BoM › Charts where this page stands
//
// Neither button says the bare word "back" — a control that will not name its
// destination is one the reader has to gamble on — and neither appears where
// the trail beside it already leads to the same place. See App's `back` and
// `resume`, which decide that.
//
// ‹ › page through the chapters, and stand either side of the trail.
//
// Narrow the dock shares its line with the search button, and fades with the
// markers at the top of the window while the chapter is being read — the two
// are one set of controls, and half of them going is worse than none.
//
// Its layout lives in styles.css rather than here: an inline `display` would
// outrank the rule that takes the dock away on the wide views where the
// contents card says all of this and more.
export default function NavPill({ trail = [], chapter, atStart, atEnd, onPrev, onNext, back, resume, search, hidden }) {
  return (
    <nav className="navdock" data-hidden={hidden || undefined}>
      {/* pointer-events is the stylesheet's, not an inline style's: the dock
          fading out has to be able to stop it taking taps, and an inline rule
          would outrank the one that does. */}
      {/* How many ways back are in it, which is what a phone's line cannot hold
          on top of a full trail: the stylesheet reads this and drops the middle
          of the trail, and at the last width the names as well. */}
      <div className="navpill" data-ways={(back ? 1 : 0) + (resume ? 1 : 0) || undefined}
        style={{ ...glassPill, display: "flex", alignItems: "center", gap: 4, padding: 6 }}>
        {back && (
          <button className="tap pill-way pill-back" onClick={back.onClick}
            aria-label={`Back to ${back.label}`} title={`Back to ${back.label}`}>
            <span aria-hidden className="pill-way-mark">↩</span>
            <span className="pill-way-name">{back.label}</span>
          </button>
        )}
        {resume && (
          <button className="tap pill-way pill-resume" onClick={resume.onClick}
            aria-label={`Back to reading ${resume.label}`} title={`Back to reading ${resume.label}`}>
            <span aria-hidden className="pill-way-mark"><ReadingIcon /></span>
            <span className="pill-way-name">{resume.label}</span>
          </button>
        )}
        {chapter && (
          <button className="tap pill-step" onClick={onPrev} disabled={atStart} aria-label="Previous chapter"
            style={{ border: 0, background: atStart ? "transparent" : "rgba(255,255,255,.5)", borderRadius: 999, width: 42, height: 42, fontSize: 18, color: atStart ? "rgba(110,110,115,.35)" : blue, cursor: atStart ? "default" : "pointer", display: "grid", placeItems: "center" }}>
            ‹
          </button>
        )}
        {/* Each step is marked with whether it is the last one, so the
            narrowest phones can drop the middle of the trail rather than
            ellipsing the end of it: "Alm…" names nothing, and the library icon
            still climbs past whatever was dropped. */}
        {trail.map((t, i) => {
          const step = i === trail.length - 1 ? "last" : "up";
          return (
            <Fragment key={t.icon ? "library" : t.label}>
              {/* A chevron between the steps, so the trail reads as a sequence
                  rather than three unrelated buttons. */}
              {i > 0 && <span aria-hidden className="pill-sep" data-step={step}>›</span>}
              {t.icon ? (
                <button className="tap" onClick={t.onClick} aria-label={t.label} title={t.label}
                  style={{ border: 0, background: "transparent", borderRadius: 999, width: 42, height: 42, color: ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <LibraryIcon />
                </button>
              ) : (
                <button className="tap pill-crumb" data-step={step} onClick={t.onClick}
                  style={{ border: 0, background: "transparent", borderRadius: 999, padding: "0 12px", height: 42, fontSize: 13.5, fontWeight: 600, color: ink, cursor: "pointer" }}>
                  {t.label}
                </button>
              )}
            </Fragment>
          );
        })}
        {chapter && (
          <button className="tap pill-step" onClick={onNext} disabled={atEnd} aria-label="Next chapter"
            style={{ border: 0, background: atEnd ? "transparent" : "rgba(255,255,255,.5)", borderRadius: 999, width: 42, height: 42, fontSize: 18, color: atEnd ? "rgba(110,110,115,.35)" : blue, cursor: atEnd ? "default" : "pointer", display: "grid", placeItems: "center" }}>
            ›
          </button>
        )}
      </div>
      {/* Beside the pill rather than inside it: the pill is where you are, the
          field is where you might go, and one is fixed to its contents while
          the other takes whatever room is left. */}
      {search}
    </nav>
  );
}
