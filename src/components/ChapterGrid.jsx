import { glass, ink, inkSoft } from "../theme.js";

// `current` is only ever passed where the grid is standing in for a chapter
// that is already open — the compact layout's contents sheet, which is how a
// reader leaves one chapter for another. On a book's own page there is no
// current chapter to mark.
export default function ChapterGrid({ volId, book, sections = [], search, current, onOpen }) {
  // The D&C is titled but not subtitled, so its heading carries the whole gap
  // itself rather than leaving the 6px that a following line would close up.
  const subtitle = volId !== "dc" && book.fullTitle;
  return (
    <div className="pop">
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: `18px 4px ${subtitle ? 6 : 18}px` }}>
        {volId === "dc" ? "Doctrine and Covenants" : book.name}
      </h2>
      {subtitle && (
        <p style={{ color: inkSoft, fontSize: 14, margin: "0 4px 18px" }}>{book.fullTitle}</p>
      )}

      {search}

      {/* The D&C has no shelf of books to stand these beside, so its sections
          double as the volume's front door and carry them here instead. */}
      {sections.length > 0 && (
        <div className="volume-sections">{sections}</div>
      )}

      <div className="chapter-grid">
        {book.chapters.map((c, i) => (
          <button key={c.n} className="tap popin chapter-cell" onClick={() => onOpen(i)}
            data-on={i === current || undefined} aria-current={i === current ? "page" : undefined}
            style={{ ...glass, color: ink, animationDelay: `${Math.min(i * 5, 156)}ms` }}>
            {c.n}
          </button>
        ))}
      </div>
    </div>
  );
}
