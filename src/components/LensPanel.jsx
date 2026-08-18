import Card from "./Card.jsx";

// Four depths, coarse to fine. There was a fifth over them — Block, the chapter
// read against the book around it — but the notes never wrote it as a section of
// its own: what it would have said is written into the chapter notes, which
// close by placing the chapter in its unit and handing it on to the ones
// downstream. A level with nothing of its own to say is a page offered twice.
export const LEVELS = ["Chapter", "Verse", "Phrase", "Word"];

// Behind = the world that produced the text; Text = the text itself; In Front =
// the world it lands in. Only the middle one has a depth to vary.
//
// Each carries the sentence that says what it means. Three one-word labels in a
// row are quick to choose between and tell a reader nothing, so the chosen one
// explains itself underneath — one line, and only for the option in hand.
export const WORLDS = [
  { id: "behind", label: "Behind", note: "The world that produced it — history and setting" },
  { id: "text", label: "Text", note: "The text itself — structure and commentary" },
  { id: "front", label: "In Front", note: "The world it lands in — application and reflection" },
];

// The three worlds as one control rather than three: they are a choice of where
// to stand, and a segmented track says "one of these" in a way three separate
// buttons do not. Layout is the stylesheet's — see .lens-seg.
function Worlds({ value, onChange }) {
  const chosen = WORLDS.find((w) => w.id === value);
  return (
    <>
      <div className="lens-seg" role="group">
        {WORLDS.map((w) => (
          <button
            key={w.id}
            type="button"
            className="lens-seg-item"
            onClick={() => onChange(w.id)}
            aria-pressed={w.id === value}
          >
            {w.label}
          </button>
        ))}
      </div>
      {/* Reserved whether or not it is filled, so choosing a world moves
          nothing below it. */}
      <p className="lens-note">{chosen?.note}</p>
    </>
  );
}

// The depths as a row, coarse to fine, named by what the choice does: zoom.
// A row rather than the funnel that stood here before — the funnel drew the
// narrowing well, but it cost a column of the panel to say what the order of
// the words already says, and on a phone that column is the panel.
function Levels({ value, levels, onChange }) {
  return (
    <div className="lens-zoom" role="group" aria-label="Level of analysis">
      {levels.map((name) => (
        <button
          key={name}
          type="button"
          className="lens-zoom-item"
          onClick={() => onChange(name)}
          aria-pressed={value === name}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

// Both controls answer the same question — how this chapter is being read — so
// they share one card, and fold away by its heading like every other card in
// the column. With no chapter open there is nothing to read through a lens,
// and the card takes itself away as its neighbours do.
// The controls alone, with no card of their own: they stand at the head of the
// commentary they govern. Two cards side by side asked the reader to hold that
// the one above decides what the one below says — a thing the layout can simply
// state by putting them in the same box, and which on a phone it could not
// state at all, the two being separate sheets behind separate marks.
export function LensBody({ lens, setLens, chapter }) {
  if (!chapter) return null;
  return (
    // No headings over either control: the segments are three names of the same
    // kind of thing and read as a choice on sight, and the row below them is a
    // scale read by its order. A heading over each would be two more lines of
    // small capitals saying what the controls already say.
    <div className="lens-groups">
      <Worlds value={lens.world} onChange={(world) => setLens({ ...lens, world })} />

      {/* Depth describes how to read the text itself; it has no meaning for
          the world behind it or the world in front of it. */}
      {lens.world === "text" && (
        <Levels value={lens.level} levels={LEVELS} onChange={(level) => setLens({ ...lens, level })} />
      )}
    </div>
  );
}
