import { useEffect, useMemo, useRef, useState } from "react";
import { glass } from "../theme.js";
import { webWithin } from "../lib/related.js";

// The volume as a ring, and every parallel inside it struck across the middle.
//
// The chart it is drawn from is already on the site twice over: beside a
// chapter, as the list of what else reads with it. That answers the reader who
// is in a chapter. This answers the one who is not — where do the parallels
// run at all — and the answer is a shape rather than a list: Alma talking to
// Mosiah again and again down one side, the Isaiah chapters of 2 Nephi silent
// because their parallels are outside this book, one long line from Alma 32 to
// Ether 12 across the whole record.
//
// Every chapter is on the ring whether it carries a link or not, because the
// silence is half of what the shape says. The ones that do are marked and
// named; the rest are ticks, and still open when pressed.
//
// Alma alone puts sixty-three chapters on a quarter of the ring, which is more
// than a pointer can pick between — so the ring has a lens. The marks nearest
// the pointer swell, the nearest of all swells most, and a chapter that was a
// speck becomes something to aim at. The ring itself never moves: nothing is
// zoomed, nothing scrolls away, and the whole shape stays on screen while a
// single chapter is being picked out of it.
//
// The links are read from the same markdown the chapter card reads, so the two
// can never disagree, and nothing here is a second copy of the chart.

const SIZE = 1000;
const MID = SIZE / 2;
const R_CHORD = 291;   // where a link leaves the ring
const R_DOT = 303;     // the chapter marks
const R_BAND = 313;    // the book bands, drawn outward from here
const BAND = 15;
const R_NUM = 337;     // the numbers, outside the bands
const R_LABEL = 382;   // the book names, left room for the numbers to rise into
const GAP = 1.15;      // degrees of air between one book and the next

// The lens.
//
// It works along the ring rather than across the screen: what matters is how
// many chapters away a mark is from the one being aimed at, and the ring's
// crowding is an angular crowding. SPAN is how far round it reaches — about
// four chapters either side in the Book of Mormon, which is a handful under
// the pointer rather than a whole book of them.
//
// The spreading is the part that makes it usable. Growing crowded marks in
// place only makes them overlap, so the chapters the lens holds are set MAG
// times further apart than they lie — all of them by the same measure, so the
// room is shared out evenly rather than spent on the one in the middle. The
// ring either side gives that room up and closes again by SPAN, so the rest of
// the drawing is left where it was.
//
// Their numbers rise outward as they swell — away from the ring, out of the
// crowd, into the clear ground below the book names — and each is set to the
// room it has actually been given, so no number is ever drawn over its
// neighbour. One too cramped to read is not drawn at all.
const WIN = 4.5;         // degrees of ring the lens holds, either side
const MAG = 3;           // how much wider it sets the chapters it holds
const SPAN = 16;         // and how far out the room for that is borrowed from
const RING_REACH = 115;  // how far off the ring the pointer may be
// Every mark is drawn toward one size as the lens takes it, rather than each
// being multiplied by its own. A linked chapter rests at nearly twice the size
// of a plain one, and multiplying left a chapter further off bigger than one
// nearer the pointer — which is exactly backwards for aiming at. Drawn toward
// a common size, nearness alone decides how big a mark is, and at the middle
// of the lens they are all the same thing to hit.
const TOP = 14;
const RISE = 23;         // how far a number climbs at the middle of the lens
const NUM_MAX = 23;      // as large as a number is ever set
const NUM_MIN = 14;      // below which it is not worth showing at all
// Where a chapter is held closely enough to be worth naming. No chapter is
// numbered at rest: two hundred and thirty-nine numbers set round a ring this
// size are a grey fringe rather than a set of labels — at rest they overlapped
// one another and the book names both. A number appears when the lens is on
// its chapter, by which point it has the size and the room to be read.
const NAMED = 0.1;

// The Book of Mormon's own sequence of colour: the Nephite record opens in
// blue, darkens through Mosiah into the red of the war chapters, turns gold
// where Christ comes, and ends green in the Jaredite record and Moroni. A book
// the table does not name falls back to grey rather than borrowing a colour
// that would read as kinship.
const HUE = {
  "1 Nephi": "#1f5b96", "2 Nephi": "#3f83bf", "Jacob": "#63a3d2", "Enos": "#8bc0e6",
  "Jarom": "#a6d0ee", "Omni": "#c0dff4", "Words of Mormon": "#9186ab",
  "Mosiah": "#6e4f8e", "Alma": "#8d2f36", "Helaman": "#b5564a", "3 Nephi": "#c8892c",
  "4 Nephi": "#dcab48", "Mormon": "#6f8f6a", "Ether": "#3f7a56", "Moroni": "#1f6b4a",
};
const hueOf = (book) => HUE[book] || "#8a8f99";

const rad = (deg) => (deg * Math.PI) / 180;
const at = (r, deg) => [MID + r * Math.cos(rad(deg)), MID + r * Math.sin(rad(deg))];

// An annular sector: the band a book occupies on the ring.
function band(r0, r1, a0, a1) {
  const [x0, y0] = at(r1, a0), [x1, y1] = at(r1, a1);
  const [x2, y2] = at(r0, a1), [x3, y3] = at(r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
}

// The arc a book's name is set along, turned back on itself in the lower half
// so that no label is ever read upside down.
function labelArc(a0, a1) {
  // The air between two books belongs to neither, so a name may take half of
  // it at each end — which is the difference between "Mormon" and "Mormo".
  a0 -= GAP / 2;
  a1 += GAP / 2;
  const under = (a0 + a1) / 2 > 0 && (a0 + a1) / 2 < 180;
  const [s, e] = under ? [a1, a0] : [a0, a1];
  // Letters stand on the outside of the curve they are set along, and a
  // reversed curve puts them on its inside — so the lower half's arc is struck
  // wider, leaving its names in the same band as the upper half's rather than
  // down among the chapter numbers.
  const r = under ? R_LABEL + 23 : R_LABEL;
  const [x0, y0] = at(r, s), [x1, y1] = at(r, e);
  return `M${x0} ${y0}A${r} ${r} 0 0 ${under ? 0 : 1} ${x1} ${y1}`;
}

export default function ChapterWeb({ volume, volId, books, onOpen }) {
  // What the pointer is on, which lights that chapter's links and dims the
  // rest. Held here rather than in CSS because a link is lit from either end,
  // and no selector can say "the chord whose other end is this dot".
  const [lit, setLit] = useState(null);

  const svgRef = useRef(null);
  // The lens writes sizes straight onto the marks rather than through state:
  // two hundred and thirty-nine of them change on every movement of the
  // pointer, and a render apiece is a render too many.
  const marks = useRef([]);
  const hot = useRef(new Set());
  const spot = useRef(null);
  const frame = useRef(0);

  const web = useMemo(() => {
    if (!books?.length) return null;

    const total = books.reduce((n, b) => n + b.chapters.length, 0);
    const span = 360 - GAP * books.length;
    // Starting at the top and running clockwise, the way the record is read.
    let a = -90 + GAP / 2;
    const arcs = books.map((b, bookIdx) => {
      const sweep = (span * b.chapters.length) / total;
      const arc = { name: b.name, bookIdx, start: a, sweep, chapters: b.chapters };
      a += sweep + GAP;
      return arc;
    });

    // Where each chapter sits on the ring, by the name a citation would use.
    const place = new Map();
    for (const arc of arcs) {
      arc.chapters.forEach((c, chapIdx) => {
        place.set(`${arc.name} ${c.n}`, {
          book: arc.name, n: c.n, bookIdx: arc.bookIdx, chapIdx,
          deg: arc.start + (arc.sweep * (chapIdx + 0.5)) / arc.chapters.length,
        });
      });
    }

    // A link whose chapter is not in the volume as the reader has it — a
    // chart row ahead of the text — is dropped rather than drawn to nowhere.
    const links = [];
    for (const l of webWithin(volId)) {
      const from = place.get(`${l.from.book} ${l.from.chapter}`);
      const to = place.get(`${l.to.book} ${l.to.chapter}`);
      if (from && to) links.push({ from, to, key: `${l.from.book} ${l.from.chapter}|${l.to.book} ${l.to.chapter}` });
    }

    const tied = new Map();
    for (const l of links) {
      for (const [end, other] of [[l.from, l.to], [l.to, l.from]]) {
        const key = `${end.book} ${end.n}`;
        if (!tied.has(key)) tied.set(key, []);
        tied.get(key).push(`${other.book} ${other.n}`);
      }
    }

    return { arcs, place, links, tied, total };
  }, [books, volId]);

  // Every mark, with where it stands and what size it rests at, gathered from
  // the drawing once rather than threaded through as a ref apiece.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    marks.current = [...el.querySelectorAll(".web-mark")].map((g) => ({
      dot: g.querySelector(".web-dot"),
      hit: g.querySelector(".web-hit"),
      num: g.querySelector(".web-num"),
      numg: g.querySelector(".web-numg"),
      deg: Number(g.dataset.deg),
      // The stretch of ring its own book holds: a mark is pushed about inside
      // that and no further, so no chapter is ever shoved onto the band of the
      // book next door.
      lo: Number(g.dataset.lo),
      hi: Number(g.dataset.hi),
      base: Number(g.dataset.base),
      tied: g.dataset.tied !== undefined,
    }));
  }, [web]);

  // Lays the lens over the ring: what is under the pointer grows, moves clear
  // of its neighbours, and puts its number up where it can be read. Everything
  // else is left exactly as the drawing has it.
  const lens = () => {
    frame.current = 0;
    const p = spot.current;

    // Where on the ring the pointer is aiming, and how much of the lens it is
    // asking for: full against the ring, nothing once it has wandered off into
    // the middle of the drawing or out past the book names.
    let aim = null;
    if (p) {
      const off = Math.abs(Math.hypot(p.x - MID, p.y - MID) - R_DOT);
      if (off < RING_REACH) {
        aim = {
          deg: (Math.atan2(p.y - MID, p.x - MID) * 180) / Math.PI,
          held: Math.cos((off / RING_REACH) * (Math.PI / 2)) ** 2,
        };
      }
    }

    // Where every chapter stands under the lens, worked out before any of them
    // is drawn: a number is sized by the room between its own mark and the two
    // beside it, and that is not known until all three have moved.
    const all = marks.current;
    const degs = new Array(all.length);
    const force = new Array(all.length);
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      degs[i] = m.deg;
      force[i] = 0;
      if (!aim) continue;
      let away = m.deg - aim.deg;
      while (away > 180) away -= 360;
      while (away < -180) away += 360;
      const off = Math.abs(away);
      if (off < WIN) {
        // Held: set further apart by the same measure as its neighbours, and
        // swollen by how near the middle of the lens it is.
        degs[i] = Math.min(m.hi, Math.max(m.lo, m.deg + away * (MAG - 1)));
        force[i] = aim.held * Math.cos((off / WIN) * (Math.PI / 2)) ** 2;
      } else if (off < SPAN) {
        // Outside it, and giving up the room the held chapters are using —
        // by as much at the edge of the lens as they take, and by nothing at
        // all by SPAN, so the ring closes smoothly rather than in a step.
        const give = WIN * (MAG - 1) * (1 - (off - WIN) / (SPAN - WIN));
        degs[i] = Math.min(m.hi, Math.max(m.lo, m.deg + Math.sign(away) * give));
      }
    }

    const held = new Set();
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      const moved = degs[i] !== m.deg || force[i] > 0;
      if (moved) held.add(m);
      else if (!hot.current.has(m)) continue;
      // The room this chapter has been given, taken from whichever of its
      // neighbours ended up nearer.
      const gap = Math.min(
        i > 0 ? Math.abs(degs[i] - degs[i - 1]) : Infinity,
        i < all.length - 1 ? Math.abs(degs[i + 1] - degs[i]) : Infinity,
      );
      lay(m, force[i], degs[i], gap);
    }
    hot.current = held;
  };

  // One mark, set to what the lens makes of it.
  const lay = (m, force, deg, gap) => {
    const r = m.base + (TOP - m.base) * force;
    const [x, y] = at(R_DOT, deg);
    m.dot.setAttribute("cx", x.toFixed(2));
    m.dot.setAttribute("cy", y.toFixed(2));
    m.dot.setAttribute("r", r.toFixed(2));
    // The target moves and grows with the mark, and never shrinks below the
    // one a resting mark carries — the whole point is that it is easier to hit.
    m.hit.setAttribute("cx", x.toFixed(2));
    m.hit.setAttribute("cy", y.toFixed(2));
    m.hit.setAttribute("r", Math.max(9, r * 1.7).toFixed(2));
    if (!m.num) return;

    // The number follows its own mark round, climbs away from the ring as the
    // mark swells, and is set bigger — a number that has been magnified but
    // left in the crowd is no more readable than it was.
    const up = R_NUM + RISE * force;
    const flip = deg > 90 && deg < 270;
    m.numg.setAttribute("transform", `rotate(${deg.toFixed(2)} ${MID} ${MID}) translate(${MID} ${MID})`);
    m.num.setAttribute("x", (flip ? -up : up).toFixed(2));
    m.num.setAttribute("text-anchor", flip ? "end" : "start");
    if (flip) m.num.setAttribute("transform", "rotate(180)");
    else m.num.removeAttribute("transform");
    // Set to the room between this mark and its neighbour, measured where the
    // number itself stands: a number is laid along the radius, so what it
    // needs is the width of that gap, and taking it is what keeps two numbers
    // from ever being drawn over one another.
    const room = rad(gap) * up;
    const size = Math.min(NUM_MAX, room * 0.92);
    m.num.style.fontSize = `${size.toFixed(2)}px`;
    // Named once the lens has it — and only while the room it has been given
    // is enough to read it in.
    m.num.style.opacity = force >= NAMED && size >= NUM_MIN ? "1" : "0";
  };

  // Lighting a chapter renders the card again, which puts every mark back to
  // the size the drawing gives it — so the lens is laid over the result of
  // every render, not only of every movement.
  useEffect(lens);

  const track = (e) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    spot.current = {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
    if (!frame.current) frame.current = requestAnimationFrame(lens);
  };
  const away = () => {
    spot.current = null;
    if (!frame.current) frame.current = requestAnimationFrame(lens);
  };
  useEffect(() => () => frame.current && cancelAnimationFrame(frame.current), []);

  if (!web || !web.links.length) return null;
  const { arcs, links, tied, total } = web;
  const litTo = lit ? tied.get(lit) : null;

  return (
    <article className="pop">
      <div className="reader-card web-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="web-head">
          <h2 className="serif web-title">The Web</h2>
          <p className="web-sub">{volume.title}</p>
          <p className="web-intro">
            Every chapter of the volume set round the ring in reading order and
            coloured by its book. Each line links two chapters with a strong
            thematic, doctrinal or narrative parallel; the marked chapters are
            the ones a line reaches. Come near the ring and the chapters under
            the pointer swell, the nearest most of all, so that even Alma's
            sixty-three can be taken one at a time. Rest on one to see what it
            answers to, or press it to read it.
          </p>
        </header>

        <figure className="web-figure">
          <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="web-ring"
            onPointerMove={track} onPointerLeave={away} onPointerCancel={away}
            role="img" aria-label={`${links.length} parallels between chapters of the ${volume.title}`}>
            {/* The chords first, so the ring and its marks sit over them. */}
            <g className="web-chords" data-lit={lit ? "" : undefined}>
              {links.map((l) => {
                const [x0, y0] = at(R_CHORD, l.from.deg);
                const [x1, y1] = at(R_CHORD, l.to.deg);
                // Bowed toward the middle rather than struck straight across:
                // two chords between neighbouring chapters would otherwise lie
                // on top of one another.
                const cx = MID + ((x0 + x1) / 2 - MID) * 0.22;
                const cy = MID + ((y0 + y1) / 2 - MID) * 0.22;
                const on = lit === `${l.from.book} ${l.from.n}` || lit === `${l.to.book} ${l.to.n}`;
                return (
                  <path key={l.key} d={`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`}
                    className="web-chord" data-on={on || undefined}
                    stroke={hueOf(l.from.book)} fill="none" />
                );
              })}
            </g>

            {arcs.map((arc) => {
              const a0 = arc.start, a1 = arc.start + arc.sweep;
              const hue = hueOf(arc.name);
              // A name set along an arc is simply cut off where the arc ends —
              // "Mormon" on nine chapters' worth of ring became "ORMO" — so
              // each name is sized to the arc it has to live on. Where even
              // that would be too small to read, the book is treated as a
              // one-chapter book is: its name stands off the ring on a rule.
              const room = rad(arc.sweep + GAP) * R_LABEL;
              // Roughly the width of a capital and its tracking, as a share of
              // the size: enough that a name is set a little small rather than
              // set flush to the ends of its arc and clipped by a pixel.
              const fits = room / (arc.name.length * 0.86);
              const tiny = fits < 12;
              const [lx, ly] = at(R_LABEL + 6, (a0 + a1) / 2);
              return (
                <g key={arc.name}>
                  <path d={band(R_BAND, R_BAND + BAND, a0, a1)} fill={hue} />
                  {tiny ? (
                    <>
                      <line {...lineProps(a0, a1)} stroke={hue} strokeWidth="1.2" opacity=".5" />
                      <text x={lx} y={ly} className="web-book web-book-tiny" fill={hue}
                        textAnchor={(a0 + a1) / 2 > 90 && (a0 + a1) / 2 < 270 ? "end" : "start"}
                        dominantBaseline="middle">
                        {arc.name}
                      </text>
                    </>
                  ) : (
                    <>
                      <path id={`web-arc-${arc.bookIdx}`} d={labelArc(a0, a1)} fill="none" />
                      <text className="web-book" fill={hue} style={{ "--book": Math.min(21, fits) }}>
                        <textPath href={`#web-arc-${arc.bookIdx}`} startOffset="50%" textAnchor="middle">
                          {arc.name}
                        </textPath>
                      </text>
                    </>
                  )}

                  {arc.chapters.map((c, i) => {
                    const deg = arc.start + (arc.sweep * (i + 0.5)) / arc.chapters.length;
                    const key = `${arc.name} ${c.n}`;
                    const ties = tied.get(key);
                    const [x, y] = at(R_DOT, deg);
                    const dim = lit && lit !== key && !litTo?.includes(key);
                    const said = ties
                      ? `${key} — with ${ties.join(", ")}`
                      : `${key} — no parallel inside this volume`;
                    const base = ties ? 6 : 3.4;
                    return (
                      <g key={c.n} className="web-mark" data-tied={ties ? "" : undefined}
                        data-dim={dim ? "" : undefined}
                        data-deg={deg.toFixed(3)} data-lo={a0.toFixed(3)} data-hi={a1.toFixed(3)}
                        data-base={base}
                        role="button" tabIndex={ties ? 0 : -1} aria-label={said}
                        onClick={() => onOpen(arc.bookIdx, i)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          onOpen(arc.bookIdx, i);
                        }}
                        onPointerEnter={() => setLit(key)}
                        onPointerLeave={() => setLit(null)}
                        onFocus={() => setLit(key)}
                        onBlur={() => setLit(null)}>
                        <title>{said}</title>
                        {/* A generous invisible target under a small mark: the
                            dot is a few units across and a pointer is not. The
                            lens grows this along with what it sits under. */}
                        <circle className="web-hit" cx={x} cy={y} r="9" fill="transparent" />
                        <circle className="web-dot" cx={x} cy={y} r={base}
                          fill={ties ? hueOf(arc.name) : "rgba(120,124,134,.42)"} />
                        <ChapterNumber n={c.n} deg={deg}
                          hue={ties ? hueOf(arc.name) : "rgba(96,100,110,.9)"} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* What the lit chapter answers to. The line keeps its height whether
              or not it is saying anything, so the drawing does not jump as the
              pointer crosses a mark. */}
          <figcaption className="web-said" aria-live="polite">
            {lit && (
              <>
                <span className="serif web-said-name">{lit}</span>
                {litTo?.length
                  ? <span className="web-said-note">with {litTo.join(" · ")}</span>
                  : <span className="web-said-note">no parallel inside this volume</span>}
              </>
            )}
          </figcaption>
        </figure>

        {/* The same thirty-four links written out. The ring shows where they
            run; this is how they are read on a phone, and how they are reached
            by anyone who is not using a pointer at all. */}
        <ul className="web-list">
          {links.map((l) => (
            <li key={l.key} className="web-pair"
              onPointerEnter={() => setLit(`${l.from.book} ${l.from.n}`)}
              onPointerLeave={() => setLit(null)}>
              <button className="web-jump" onClick={() => onOpen(l.from.bookIdx, l.from.chapIdx)}
                style={{ borderColor: hueOf(l.from.book) }}>
                {l.from.book} {l.from.n}
              </button>
              <span className="web-tie" aria-hidden>↔</span>
              <button className="web-jump" onClick={() => onOpen(l.to.bookIdx, l.to.chapIdx)}
                style={{ borderColor: hueOf(l.to.book) }}>
                {l.to.book} {l.to.n}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

// The rule a one-chapter book's name stands on, from the ring out to the name.
function lineProps(a0, a1) {
  const mid = (a0 + a1) / 2;
  const [x1, y1] = at(R_BAND + BAND, mid);
  const [x2, y2] = at(R_LABEL, mid);
  return { x1, y1, x2, y2 };
}

// A chapter's number, set on the radius and turned back in the left half of
// the ring so it reads the right way up wherever it falls. Drawn for every
// chapter but held at nothing until the lens reaches it, which is when it is
// moved out, set larger, and shown.
function ChapterNumber({ n, deg, hue }) {
  const flip = deg > 90 && deg < 270;
  return (
    <g className="web-numg" transform={`rotate(${deg} ${MID} ${MID}) translate(${MID} ${MID})`}>
      <text className="web-num" fill={hue} style={{ opacity: 0 }}
        x={flip ? -R_NUM : R_NUM} y="0"
        transform={flip ? "rotate(180)" : undefined}
        textAnchor={flip ? "end" : "start"} dominantBaseline="middle">
        {n}
      </text>
    </g>
  );
}
