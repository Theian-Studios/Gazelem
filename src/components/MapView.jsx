import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { glass } from "../theme.js";
import { VIEW, ARTWORK, PLACES, KINDS, DIVIDE, depthAt, kindOf, namesOf } from "../lib/mapPlaces.js";
import { parseCitations } from "../lib/refs.js";
import { citedRun } from "./Cited.jsx";

const MAX_ZOOM = 7;
// Close enough in to see the place named among its neighbours. The name asked
// for shows whatever tier it belongs to, since a chosen place is always named.
const FLY_ZOOM = 3.4;

// A reference set as a link into the text it names. Bracketed, as the
// prophets' are, and travelling with its brackets as one word.
function Cite({ label, onOpenRef }) {
  const cite = parseCitations(label)[0];
  const inner = !cite || !onOpenRef
    ? <span className="map-cite">{label}</span>
    : <button className="map-cite" onClick={() => onOpenRef(cite)} title={`Open ${label}`}>{label}</button>;
  return <span className="map-ref-group"> ({inner})</span>;
}

export default function MapView({ onOpenRef }) {
  // The window onto the artwork: how far it is opened out, and which point of
  // it sits in the middle.
  const [view, setView] = useState({ z: 1, x: VIEW.w / 2, y: VIEW.h / 2 });
  const [picked, setPicked] = useState(null);
  const [find, setFind] = useState("");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const frame = useRef(null);
  const main = useRef(null);
  const drag = useRef(null);
  // Whether the press underway has become a drag. A drag that happens to end
  // over a place must not also choose it.
  const dragged = useRef(false);

  // The frame's own size, watched rather than assumed: its width decides how
  // much lettering there is room for, and its shape decides how far the drawing
  // has to be opened out before it covers the frame at all.
  //
  // Watched through the block around it rather than on the frame itself. The
  // frame is a size container — the zoom controls query it, so they can lie
  // along the top in a narrow one — and a size container reports no resizes of
  // its own, which is exactly the containment being asked for. The wrapper is
  // an ordinary block of the same width, so it does report them, and the frame
  // is measured directly once it has.
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const read = () => {
      const r = frame.current?.getBoundingClientRect();
      // Only on a real change: this runs from three sources, and setting state
      // to the size it already holds on every one of them would have the map
      // re-rendering for nothing.
      if (r) setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    const ro = new ResizeObserver(read);
    ro.observe(el);
    // The observer catches the frame changing shape under a still window — the
    // reading panel arriving beside it. The window listener catches the window
    // itself, which is the same question asked the other way round, and costs
    // nothing to ask twice: `read` settles to the same size either way.
    window.addEventListener("resize", read);
    read();
    return () => { ro.disconnect(); window.removeEventListener("resize", read); };
  }, []);

  // The frame is set taller than the drawing wherever there is room to put the
  // reading beside it, so "fit" is no longer 100%: the drawing has to be opened
  // out until it covers the frame's height, or there would be bare ground above
  // and below it. That factor is the floor every other zoom is measured from.
  const minZoom = useMemo(() => {
    if (!box.w || !box.h) return 1;
    return Math.max(1, (box.h * VIEW.w) / (box.w * VIEW.h));
  }, [box]);

  // How much of the drawing the frame shows, in the drawing's own units. The
  // width follows from the zoom alone; the height has to come through the
  // frame's shape, since the frame is no longer the drawing's shape.
  const span = useCallback((z) => ({
    w: VIEW.w / z,
    h: box.w ? (box.h * VIEW.w) / (z * box.w) : VIEW.h / z,
  }), [box]);

  // Never past the edges: at any zoom the window stays over the drawing.
  const clamp = useCallback((v) => {
    const z = Math.min(MAX_ZOOM, Math.max(minZoom, v.z));
    const { w, h } = span(z);
    const halfW = w / 2;
    const halfH = h / 2;
    return {
      z,
      x: Math.min(VIEW.w - halfW, Math.max(halfW, v.x)),
      y: Math.min(VIEW.h - halfH, Math.max(halfH, v.y)),
    };
  }, [minZoom, span]);

  // The frame can change shape under the view — the reading panel arrives beside
  // it, the window is resized — and a view that was legal before may now leave
  // bare ground showing. Re-settling it against the new floor is what keeps the
  // drawing covering the frame.
  useEffect(() => { setView((v) => clamp(v)); }, [clamp]);

  const zoomBy = useCallback((factor, at) => {
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(minZoom, v.z * factor));
      if (!at) return clamp({ ...v, z });
      // Keep whatever is under the pointer under the pointer.
      const k = 1 - v.z / z;
      return clamp({ z, x: v.x + (at.x - v.x) * k, y: v.y + (at.y - v.y) * k });
    });
  }, [clamp, minZoom]);

  // Where a pointer is, in the artwork's own units rather than screen pixels.
  const atPointer = useCallback((e) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return null;
    const seen = span(view.z);
    return {
      x: view.x + ((e.clientX - (rect.left + rect.width / 2)) / rect.width) * seen.w,
      y: view.y + ((e.clientY - (rect.top + rect.height / 2)) / rect.height) * seen.h,
    };
  }, [view, span]);

  // Wheel and pinch both arrive as wheel events; both mean zoom here, so the
  // page underneath must not scroll with them.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      // A trackpad pinch arrives as a wheel event with ctrlKey set, and with a
      // far smaller delta than a scroll of the same intent — so at one rate the
      // pinch crawls. Given its own, the fingers move the map about as far as
      // they move on the glass.
      const rate = e.ctrlKey ? 0.0075 : 0.0016;
      zoomBy(Math.exp(-e.deltaY * rate), atPointer(e));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, atPointer]);

  const onPointerDown = (e) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: view };
    dragged.current = false;
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!dragged.current) {
      // Within a few pixels this is still a press, and the frame must not take
      // the pointer: holding it sends the click that follows to the frame
      // rather than to whatever the reader pressed on, which is how a map full
      // of places ends up with none of them answering. The pointer is only
      // taken once the press has become a drag, and a drag has no click to
      // lose.
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 5) return;
      dragged.current = true;
      frame.current?.setPointerCapture?.(d.id);
    }
    const rect = frame.current.getBoundingClientRect();
    const seen = span(d.from.z);
    setView(clamp({
      ...d.from,
      x: d.from.x - ((e.clientX - d.x) / rect.width) * seen.w,
      y: d.from.y - ((e.clientY - d.y) / rect.height) * seen.h,
    }));
  };
  const onPointerUp = () => { drag.current = null; };

  const flyTo = (place) => {
    setView(clamp({ z: Math.max(FLY_ZOOM, minZoom), x: place.x, y: place.y }));
    setPicked(place);
    setFind("");
  };

  const matches = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return [];
    const starts = (p) => namesOf(p).some((n) => n.toLowerCase().startsWith(q));
    return PLACES
      .filter((p) => namesOf(p).some((n) => n.toLowerCase().includes(q)) || p.region.toLowerCase().includes(q))
      .sort((a, b) => (starts(b) ? 1 : 0) - (starts(a) ? 1 : 0) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [find]);

  // The artwork is moved and scaled as one plate rather than redrawn, so
  // panning stays on the compositor however much detail is on screen. Both
  // numbers are proportions, so nothing has to be measured: the plate is z
  // times the frame wide, and is shifted by the fraction of itself that should
  // sit left of centre — which is what a percentage translate means.
  const plate = {
    width: `${view.z * 100}%`,
    transform: `translate(${-(view.x / VIEW.w) * 100}%, ${-(view.y / VIEW.h) * 100}%)`,
  };

  // How much of the lettering the map is open enough to carry — measured on
  // the drawing's width on screen, so a narrow window shows fewer names at the
  // same zoom rather than piling them on top of each other.
  const depth = depthAt(box.w * view.z);

  return (
    <article className="pop">
      <div className="reader-card map-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="map-head">
          <h2 className="serif map-title">Book of Mormon Lands</h2>
          <p className="map-sub">The Internal Geography of the Book of Mormon</p>
        </header>


        <div className="map-search">
          <input value={find} onChange={(e) => setFind(e.target.value)}
            placeholder="Find a place — Zarahemla, Cumorah, Sidon…"
            aria-label="Find a place on the map" />
          {find && (
            <button className="lift map-search-clear" aria-label="Clear"
              onClick={() => setFind("")}>✕</button>
          )}
          {matches.length > 0 && (
            <ul className="map-matches">
              {matches.map((p) => (
                <li key={p.id}>
                  {/* The press is caught only to keep the field's caret, which
                      is what stops the list vanishing under the pointer. The
                      choosing is left to the click, so tabbing to a match and
                      pressing Return reaches the map the same way. */}
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => flyTo(p)}>
                    <span className="serif">{p.name}</span>
                    <span className="map-match-type">{kindOf(p.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Wide, the reading stands beside the drawing rather than under it:
            choosing a place then leaves the map where it was instead of
            pushing it up the page out of sight. */}
        <div className="map-body">
        <div className="map-main" ref={main}>
        <div className="map-frame" ref={frame}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          /* Every click ends here, whether a place took it first or the drag
             held the pointer. A press on open ground puts the reading away
             again — the place had its say, and the ground is how you dismiss
             it. Not after a drag, which was moving the map rather than
             choosing on it, and not on the zoom controls, which are over the
             drawing but not part of it. Clearing the flag last leaves the next
             press — or a keyboard Enter, which has no press at all — free to
             choose. */
          onClick={(e) => {
            const onSomething = e.target.closest(".map-place, .map-controls");
            if (!dragged.current && !onSomething) setPicked(null);
            dragged.current = false;
          }}>
          <div className="map-plate" style={plate}>
            <img src={ARTWORK} alt="Map of the lands of the Book of Mormon" draggable="false" />
            {/* The lettering. It rides on the artwork, so it pans and zooms
                with the place it names, but it is set in real type at a real
                size — so it stays legible at every zoom instead of turning
                into a poster at seven times and a smudge at one. */}
            <div className="map-letters" data-depth={depth}>
              <span className="map-divide" style={{ left: `${DIVIDE.north.x}%`, top: `${DIVIDE.north.y}%` }}>
                {DIVIDE.north.text}
              </span>
              <span className="map-divide-rule" style={{
                left: `${DIVIDE.rule.x1}%`, top: `${DIVIDE.rule.y}%`,
                width: `${DIVIDE.rule.x2 - DIVIDE.rule.x1}%`,
              }} />
              <span className="map-divide" style={{ left: `${DIVIDE.south.x}%`, top: `${DIVIDE.south.y}%` }}>
                {DIVIDE.south.text}
              </span>

              {PLACES.map((p) => (
                <button key={p.id} type="button"
                  className="map-place" data-at={p.at} data-kind={p.type}
                  data-mark={p.mark ?? "none"} data-tier={p.tier}
                  data-on={picked?.id === p.id || undefined}
                  style={{ left: `${(p.x / VIEW.w) * 100}%`, top: `${(p.y / VIEW.h) * 100}%` }}
                  onClick={() => { if (!dragged.current) setPicked(p); }}>
                  {p.mark && <i className="map-mark" aria-hidden />}
                  <span className="map-name">
                    {p.lines.map((line, i) => <span key={i}>{line}</span>)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="map-controls">
            <button className="tap map-btn" onClick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
            <button className="tap map-btn" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
            <button className="tap map-btn map-reset"
              onClick={() => { setView(clamp({ z: minZoom, x: VIEW.w / 2, y: VIEW.h / 2 })); setPicked(null); }}
              aria-label="Fit the whole map">⤢</button>
          </div>
        </div>

        {/* Measured from the fit, not from the drawing's own size: the frame is
            taller than the drawing here, so a fitted map is already opened out
            past 100% and saying so would only puzzle. */}
        <p className="map-hint">
          Tap a place for what happened there · drag to move · scroll or pinch to zoom · {Math.round((view.z / minZoom) * 100)}%
        </p>
        </div>

        <div className="map-aside">
        {picked ? (
          <section className="map-place-card">
            <header className="map-place-head">
              <h3 className="serif map-place-name">
                {picked.name}
                {picked.altName && <span className="map-place-alt">or {picked.altName}</span>}
              </h3>
              <button className="map-place-close" onClick={() => setPicked(null)} aria-label="Close">✕</button>
            </header>
            <p className="map-place-meta">{kindOf(picked.type)} · {picked.region}</p>
            {/* A place's description cites the passage it is drawn from —
                "near the land which is called Desolation by the Nephites"
                (Ether 7:6) — and those citations open, as the ones on the
                events below it do. */}
            <p className="map-place-text">{citedRun(picked.description, onOpenRef, "d")}</p>
            {picked.events.length > 0 && (
              <ul className="map-events">
                {picked.events.map((e, i) => (
                  <li key={i}>
                    <span>{e.text}</span>{" "}
                    <Cite label={e.ref} onOpenRef={onOpenRef} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <ul className="map-key">
            {KINDS.map((k) => (
              <li key={k.type}><span className={`map-swatch map-swatch-${k.type}`} aria-hidden />{k.label}</li>
            ))}
          </ul>
        )}
        </div>
        </div>
      </div>
    </article>
  );
}
