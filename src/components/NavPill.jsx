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

// The floating dock: ‹ › page through chapters, and the trail between them
// climbs the hierarchy — library · volume · book.
export default function NavPill({ trail = [], chapter, atStart, atEnd, onPrev, onNext, onBack }) {
  return (
    <nav className="navdock" style={{ zIndex: 30, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ ...glassPill, display: "flex", alignItems: "center", gap: 4, padding: 6, pointerEvents: "auto" }}>
        {/* Only present once a cross reference has been followed. */}
        {onBack && (
          <button className="tap" onClick={onBack} aria-label="Back to where you were"
            style={{ border: 0, background: "rgba(164,133,61,.16)", borderRadius: 999, height: 42, padding: "0 14px", fontSize: 12.5, fontWeight: 600, color: "#8a6f2e", cursor: "pointer", display: "grid", placeItems: "center" }}>
            ↩ Back
          </button>
        )}
        {chapter && (
          <button className="tap" onClick={onPrev} disabled={atStart} aria-label="Previous chapter"
            style={{ border: 0, background: atStart ? "transparent" : "rgba(255,255,255,.5)", borderRadius: 999, width: 42, height: 42, fontSize: 18, color: atStart ? "rgba(110,110,115,.35)" : blue, cursor: atStart ? "default" : "pointer", display: "grid", placeItems: "center" }}>
            ‹
          </button>
        )}
        {trail.map((t, i) => (
          <Fragment key={t.icon ? "library" : t.label}>
            {/* A chevron between the steps, so the trail reads as a sequence
                rather than three unrelated buttons. */}
            {i > 0 && <span aria-hidden className="pill-sep">›</span>}
            {t.icon ? (
              <button className="tap" onClick={t.onClick} aria-label={t.label} title={t.label}
                style={{ border: 0, background: "transparent", borderRadius: 999, width: 42, height: 42, color: ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <LibraryIcon />
              </button>
            ) : (
              <button className="tap" onClick={t.onClick}
                style={{ border: 0, background: "transparent", borderRadius: 999, padding: "0 12px", height: 42, fontSize: 13.5, fontWeight: 600, color: ink, cursor: "pointer" }}>
                {t.label}
              </button>
            )}
          </Fragment>
        ))}
        {chapter && (
          <button className="tap" onClick={onNext} disabled={atEnd} aria-label="Next chapter"
            style={{ border: 0, background: atEnd ? "transparent" : "rgba(255,255,255,.5)", borderRadius: 999, width: 42, height: 42, fontSize: 18, color: atEnd ? "rgba(110,110,115,.35)" : blue, cursor: atEnd ? "default" : "pointer", display: "grid", placeItems: "center" }}>
            ›
          </button>
        )}
      </div>
    </nav>
  );
}
