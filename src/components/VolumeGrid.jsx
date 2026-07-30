import { VOLUMES } from "../data/volumes.js";
import { glass, inkSoft, cardTint } from "../theme.js";

export default function VolumeGrid({ onOpen }) {
  return (
    <div className="pop">
      <div style={{ textAlign: "center", margin: "40px 0 36px" }}>
        <h1 className="serif" style={{ fontSize: "clamp(30px, 5vw, 42px)", fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>The Scriptures</h1>
        <p style={{ color: inkSoft, fontSize: 15, marginTop: 10 }}>The standard works of The Church of Jesus Christ of Latter-day Saints</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {VOLUMES.map((v, i) => (
          <button key={v.id} className="tap popin" onClick={() => onOpen(v)}
            style={{ ...glass, borderRadius: 22, padding: "26px 24px", textAlign: "left", animationDelay: `${i * 29}ms`, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, cursor: "pointer" }}>
            <div className="serif" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em" }}>{v.title}</div>
            <div style={{ color: inkSoft, fontSize: 13.5, marginTop: 8 }}>{v.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
