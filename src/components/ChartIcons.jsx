// A mark to a chart, drawn in the same hand as the section tiles: a 16-square,
// stroked in the parent's colour, nothing filled. Each one points at what its
// chart is a chart of rather than decorating it — the sower's seed for the
// parables, the scales for grace and works, a hand for the touch.
//
// Kept here rather than in the data, since which glyph stands for a chart is a
// question about the page, not about the record.
const svg = (children, w = 1.4) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

// The hook and the point: a question mark.
const Asked = svg(<>
  <path d="M5.4 5.2a2.8 2.8 0 1 1 4 2.55c-1 .45-1.3 1.05-1.3 2.05" />
  <path d="M8 13.2h.01" />
</>, 1.6);

// The same mark turned about, for the questions put to Him rather than by Him.
const Answered = svg(<>
  <path d="M2 4.2a1.6 1.6 0 0 1 1.6-1.6h8.8A1.6 1.6 0 0 1 14 4.2v5.2a1.6 1.6 0 0 1-1.6 1.6H6.2L3 13.6V11h-.4A1.6 1.6 0 0 1 2 9.4z" />
  <path d="M6.6 5.6a1.6 1.6 0 1 1 2.3 1.45c-.57.26-.74.6-.74 1.15" />
</>);

// Two tablets: a command is given, and it stands written.
const Commands = svg(<>
  <path d="M2.4 5.4a2.6 2.6 0 0 1 2.6-2.6 2.6 2.6 0 0 1 2.6 2.6v8H2.4z" />
  <path d="M8.4 5.4A2.6 2.6 0 0 1 11 2.8a2.6 2.6 0 0 1 2.6 2.6v8H8.4z" />
  <path d="M4 8.4h2M10 8.4h2" />
</>);

// A seed in the ground, sending up its first leaf: the sower's parable.
const Parables = svg(<>
  <path d="M8 14V7.6" />
  <path d="M8 7.6C8 5.4 6.3 3.6 4 3.4c-.2 2.3 1.5 4.2 4 4.2z" />
  <path d="M8 9.2c0-1.9 1.5-3.4 3.5-3.6.2 2-1.4 3.6-3.5 3.6z" />
  <path d="M4.6 14h6.8" />
</>);

// A star throwing its rays: the sign done, and seen.
const Miracles = svg(<>
  <path d="M8 2.2 9.5 6l3.8 1.5L9.5 9 8 12.8 6.5 9 2.7 7.5 6.5 6z" />
  <path d="M12.6 12.6h.01M3.6 12.2h.01M12.2 3.4h.01" />
</>);

// The bush that burned and was not consumed — where the name was given.
const IAm = svg(<>
  <path d="M8 13.6c2 0 3.4-1.4 3.4-3.2 0-2.6-3.4-3.5-2.3-7-2 .9-4.5 3.1-4.5 6.4 0 2 1.4 3.8 3.4 3.8z" />
  <path d="M8 13.6c1 0 1.6-.8 1.6-1.7 0-1.3-1.6-1.9-1.2-3.6" />
</>);

// A heart, for the feelings the Gospels record in Him.
const Emotions = svg(<>
  <path d="M8 13.2C4.6 10.9 2.4 9 2.4 6.6a2.9 2.9 0 0 1 5.6-1 2.9 2.9 0 0 1 5.6 1c0 2.4-2.2 4.3-5.6 6.6z" />
</>);

// An open hand reaching: every touch, in both directions.
const Touch = svg(<>
  <path d="M6.2 8.4V3.6a1.1 1.1 0 0 1 2.2 0v4M8.4 7.6V2.9a1.1 1.1 0 0 1 2.2 0v4.7" />
  <path d="M10.6 8V4.9a1.1 1.1 0 0 1 2.2 0v5.3c0 2.1-1.7 3.6-3.9 3.6-2.4 0-3.5-1-4.4-2.6L3 8.7a1.1 1.1 0 0 1 1.8-1.2l1.4 1.6" />
</>);

// A pair of quotation marks: the older scripture set in His mouth. A scroll
// was the obvious glyph and the wrong one — rolled at both ends it comes out
// at this size as a box with two arrows in it.
const Quoted = svg(<>
  <path d="M6.2 4.4c-1.9.6-3 2.1-3 4v3.2h3.4V8.4H4.5c0-1.4.6-2.4 1.7-2.8z" />
  <path d="M13 4.4c-1.9.6-3 2.1-3 4v3.2h3.4V8.4h-2.1c0-1.4.6-2.4 1.7-2.8z" />
</>);

// A table of rows and columns: what any chart is, for one not given a mark.
const Chart = svg(<>
  <rect x="2.2" y="3" width="11.6" height="10" rx="1.5" />
  <path d="M2.2 6.2h11.6M6.6 6.2V13M10.2 6.2V13" />
</>);

// A prism: one beam going in and several coming out, which is the chart's
// whole claim — one gospel spoken as body, building, arena, army, and field.
// A circle overlapping a square stood here, and at any size it came out as a
// toggle switch.
const Metaphors = svg(<>
  <path d="M7 3.2 12.2 12.2H1.8z" />
  <path d="M.8 7.8h3.6" />
  <path d="M10 7.6h5.2M10.5 9.1l4.4 1.7M11 10.6l3.4 2.6" />
</>, 1.3);

// A balance in even poise: the two held together rather than set at odds.
const Balance = svg(<>
  <path d="M8 3.2v10.4M5 13.6h6M3.2 5.6h9.6" />
  <path d="M1.4 9.4a1.8 1.8 0 0 0 3.6 0L3.2 5.6z" />
  <path d="M11 9.4a1.8 1.8 0 0 0 3.6 0L12.8 5.6z" />
</>);

// A sealed letter: the epistles, each sent to somewhere in particular.
const Letters = svg(<>
  <rect x="2" y="3.6" width="12" height="8.8" rx="1.5" />
  <path d="M2.6 4.8 8 8.8l5.4-4" />
</>);

// A voice going out: the preaching of Acts.
const Sermons = svg(<>
  <path d="M2.4 6.6h2.2L9 3.4v9.2L4.6 9.4H2.4z" />
  <path d="M11.4 6a3 3 0 0 1 0 4M13.3 4.2a5.4 5.4 0 0 1 0 7.6" />
</>);

// ---- The Old Testament ---------------------------------------------------

// A crown: the names are titles, and each one names a sovereignty.
const NamesOfGod = svg(<>
  <path d="M2.4 11.6h11.2M2.4 11.6 1.6 4.8l3.6 2.6L8 3.2l2.8 4.2 3.6-2.6-.8 6.8" />
</>);

// A figure and the shadow it throws forward: the type, and what it prefigures.
const Types = svg(<>
  <path d="M5.6 2.6h4.2l2.4 2.4v8H5.6z" />
  <path d="M3.4 5.2v8.2h5.4" strokeDasharray="2.2 1.8" />
</>);

// An arrow come to the mark: foretold, and then kept. The arc alone read as a
// swoosh — it is the target that says the word was fulfilled and not merely
// spoken.
const Prophecy = svg(<>
  <circle cx="10.4" cy="5.6" r="4" />
  <circle cx="10.4" cy="5.6" r="1.1" />
  <path d="M1.6 14.4 7.6 8.4" />
  <path d="M1.4 11.6 1.6 14.4l2.8.2" />
</>);

// A harp: the songs of David.
const Psalms = svg(<>
  <path d="M3.4 2.6c0 5.6.8 8.8 3.4 10.8M12.6 2.6c0 5.6-.8 8.8-3.4 10.8" />
  <path d="M3.4 3.4h9.2" />
  <path d="M6 4.4v7M8 4.4v8M10 4.4v7" />
</>);

// A sorted stack: many kinds of song, told apart.
const Categories = svg(<>
  <path d="M2.6 4h10.8M2.6 8h7.6M2.6 12h4.4" />
  <path d="M15 8h.01M11.8 12h.01" />
</>);

// A frame around a middle: the wager, the long argument, the whirlwind.
const Job = svg(<>
  <rect x="2" y="3" width="12" height="10" rx="1.5" />
  <path d="M5.2 3v10M10.8 3v10" />
</>);

// A woman's figure, for the mothers, judges, and queens.
const Women = svg(<>
  <circle cx="8" cy="4.2" r="2.2" />
  <path d="M8 6.4 5.2 12h5.6z" />
  <path d="M6.4 12v2M9.6 12v2" />
</>);

// One tag becoming another: a new name for a new man.
const NameChange = svg(<>
  <rect x="1.6" y="5" width="5" height="6" rx="1.2" />
  <rect x="9.4" y="5" width="5" height="6" rx="1.2" />
  <path d="M7 8h1.8M8.8 8 7.9 7.1M8.8 8l-.9.9" />
</>);

// A single tag, with the eyelet a name is hung by. The church's name shared the
// two-tag mark above, where the arrow between them vanished at this size and
// left a pair of blank pills — and a name that changed over a century is not
// the same claim as a man renamed at a covenant.
const NamePlate = svg(<>
  <path d="M8.6 2.2H13a1 1 0 0 1 1 1v4.4a1 1 0 0 1-.3.7l-5.6 5.6a1 1 0 0 1-1.4 0L2.5 9.7a1 1 0 0 1 0-1.4l5.4-5.8a1 1 0 0 1 .7-.3z" />
  <circle cx="11" cy="5.2" r="1.15" />
</>);

// Cast out and brought home: the same points thrown wide, then drawn in.
const Gathering = svg(<>
  <circle cx="8" cy="8" r="2.2" />
  <path d="M8 5.8V2.4M8 10.2v3.4M5.8 8H2.4M10.2 8h3.4" />
  <path d="M6.8 3.6 8 2.4l1.2 1.2M9.2 12.4 8 13.6l-1.2-1.2" />
</>);

// ---- The Book of Mormon --------------------------------------------------

// A mask: the anti-Christs argued in another man's face.
const AntiChrist = svg(<>
  <path d="M3 3.6h10v4.2c0 3-2.2 5.4-5 5.4s-5-2.4-5-5.4z" />
  <path d="M5.6 7.2h1.4M9 7.2h1.4M6.4 10.4c1 .7 2.2.7 3.2 0" />
</>);

// An eye: the narrator stops the story to say what is to be seen in it.
const ThusWeSee = svg(<>
  <path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8z" />
  <circle cx="8" cy="8" r="1.9" />
</>);

// Two swords crossed: the campaigns of Alma 43–62. A sword laid over a shield
// stood here, and the two shapes met in the middle of a sixteen-pixel square
// and came out as one blot.
const War = svg(<>
  <path d="M3 2.4 11.6 11M12.6 2.4 4 11" />
  <path d="M2.2 12.4 4.4 10.2M13.4 12.4 11.2 10.2" />
  <path d="M2.6 14.2 4.8 12M13 14.2l-2.2-2.2" />
</>);

// ---- The Doctrine and Covenants ------------------------------------------

// A question put and an answer returned: two voices, one exchange.
const AskedAnswered = svg(<>
  <path d="M1.8 4a1.4 1.4 0 0 1 1.4-1.4h5.6A1.4 1.4 0 0 1 10.2 4v2.8a1.4 1.4 0 0 1-1.4 1.4H4.6L2.4 10V8.2h-.6A1.4 1.4 0 0 1 1.8 6.8z" />
  <path d="M14.2 9.2a1.4 1.4 0 0 0-1.4-1.4H8.4A1.4 1.4 0 0 0 7 9.2V12a1.4 1.4 0 0 0 1.4 1.4h3.4l2.2 1.8v-1.8h.6" />
</>);

// A life laid out in years: a thread with its stops.
const Life = svg(<>
  <path d="M3 2.6v10.8" />
  <circle cx="3" cy="5" r="1.5" fill="#fdfdfe" />
  <circle cx="3" cy="11" r="1.5" fill="#fdfdfe" />
  <path d="M6.6 5h6.8M6.6 11h4.4" />
</>);

// A key held out: the authority committed, hand to hand.
const Keys = svg(<>
  <circle cx="5" cy="5.4" r="2.8" />
  <path d="M7 7.4 13 13.4M10.4 10.8l-1.6 1.6M12 12.4l-1.4 1.4" />
</>);

// A temple on its hill: the house, and the steps up to it.
const Temple = svg(<>
  <path d="M8 1.8 2.6 5.4h10.8z" />
  <path d="M4 5.4v6M8 5.4v6M12 5.4v6" />
  <path d="M2 11.4h12M1.4 13.8h13.2" />
</>);

// Two links of a chain: where every device in the chart ends. A baited hook
// stood here, and a hook at sixteen pixels is a stroke bending back on itself
// with a crossbar over it — it reads as a treble clef sooner than as a snare.
// The chain is the record's own figure for the same thing ("the chains of
// hell"), and it cannot be mistaken for anything else.
const Devices = svg(<>
  <rect x="1.6" y="5.4" width="7" height="5.2" rx="2.6" />
  <rect x="7.4" y="5.4" width="7" height="5.2" rx="2.6" />
</>);

// Two columns of text ruled alongside each other, the same line standing at the
// same height in both: a parallel, which is what the chart sets out. It shared
// the metaphors mark before — a circle beside a square, meaning one thing
// carried into the shape of another, which is a different claim entirely.
const Parallels = svg(<>
  <rect x="1.6" y="2.6" width="5.4" height="10.8" rx="1.2" />
  <rect x="9" y="2.6" width="5.4" height="10.8" rx="1.2" />
  <path d="M3.1 6.2h2.4M10.5 6.2h2.4M3.1 9.4h2.4M10.5 9.4h2.4" />
</>);

const BY_SLUG = {
  "questions-of-jesus": Asked,
  "questions-asked-of-jesus": Answered,
  "commands-of-jesus": Commands,
  "parables-of-jesus": Parables,
  "miracles-of-jesus": Miracles,
  "i-am-statements": IAm,
  "emotions-of-jesus": Emotions,
  "touch-of-jesus": Touch,
  "old-testament-in-his-words": Quoted,
  "metaphors-of-paul": Metaphors,
  "grace-and-works-in-paul": Balance,
  "letters-of-paul": Letters,
  "sermons-of-acts": Sermons,

  "names-of-god": NamesOfGod,
  "types-and-shadows": Types,
  "messianic-prophecies": Prophecy,
  "messianic-psalms": Psalms,
  "categories-of-the-psalms": Categories,
  "structure-of-job": Job,
  // The same sign done in an older age wants the same mark.
  "miracles-of-the-old-testament": Miracles,
  "women-of-the-old-testament": Women,
  "name-changes": NameChange,
  "scattering-and-gathering": Gathering,

  "anti-christs": AntiChrist,
  "thus-we-see": ThusWeSee,
  "war-chapters": War,

  "asked-and-answered": AskedAnswered,
  "name-of-the-church": NamePlate,
  "joseph-smith-life": Life,
  "priesthood-restoration": Keys,
  "temple-doctrine": Temple,

  "devils-devices": Devices,
  "biblical-parallels": Parallels,
};

// A chart not given a mark of its own is drawn as what it is: a table.
export const chartIcon = (slug) => BY_SLUG[slug] || Chart;
