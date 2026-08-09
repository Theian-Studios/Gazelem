import { VOLUMES } from "../data/volumes.js";
import { glass, cardTint } from "../theme.js";

export default function VolumeGrid({ onOpen, search }) {
  return (
    <div className="pop">
      <div style={{ textAlign: "center", margin: "40px 0 36px" }}>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 5vw, 42px)", fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Gazelem</h1>
        {/* The field itself is App's, handed down so this screen can put it
            where it belongs: under the title, with the shelf below it. */}
        {search && (
          <div className="home-search searchcard" style={{ ...glass, borderRadius: 18 }}>
            {search}
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {VOLUMES.map((v, i) => (
          <button key={v.id} className="tap popin" onClick={() => onOpen(v)}
            style={{ ...glass, borderRadius: 22, padding: "22px 24px", textAlign: "left", animationDelay: `${i * 29}ms`, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, cursor: "pointer" }}>
            <div className="serif" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em" }}>{v.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
