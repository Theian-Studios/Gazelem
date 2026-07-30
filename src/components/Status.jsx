import { glass, glassPill, blue } from "../theme.js";

export function LoadingShimmer() {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 58, borderRadius: 16, border: "1px solid rgba(255,255,255,.6)" }} />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div style={{ ...glass, borderRadius: 18, padding: 24, marginTop: 24, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 15 }}>{message}</p>
      <button className="tap" onClick={onRetry} style={{ ...glassPill, marginTop: 14, padding: "10px 22px", border: "1px solid rgba(58,90,140,.25)", color: blue, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}
