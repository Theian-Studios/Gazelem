import { glass } from "../theme.js";

export default function BookList({ volume, books, onOpen }) {
  return (
    <div className="pop" style={{ marginTop: 16 }}>
      <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", margin: "18px 4px 18px" }}>{volume.title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {books.map((b, i) => (
          <button key={b.name} className="tap popin" onClick={() => onOpen(i)}
            style={{ ...glass, borderRadius: 15, padding: "15px 18px", textAlign: "left", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, cursor: "pointer", animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="serif" style={{ fontSize: 16.5, fontWeight: 500 }}>{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
