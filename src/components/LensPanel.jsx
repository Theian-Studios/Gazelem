import { glass, ink } from "../theme.js";

// Shared greys: the chosen option reads dark, the rest recede.
const ON = "rgba(64,64,70,0.88)";
const OFF = "rgba(120,120,128,0.20)";
const LABEL_ON = ink;
const LABEL_OFF = "rgba(120,120,128,0.42)";

export const LEVELS = ["Block", "Chapter", "Verse", "Phrase", "Word"];

// Behind = the world that produced the text; Text = the text itself; In Front =
// the world it lands in. Only the middle one has depth and breadth to vary.
export const WORLDS = [
  { id: "behind", label: "Behind" },
  { id: "text", label: "Text" },
  { id: "front", label: "In Front" },
];

// One row of the level and breadth stacks. Both use it, so the two lists share
// a rhythm and their labels line up down the panel.
const ROW = 21;
const SHAPE_COL = 110;
const LABEL_COL = SHAPE_COL + 10;

function Group({ title, children, first }) {
  return (
    <section style={{ marginTop: first ? 0 : 22 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", textAlign: "center", margin: "0 0 12px", color: ink }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

const labelStyle = (on) => ({
  fontSize: 13,
  fontWeight: on ? 700 : 600,
  lineHeight: `${ROW - 6}px`,
  color: on ? LABEL_ON : LABEL_OFF,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textAlign: "left",
  transition: "color .18s",
});

// A funnel: each step down the stack narrows, so the shape itself reads as
// "finer grain" before the labels are even read.
function LevelFunnel({ value, onChange }) {
  const widths = [104, 90, 74, 56, 34];
  return (
    <div>
      {LEVELS.map((name, i) => {
        const on = value === name;
        return (
          <button
            key={name}
            className="lens-row"
            onClick={() => onChange(name)}
            aria-pressed={on}
            style={{ display: "grid", gridTemplateColumns: `${SHAPE_COL}px 1fr`, alignItems: "center", gap: 10, width: "100%", border: 0, background: "none", padding: "3px 0", cursor: "pointer" }}
          >
            <span aria-hidden style={{ display: "block", justifySelf: "center", width: widths[i], height: 15, borderRadius: 999, background: on ? ON : OFF, transition: "background .18s" }} />
            <span style={labelStyle(on)}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// Nested arcs, widest at the top. The outer arc spans exactly the distance
// between the first and last label, so the drawing and the list share a scale.
function BreadthArcs({ value, options, onChange }) {
  const span = ROW * (options.length - 1); // "Standard Works" centre → "Alma" centre
  const R = [span, span * 0.66, span * 0.33];
  // Baseline sits on the last label's centre, so the outer arc rises exactly to
  // the first label's centre.
  const CY = span + ROW / 2;
  const W = span * 2 + 12;
  const CX = W / 2;
  const H = CY + 6;

  return (
    <div style={{ position: "relative" }}>
      {/* aria-hidden: the arcs are a mouse target only. Each has a real button
          beside it carrying the label, the pressed state and focus styling. */}
      <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: (SHAPE_COL - W) / 2, top: 0 }}>
        {options.map((o, i) => {
          const r = R[i];
          const d = `M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`;
          return (
            <g key={o.id} onClick={() => onChange(o.id)} className="lens-arc">
              {/* A wide invisible stroke: the visible band is only 9px, which
                  is a small target for a pointer. */}
              <path d={d} fill="none" stroke="transparent" strokeWidth="20" strokeLinecap="round" />
              <path d={d} fill="none" stroke={value === o.id ? ON : OFF} strokeWidth="9"
                strokeLinecap="round" style={{ transition: "stroke .18s", pointerEvents: "none" }} />
            </g>
          );
        })}
      </svg>

      <div style={{ paddingLeft: LABEL_COL }}>
        {options.map((o) => (
          <button
            key={o.id}
            className="lens-row"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            title={o.label}
            /* lineHeight 0 on the button so the row is sized by the label's own
               line box — otherwise the button's inherited strut makes these
               rows taller than the level rows beside them. */
            style={{ display: "block", width: "100%", border: 0, background: "none", padding: "3px 0", cursor: "pointer", lineHeight: 0 }}
          >
            <span style={{ ...labelStyle(value === o.id), display: "block" }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Worlds({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {WORLDS.map((w) => {
        const on = value === w.id;
        return (
          <button
            key={w.id}
            className="lens-row"
            onClick={() => onChange(w.id)}
            aria-pressed={on}
            style={{ border: 0, background: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}
          >
            <span aria-hidden style={{ width: 50, height: 50, borderRadius: "50%", background: on ? ON : OFF, transition: "background .18s" }} />
            <span style={{ ...labelStyle(on), fontSize: 12.5, textAlign: "center" }}>{w.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LensControls({ lens, setLens, volumeTitle, bookName }) {
  // The middle and inner rings name wherever you are; without a volume or book
  // open they fall back to the generic level.
  const breadthOptions = [
    { id: "all", label: "Standard Works" },
    { id: "volume", label: volumeTitle || "Volume" },
    { id: "book", label: bookName || "Book" },
  ];

  return (
    <div style={{ ...glass, borderRadius: 18, padding: "18px 16px 16px" }}>
      <Group title="The 3 Worlds" first>
        <Worlds value={lens.world} onChange={(world) => setLens({ ...lens, world })} />
      </Group>

      {/* Depth and breadth describe how to read the text itself; they have no
          meaning for the world behind it or the world in front of it. */}
      {lens.world === "text" && (
        <>
          <Group title="Level of Analysis">
            <LevelFunnel value={lens.level} onChange={(level) => setLens({ ...lens, level })} />
          </Group>

          <Group title="Breadth of Cross Connections">
            <BreadthArcs
              value={lens.breadth}
              options={breadthOptions}
              onChange={(breadth) => setLens({ ...lens, breadth })}
            />
          </Group>
        </>
      )}
    </div>
  );
}

export default function LensPanel(props) {
  return (
    <aside className="lenses" aria-label="Commentary lenses">
      <LensControls {...props} />
    </aside>
  );
}
