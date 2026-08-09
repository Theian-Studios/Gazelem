import { glass } from "../theme.js";

export default function BookList({ volume, books, sections = [], search, onOpen }) {
  return (
    <div className="pop">
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: "18px 4px 18px" }}>{volume.title}</h2>
      {search}
      <div className="book-grid">
        {books.map((b, i) => (
          <button key={b.name} className="tap popin" onClick={() => onOpen(i)}
            style={{ ...glass, borderRadius: 15, padding: "15px 18px", textAlign: "left", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, cursor: "pointer", animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="serif" style={{ fontSize: 16.5, fontWeight: 500 }}>{b.name}</span>
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
