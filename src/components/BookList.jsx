import { glass } from "../theme.js";

export default function BookList({ volume, books, sections = [], search, onOpen }) {
  return (
    <div className="pop">
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: "18px 4px 18px" }}>{volume.title}</h2>
      {search}
      <div className="book-grid">
        {books.map((b, i) => (
          // Everything but the stagger is the stylesheet's: a phone sets these
          // two to a row, and a rule cannot reach past an inline style to
          // tighten the padding they are laid out with.
          <button key={b.name} className="tap popin book-tile" onClick={() => onOpen(i)}
            style={{ ...glass, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="serif book-tile-name">{b.name}</span>
          </button>
        ))}
      </div>

      {/* The ways in that are not books — the volume's arc, its prophets, its
          map — kept out of the shelf rather than filed at the end of it, so
          they don't read as more books. */}
      {sections.length > 0 && <div className="volume-sections">{sections}</div>}
    </div>
  );
}
