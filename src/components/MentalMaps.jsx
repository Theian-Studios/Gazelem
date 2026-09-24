import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { glass, cardTint } from "../theme.js";
import { scanCites } from "../lib/cites.js";
import { parseCitations } from "../lib/refs.js";
import { MENTAL_MAPS, mentalMapBySlug, mentalMapPdf } from "../lib/mentalMaps.js";
import { MentalMapIcon } from "./SectionTile.jsx";
import { citeGroup } from "./Cited.jsx";

// The maps' data, all of it: ten small files, and the shelf draws each book's
// chapters in miniature, so it wants every one of them anyway. Eager here is
// safe — this module is itself only fetched when the shelf or a map is opened.
const DATA = Object.fromEntries(
  Object.entries(import.meta.glob("../data/mental-maps/*.json", { eager: true, import: "default" }))
    .map(([p, d]) => [p.split("/").pop().replace(/\.json$/, ""), d]));

// ---- Colour ----------------------------------------------------------------
// The print maps' own palette, so the page and the PDF beside it read as the
// same map. The villains and the narrator keep their colours in every book; the
// rest take the sequence in the order the book lists its threads.
const FIXED = { robbers: "#3B3733", dissent: "#3B3733", editorial: "#7A7266" };
const SEQUENCE = ["#1F3A5F", "#C08A2E", "#3F7A52", "#8C3A34", "#2E6F77", "#6B4C7A", "#3B3733"];

function paletteOf(data) {
  const out = {};
  let k = 0;
  for (const t of data.threads) out[t.id] = FIXED[t.id] || SEQUENCE[k++ % SEQUENCE.length];
  return out;
}

// ---- References --------------------------------------------------------------

const citeOf = (ref) => parseCitations(ref)[0] || null;

// "Alma 7:11-13" → "7:11–13": inside a book's own map, the book goes without
// saying.
const shortRef = (ref, book) =>
  (ref.startsWith(`${book} `) ? ref.slice(book.length + 1) : ref).replace(/-/g, "–");

const yearLabel = (y, approx) => `${approx ? "~" : ""}${y < 0 ? `${-y} BC` : `AD ${y}`}`;

// The maps' prose cites the book it is about the way a reader would — "(4:20)",
// "chs. 11–15" — with the book left unsaid. Full references are found by the
// site's own scan; what that leaves behind is read for these, and each is
// opened in this book.
const BARE = /(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?|\bchs?\. (\d{1,3})(?:[–-](\d{1,3}))?/g;

function bareRun(text, book, onOpenRef, key) {
  const out = [];
  let at = 0;
  BARE.lastIndex = 0;
  for (let m; (m = BARE.exec(text)); ) {
    // Part of a larger number, or a time of day — not a reference.
    if (m[1] && m.index > 0 && /[\d:]/.test(text[m.index - 1])) continue;
    const cite = m[1]
      ? citeOf(`${book} ${m[1]}:${m[2]}${m[3] ? `-${m[3]}` : ""}`)
      : citeOf(`${book} ${m[4]}`);
    if (!cite) continue;
    // An opening bracket travels with its reference, so a line never breaks
    // between the two — as it does for the full references (see citeGroup).
    const held = text[m.index - 1] === "(" && m.index - 1 >= at;
    const from = held ? m.index - 1 : m.index;
    if (from > at) out.push(<span key={`${key}-t${at}`}>{text.slice(at, from)}</span>);
    out.push(
      <span key={`${key}-c${m.index}`} className="cx-cite-group">
        {held ? "(" : ""}
        <button className="cx-cite mm-cite" onClick={() => onOpenRef(cite)}
          title={`Open ${book} ${m[1] ? `${m[1]}:${m[2]}` : m[4]}`}>
          {m[0]}
        </button>
      </span>
    );
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(<span key={`${key}-t${at}`}>{text.slice(at)}</span>);
  return out;
}

function Linked({ text, book, onOpenRef }) {
  if (!text) return null;
  return scanCites(text).flatMap((part, i) =>
    part.kind === "text"
      ? bareRun(part.text, book, onOpenRef, i)
      : [citeGroup(part, onOpenRef, `g${i}`)]);
}

// A full reference, set short and opening where it points.
function Ref({ refText, book, onOpenRef, className = "" }) {
  const cite = citeOf(refText);
  const label = shortRef(refText, book);
  if (!cite) return <span className={className}>{label}</span>;
  return (
    <button className={`cx-cite mm-cite ${className}`} onClick={() => onOpenRef(cite)} title={`Open ${refText}`}>
      {label}
    </button>
  );
}

// ---- The shelf ---------------------------------------------------------------

export function MentalMapGrid({ onOpen }) {
  return (
    <div className="pop">
      <h2 className="serif ev-shelf-title">Mental Maps</h2>
      <p className="ev-shelf-intro">
        Each longer book on one page: its chapters grouped by the story they
        follow, the threads of that story laid side by side against the clock,
        and the passages and dates worth carrying away. Every chapter, event and
        reference opens into the text.
      </p>
      <div className="ev-grid">
        {MENTAL_MAPS.map((m, i) => {
          const data = DATA[m.slug];
          const colors = paletteOf(data);
          return (
            <button key={m.slug} className="tap popin ev-tile mm-tile" onClick={() => onOpen(m.slug)}
              style={{ ...glass, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
              <span className="serif ev-tile-name">{m.book}</span>
              {/* The book's chapters in miniature, a sliver to a chapter in the
                  colour of its thread: the shape of the map before it is opened. */}
              <span className="mm-tile-band" aria-hidden>
                {data.chapters.map((c) => <span key={c.n} style={{ background: colors[c.thread] }} />)}
              </span>
              <span className="ev-tile-sub">{m.threads.join(" · ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- One map -------------------------------------------------------------------

const NUMWORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const numword = (n) => NUMWORDS[n] ?? String(n);

export function MentalMapPage({ slug, onOpenRef }) {
  const meta = mentalMapBySlug(slug);
  const data = DATA[slug];
  const colors = useMemo(() => (data ? paletteOf(data) : {}), [data]);
  if (!meta || !data) return null;
  const { book } = data;

  const span = data.clock.unit === "year"
    ? `${yearLabel(data.clock.start)} – ${yearLabel(data.clock.end)}`
    : null;

  return (
    <article className="pop">
      <div className="reader-card cx-card mm-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="cx-head">
          <span className="cx-mark" aria-hidden>{MentalMapIcon}</span>
          <h2 className="serif cx-title">{book}</h2>
          <p className="cx-sub">Mental map</p>
          <p className="mm-meta">
            {data.chapters.length} chapters{span && <> · {span}</>} · {numword(data.threads.length)} threads
            {" · "}
            <a className="mm-pdf" href={mentalMapPdf(slug)} target="_blank" rel="noopener">Print version (PDF)</a>
          </p>
        </header>

        <ul className="mm-legend">
          {data.threads.map((t) => (
            <li key={t.id}>
              <span className="mm-swatch" style={{ background: colors[t.id] }} aria-hidden />
              <span className="mm-legend-name">{t.name}</span>
              <span className="mm-legend-sub">{t.sub}</span>
            </li>
          ))}
        </ul>

        <section className="mm-part">
          <h3 className="serif mm-part-name">The chapters</h3>
          <ChapterBand data={data} colors={colors} onOpenRef={onOpenRef} />
        </section>

        <section className="mm-part">
          <h3 className="serif mm-part-name">The threads</h3>
          <p className="mm-gloss">
            {data.clock.unit === "year"
              ? "Set against the years the text itself counts. A dashed ring is a date the text implies rather than states."
              : "Set against the chapters, since the book mostly does not date itself."}
          </p>
          <Timeline data={data} colors={colors} onOpenRef={onOpenRef} />
        </section>

        <div className="mm-grid">
          <section className="mm-block">
            <h3 className="serif mm-part-name">Doctrinal address book</h3>
            <ul className="mm-rows">
              {data.doctrine.map((d, i) => (
                <li key={i}>
                  <Ref refText={d.ref} book={book} onOpenRef={onOpenRef} className="mm-row-key" />
                  <span className="serif mm-row-text">{d.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <Anchors data={data} onOpenRef={onOpenRef} />

          <MapTable table={data.table} book={book} onOpenRef={onOpenRef} />

          <section className="mm-block">
            <h3 className="serif mm-part-name">Memory hooks</h3>
            <ul className="mm-hooks">
              {data.hooks.map((h, i) => (
                <li key={i} className="serif"><Linked text={h} book={book} onOpenRef={onOpenRef} /></li>
              ))}
            </ul>
          </section>

          {(data.studies || []).map((s) => (
            s.rows
              ? <MapTable key={s.id} table={s} book={book} onOpenRef={onOpenRef} />
              : s.word ? <WordStudy key={s.id} study={s} book={book} onOpenRef={onOpenRef} /> : null
          ))}
        </div>
      </div>
    </article>
  );
}

// ---- The chapter band --------------------------------------------------------
// A chapter to a square, in its thread's colour, under the name of the stretch
// of the book it belongs to. Each square opens its chapter.
function ChapterBand({ data, colors, onOpenRef }) {
  const { book } = data;
  const byN = new Map(data.chapters.map((c) => [c.n, c]));
  const flashback = (n) => (data.flashbacks || []).find((f) => n >= f.from && n <= f.to);
  return (
    <>
      <div className="mm-band">
        {data.sections.map((s) => {
          const chs = [];
          for (let n = s.from; n <= s.to; n++) if (byN.has(n)) chs.push(byN.get(n));
          return (
            <div key={`${s.from}-${s.label}`} className="mm-sec" style={{ "--c": colors[s.thread] }}>
              <div className="mm-sec-label">{s.label}</div>
              <div className="mm-sec-rule" aria-hidden />
              <div className="mm-sec-chs">
                {chs.map((c) => {
                  const cite = citeOf(`${book} ${c.n}`);
                  return (
                    <button key={c.n} className="tap mm-ch" data-fb={flashback(c.n) ? "" : undefined}
                      onClick={() => cite && onOpenRef(cite)} title={`Open ${book} ${c.n}`}>
                      <span className="mm-ch-n" style={{ background: colors[c.thread] }}>{c.n}</span>
                      <span className="mm-ch-cap">{c.caption}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {(data.flashbacks || []).map((f) => (
        <p key={f.from} className="mm-flashback">
          <span className="mm-flashback-rule" aria-hidden />
          Flashback · chapters {f.from}–{f.to}: {f.label}
        </p>
      ))}
    </>
  );
}

// ---- The timeline ------------------------------------------------------------
// The threads as lanes, one above another, each event a ring on its lane where
// it falls on the book's clock — years where the text counts them, chapters
// where it does not. Drawn at the size it is read at: the drawing is as wide as
// the card, and never narrower than MIN_W, below which it scrolls sideways
// rather than shrinking its lettering out of reach.
const MIN_W = 760;
const NAME_W = 158;      // the lane names' column
const PITCH = 70;        // one lane to the next
// On a phone the names' column would take half of what can be seen at once,
// so there each lane's name stands over the start of it instead, and the
// drawing gives up the column's width.
const COMPACT_BELOW = 600;
const COMPACT_MIN_W = 620;
const COMPACT_PITCH = 92;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

let measureCtx = null;
function textWidth(s, size, weight = 600) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = `${weight} ${size}px ${FONT}`;
  return measureCtx.measureText(s).width;
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Timeline({ data, colors, onOpenRef }) {
  const box = useRef(null);
  const avail = useWidth(box);
  const compact = avail > 0 && avail < COMPACT_BELOW;
  const W = Math.max(avail, compact ? COMPACT_MIN_W : MIN_W);
  const layout = useMemo(() => (avail ? layOut(data, W, compact) : null), [data, W, avail, compact]);

  const open = (ref) => { const c = citeOf(ref); if (c) onOpenRef(c); };
  const keyOpen = (ref) => (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(ref); }
  };

  return (
    <div className="mm-tl-scroll" ref={box}>
      {layout && (
        <svg className="mm-tl" width={W} height={layout.H} viewBox={`0 0 ${W} ${layout.H}`}
          role="img" aria-label={`${data.book}: its threads against the ${data.clock.unit === "year" ? "years" : "chapters"}`}>
          {/* Turning points: a dashed rule down through every lane. */}
          {layout.turns.map((t, i) => (
            <g key={`tp${i}`} className="mm-ev" role="button" tabIndex={0}
              onClick={() => open(t.ref)} onKeyDown={keyOpen(t.ref)}>
              <title>{`Open ${t.ref}`}</title>
              <line x1={t.x} x2={t.x} y1={t.y + 5} y2={layout.AX - 3}
                stroke={colors[t.thread]} strokeWidth="1" strokeDasharray="3 4" />
              <text x={t.lx} y={t.y} textAnchor="middle" className="mm-tl-label mm-tl-turn"
                fill={colors[t.thread]} fontSize={t.fs}>{t.label}</text>
            </g>
          ))}

          {layout.lanes.map((lane) => {
            const col = colors[lane.id];
            return (
              <g key={lane.id}>
                {compact ? (
                  <text x={0} y={lane.y - 36} className="mm-tl-name" fill={col}>
                    {lane.name.toUpperCase()}
                    <tspan className="mm-tl-sub" dx="8">{lane.sub}</tspan>
                  </text>
                ) : (
                  <>
                    <text x={0} y={lane.y - 3} className="mm-tl-name" fill={col}>{lane.name.toUpperCase()}</text>
                    <text x={0} y={lane.y + 12} className="mm-tl-sub">{lane.sub}</text>
                  </>
                )}
                {lane.turn != null ? (
                  <>
                    <line x1={lane.a} x2={lane.turn} y1={lane.y} y2={lane.y} stroke={col} strokeWidth="1.6" strokeDasharray="3 3" />
                    <line x1={lane.turn} x2={lane.b} y1={lane.y} y2={lane.y} stroke={col} strokeWidth="3.4" />
                  </>
                ) : (
                  <line x1={lane.a} x2={lane.b} y1={lane.y} y2={lane.y} stroke={col} strokeWidth="2.6" strokeLinecap="round" />
                )}
                {lane.events.map((e, i) => {
                  const c = colors[e.voice] || col;
                  const below = e.ly > lane.y;
                  return (
                    <g key={i} className="mm-ev" role="button" tabIndex={0}
                      onClick={() => open(e.ref)} onKeyDown={keyOpen(e.ref)}>
                      <title>{`Open ${e.ref}`}</title>
                      {Math.abs(e.lx - e.x) > 2 && (
                        <line x1={e.x} y1={below ? lane.y + 5 : lane.y - 5}
                          x2={e.lx} y2={below ? e.ly - e.fs + 1 : e.ly + 3}
                          stroke={c} strokeWidth="0.6" />
                      )}
                      <circle cx={e.x} cy={lane.y} r="4.6" className="mm-tl-dot" stroke={c}
                        strokeDasharray={e.approx ? "1.6 1.6" : undefined} />
                      <text x={e.lx} y={e.ly} textAnchor="middle" className="mm-tl-label"
                        fill={c} fontSize={e.fs}>{e.text}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <line x1={layout.TX0} x2={layout.TX1} y1={layout.AX} y2={layout.AX} className="mm-tl-axis" />
          {layout.ticks.map((t) => (
            <g key={t.label}>
              <line x1={t.x} x2={t.x} y1={layout.AX} y2={layout.AX + 5} className="mm-tl-axis" />
              <text x={t.x} y={layout.AX + 18} textAnchor="middle" className="mm-tl-tick">{t.label}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// Where everything on the timeline goes. The same reasoning the print map's
// builder uses, measured in the browser's own type: labels are pushed apart
// along their lane until none overlap, and a lane too crowded for one row of
// them splits its labels above and below the line.
function layOut(data, W, compact) {
  const clk = data.clock;
  const verses = new Map(data.chapters.map((c) => [c.n, c.verses]));
  const years = clk.unit === "year";
  const t0 = years ? clk.start : 0;
  const t1 = years ? clk.end : data.chapters.length;
  const TX0 = compact ? 8 : NAME_W + 12;
  const pitch = compact ? COMPACT_PITCH : PITCH;
  const TX1 = W - 14;
  const px = (t) => TX0 + ((t - t0) / (t1 - t0)) * (TX1 - TX0);

  const position = (e) => {
    if (years) return e.at;
    const m = /(\d+)(?::(\d+))?(?:-\d+)?$/.exec(e.ref);
    const ch = Number(m[1]);
    if (!m[2]) return ch - 0.5;
    return ch - 1 + (Number(m[2]) - 0.5) / Math.max(verses.get(ch) || 1, 1);
  };

  // Turning points first, since they set how much room the top needs: a label
  // that would collide with one already placed steps up a row.
  const TFS = 11.5;
  const placed = [];
  const turns = [...data.turning_points].sort((a, b) => position(a) - position(b)).map((tp) => {
    const x = px(position(tp));
    const lw = textWidth(tp.label, TFS, 700);
    const lx = Math.min(Math.max(x, TX0 + lw / 2), TX1 - lw / 2);
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(lx - p.lx) < (lw + p.lw) / 2 + 10)) row++;
    placed.push({ lx, lw, row });
    return { ...tp, x, lx, row, fs: TFS };
  });
  const rows = turns.length ? Math.max(...turns.map((t) => t.row)) + 1 : 0;
  const tpBase = 14 + (rows - 1) * 15;
  for (const t of turns) t.y = tpBase - t.row * 15;

  const by = new Map();
  for (const e of data.events) {
    if (!by.has(e.thread)) by.set(e.thread, []);
    by.get(e.thread).push(e);
  }
  const threads = data.threads.filter((t) => by.has(t.id));
  const first = (rows ? tpBase + 40 : 26) + (compact ? 26 : 0);

  const LMIN = compact ? 2 : TX0 - 6;
  const LMAX = W - 2;
  const resolve = (items, fs) => {
    const srt = [...items].sort((a, b) => a.x - b.x);
    const ws = srt.map((it) => textWidth(it.text, fs));
    const pos = srt.map((it) => it.x);
    for (let i = 1; i < pos.length; i++) {
      const need = pos[i - 1] + (ws[i - 1] + ws[i]) / 2 + 9;
      if (pos[i] < need) pos[i] = need;
    }
    if (!pos.length) return { ok: true, out: [], drift: 0 };
    const over = pos[pos.length - 1] + ws[ws.length - 1] / 2 - LMAX;
    if (over > 0) for (let i = 0; i < pos.length; i++) pos[i] -= over;
    const under = LMIN - (pos[0] - ws[0] / 2);
    const ok = under <= 0;
    if (under > 0) for (let i = 0; i < pos.length; i++) pos[i] += under;
    const drift = Math.max(0, ...srt.map((it, i) => Math.abs(pos[i] - it.x)));
    return { ok, drift, out: srt.map((it, i) => ({ ...it, lx: pos[i], fs })) };
  };

  const lanes = threads.map((th, i) => {
    const y = first + i * pitch;
    const evs = by.get(th.id).map((e) => ({ ...e, x: px(position(e)), text: `${e.label} (${shortRef(e.ref, data.book)})` }));
    let a;
    let b;
    if (years) {
      a = px(th.start ?? t0);
      b = px(th.end ?? t1);
    } else {
      const ps = evs.map((e) => position(e));
      a = px(Math.max(t0, Math.min(...ps) - 0.3));
      b = px(Math.min(t1, Math.max(...ps) + 0.3));
    }

    let events = null;
    for (const fs of [12, 11.5, 11]) {
      const r = resolve(evs, fs);
      if (r.ok && r.drift <= 80) { events = r.out.map((e) => ({ ...e, ly: y - 9 })); break; }
    }
    if (!events) {
      const srt = [...evs].sort((p, q) => p.x - q.x);
      const up = resolve(srt.filter((_, k) => k % 2 === 0), 11).out.map((e) => ({ ...e, ly: y - 9 }));
      const dn = resolve(srt.filter((_, k) => k % 2 === 1), 11).out.map((e) => ({ ...e, ly: y + 20 }));
      events = [...up, ...dn];
    }
    return {
      id: th.id, name: th.name, sub: th.sub, y, a, b,
      turn: th.turns != null && years ? px(th.turns) : null,
      events,
    };
  });

  const AX = (lanes.length ? lanes[lanes.length - 1].y : first) + 38;

  let ticks;
  if (years) {
    const span = t1 - t0;
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => span / s <= Math.max(6, Math.floor((TX1 - TX0) / 80)));
    const list = [];
    for (let y = Math.ceil(t0 / step) * step; y <= t1; y += step) list.push(y);
    if (list.length && list[0] - t0 > step * 0.4) list.unshift(t0);
    if (list.length && t1 - list[list.length - 1] > step * 0.4) list.push(t1);
    ticks = list.map((y) => ({ x: px(y), label: y === 0 ? "AD 1" : yearLabel(y) }));
  } else {
    const N = data.chapters.length;
    const step = N <= 16 ? 1 : N <= 40 ? 5 : 10;
    const marks = [1];
    for (let k = step; k <= N; k += step) if (k !== 1) marks.push(k);
    if (!marks.includes(N)) marks.push(N);
    ticks = marks.map((k) => ({ x: px(k - 0.5), label: k === 1 ? "ch. 1" : String(k) }));
  }

  return { H: AX + 26, AX, TX0, TX1, turns, lanes, ticks };
}

// ---- The page's smaller blocks -----------------------------------------------

function Anchors({ data, onOpenRef }) {
  const { book, anchors } = data;
  const dated = anchors.every((a) => a.year != null);
  return (
    <section className="mm-block">
      <h3 className="serif mm-part-name">
        {`${numword(anchors.length)} ${dated ? "dates" : "moments"} to anchor it`.replace(/^./, (c) => c.toUpperCase())}
      </h3>
      <ul className="mm-rows">
        {anchors.map((a, i) => (
          <li key={i}>
            {a.year != null
              ? <span className="mm-row-key mm-year">{yearLabel(a.year, a.approx)}</span>
              : <Ref refText={a.ref} book={book} onOpenRef={onOpenRef} className="mm-row-key" />}
            <span className="serif mm-row-text">
              {a.text}
              {a.year != null && <> <span className="mm-paren">(<Ref refText={a.ref} book={book} onOpenRef={onOpenRef} />)</span></>}
            </span>
          </li>
        ))}
      </ul>
      {data.anchors_note && <p className="mm-note"><Linked text={data.anchors_note} book={book} onOpenRef={onOpenRef} /></p>}
    </section>
  );
}

function MapTable({ table, book, onOpenRef }) {
  const cols = table.columns;
  const hasRef = cols[cols.length - 1] === "ref";
  const body = hasRef ? cols.slice(0, -1) : cols;
  return (
    <section className="mm-block">
      <h3 className="serif mm-part-name">{table.title}</h3>
      <div className="mm-table-scroll">
        <table className="mm-table">
          {body.some(Boolean) && (
            <thead>
              <tr>
                {body.map((c, i) => <th key={i}>{c}</th>)}
                {hasRef && <th aria-label="reference" />}
              </tr>
            </thead>
          )}
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={ri}>
                {body.map((_, ci) => (
                  <td key={ci} className={ci === 0 ? "serif mm-td-lead" : "mm-td"}>
                    <Linked text={String(r[ci] ?? "")} book={book} onOpenRef={onOpenRef} />
                  </td>
                ))}
                {hasRef && (
                  <td className="mm-td-ref"><Ref refText={r[r.length - 1]} book={book} onOpenRef={onOpenRef} /></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="mm-note"><Linked text={table.note} book={book} onOpenRef={onOpenRef} /></p>}
    </section>
  );
}

// One word counted through one chapter: the verses it stands in, each opening,
// with the ones that carry it twice marked so.
function WordStudy({ study, book, onOpenRef }) {
  const twice = new Set(study.doubled_in || []);
  return (
    <section className="mm-block">
      <h3 className="serif mm-part-name">{study.title}</h3>
      <p className="mm-word">
        <span className="serif mm-word-itself">“{study.word}”</span>
        <span className="mm-word-count">{study.count}× in chapter {study.chapter}</span>
      </p>
      <div className="mm-verses">
        {study.verses.map((v) => {
          const ref = `${book} ${study.chapter}:${v}`;
          return (
            <button key={v} className="tap mm-verse" onClick={() => { const c = citeOf(ref); if (c) onOpenRef(c); }}
              title={`Open ${ref}`}>
              {study.chapter}:{v}{twice.has(v) && <span className="mm-verse-twice">×2</span>}
            </button>
          );
        })}
      </div>
      {study.elsewhere && <p className="mm-note">Elsewhere: {study.elsewhere}.</p>}
      {study.note && <p className="mm-note mm-note-body"><Linked text={study.note} book={book} onOpenRef={onOpenRef} /></p>}
    </section>
  );
}
