import { glass, ink, inkSoft } from "../theme.js";

export default function ChapterGrid({ volId, book, onOpen }) {
  return (
    <div className="pop" style={{ marginTop: 16 }}>
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: "18px 4px 6px" }}>
        {volId === "dc" ? "Doctrine and Covenants" : book.name}
      </h2>
      {book.fullTitle && volId !== "dc" && (
        <p style={{ color: inkSoft, fontSize: 14, margin: "0 4px 18px" }}>{book.fullTitle}</p>
      )}
      {volId === "dc" && <p style={{ color: inkSoft, fontSize: 14, margin: "0 4px 18px" }}>Select a section</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: 9 }}>
        {book.chapters.map((c, i) => (
          <button key={c.n} className="tap popin" onClick={() => onOpen(i)}
            style={{ ...glass, borderRadius: 14, padding: "15px 0", textAlign: "center", cursor: "pointer", fontSize: 15.5, fontWeight: 500, fontVariantNumeric: "oldstyle-nums", color: ink, animationDelay: `${Math.min(i * 5, 156)}ms` }}>
            {c.n}
          </button>
        ))}
      </div>
    </div>
  );
}
