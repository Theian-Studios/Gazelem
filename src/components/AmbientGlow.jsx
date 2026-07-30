export default function AmbientGlow() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: "-12%", left: "-8%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(197,215,238,0.55), transparent 70%)" }} />
      <div style={{ position: "absolute", top: "30%", right: "-10%", width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle, rgba(238,228,205,0.5), transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-15%", left: "22%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(214,226,220,0.45), transparent 70%)" }} />
    </div>
  );
}
