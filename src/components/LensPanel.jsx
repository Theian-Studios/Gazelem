import { ink } from "../theme.js";
import Card from "./Card.jsx";

// Shared greys: the chosen option reads dark, the rest recede.
const ON = "rgba(64,64,70,0.88)";
const OFF = "rgba(120,120,128,0.20)";
const LABEL_ON = ink;
const LABEL_OFF = "rgba(120,120,128,0.42)";

export const LEVELS = ["Block", "Chapter", "Verse", "Phrase", "Word"];

// Block is the chapter read against the book around it. Where the book is one
// chapter — Enos, Jarom, Omni, the Words of Mormon — there is no book around
// it: the two levels name the same text, and the notes say so, writing them as
// one "CHAPTER & BOOK LEVEL" section. Offering both is offering the reader the
// same page twice.
export const levelsFor = (book) =>
  book?.chapters?.length === 1 ? LEVELS.filter((l) => l !== "Block") : LEVELS;

// Behind = the world that produced the text; Text = the text itself; In Front =
// the world it lands in. Only the middle one has a depth to vary.
export const WORLDS = [
  { id: "behind", label: "Behind" },
  { id: "text", label: "Text" },
  { id: "front", label: "In Front" },
];

// One row of the level stack.
const ROW = 21;
const SHAPE_COL = 110;

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
function LevelFunnel({ value, levels, onChange }) {
  // Indexed by the level's place in the full stack, not by its place in the
  // rows being drawn, so dropping Block drops the widest bar and the rest keep
  // the widths they have everywhere else — a shorter funnel, not a redrawn one.
  const widths = [104, 90, 74, 56, 34];
  return (
    // Shrunk to the widest row and centred as one block, so the funnel and the
    // words beside it sit together in the middle of the panel rather than the
    // funnel alone being centred and the labels running off to the right.
    <div style={{ width: "fit-content", margin: "0 auto" }}>
      {levels.map((name) => {
        const on = value === name;
        const i = LEVELS.indexOf(name);
        return (
          <button
            key={name}
            className="lens-row"
            onClick={() => onChange(name)}
            aria-pressed={on}
            style={{ display: "grid", gridTemplateColumns: `${SHAPE_COL}px max-content`, alignItems: "center", gap: 10, width: "100%", border: 0, background: "none", padding: "3px 0", cursor: "pointer" }}
          >
            <span aria-hidden style={{ display: "block", justifySelf: "center", width: widths[i], height: 15, borderRadius: 999, background: on ? ON : OFF, transition: "background .18s" }} />
            <span style={labelStyle(on)}>{name}</span>
          </button>
        );
      })}
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

// Both controls answer the same question — how this chapter is being read — so
// they share one card, and fold away by its heading like every other card in
// the column. With no chapter open there is nothing to read through a lens,
// and the card takes itself away as its neighbours do.
export function LensControls({ lens, setLens, book, chapter, collapsed, onToggle }) {
  if (!chapter) return null;
  const levels = levelsFor(book);
  return (
    <Card id="lenses" title="Analysis" label="Analysis lenses"
      collapsed={!!collapsed?.has("lenses")} onToggle={onToggle}>
      <div className="lens-groups">
        {/* Named in one word each: the card they sit in already says what kind
            of thing is being chosen. */}
        <section>
          <h4 className="lens-head">Type</h4>
          <Worlds value={lens.world} onChange={(world) => setLens({ ...lens, world })} />
        </section>

        {/* Depth describes how to read the text itself; it has no meaning for
            the world behind it or the world in front of it. */}
        {lens.world === "text" && (
          <section>
            <h4 className="lens-head">Level</h4>
            <LevelFunnel value={lens.level} levels={levels} onChange={(level) => setLens({ ...lens, level })} />
          </section>
        )}
      </div>
    </Card>
  );
}

export default function LensPanel(props) {
  return (
    <aside className="lenses" aria-label="Commentary lenses">
      <LensControls {...props} />
    </aside>
  );
}
