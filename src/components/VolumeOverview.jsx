import { useState } from "react";
import { glass } from "../theme.js";
import { categoriesFor, CATEGORIES } from "../lib/categories.js";
import { voiceAt, voicesOf } from "../lib/voices.js";

// The whole volume at once, a square to a chapter, coloured by what kind of
// chapter it is. Read down the page it is a shape rather than a list: where the
// gold gathers is where the record stops to teach, and the long grey runs are
// the wars and the journeys between.
//
// Two questions can be asked of that shape — what kind of chapter, and whose
// voice carries it — and they are asked together: choosing both narrows to the
// chapters that answer both, which is how "where does Alma teach, as against
// where he is merely written about" gets asked at all.
export default function VolumeOverview({ volume, books, onOpen }) {
  const shelf = categoriesFor(volume);
  const voices = voicesOf(volume);
  // What is being asked after, on either axis. Holding the rest back is what
  // lets a single kind or a single voice be seen against the whole volume.
  const [only, setOnly] = useState({ kind: null, voice: null });
  if (!shelf.length) return null;

  const pick = (axis, value) =>
    setOnly((o) => ({ ...o, [axis]: o[axis] === value ? null : value }));
  const filtering = only.kind || only.voice;

  // The reader's own books, so a square can open the chapter it stands for. A
  // square is named by its chapter number and the reader is opened at a place in
  // a list, which are only the same thing while a book's numbering runs unbroken
  // from one — so the place is looked up rather than counted on.
  const indexOf = (bookName) => (books || []).findIndex((b) => b.name === bookName);
  const placesIn = (bookIdx) =>
    bookIdx < 0 ? null : new Map(books[bookIdx].chapters.map((c, i) => [c.n, i]));

  return (
    <article className="pop">
      <div className="reader-card co-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="co-head">
          <h2 className="serif co-title">Chapter Overview</h2>
          <p className="co-sub">{volume.title}</p>
          <p className="co-intro">
            One square to a chapter, in reading order, coloured by what the
            chapter is: grey where the record is telling its history, gold where
            it is teaching. Pick a kind or a voice below to see where it falls —
            or one of each, for the chapters that answer to both.
          </p>
        </header>

        <div className="co-filters">
          <section className="co-filter">
            <h3 className="co-filter-head">Kind</h3>
            <ul className="co-key">
              {CATEGORIES.map((c) => (
                <li key={c.name}>
                  <button className="co-key-item" data-on={only.kind === c.name || undefined}
                    onClick={() => pick("kind", c.name)}
                    title={c.blurb} aria-pressed={only.kind === c.name}>
                    <span className="co-swatch" style={{ background: shade(c.weight) }} aria-hidden />
                    <span className="co-key-name">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {voices.length > 0 && (
            <section className="co-filter">
              <h3 className="co-filter-head">Voice</h3>
              {/* In the order the record introduces them, so the list reads as
                  the book does rather than as an index. */}
              <ul className="co-key co-voices">
                {voices.map((v) => (
                  <li key={v}>
                    <button className="co-key-item" data-on={only.voice === v || undefined}
                      onClick={() => pick("voice", v)} aria-pressed={only.voice === v}>
                      <span className="co-key-name">{v}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {filtering && (
            <button className="co-clear" onClick={() => setOnly({ kind: null, voice: null })}>
              Clear
            </button>
          )}
        </div>

        <div className="co-books" data-filtered={filtering ? "" : undefined}>
          {shelf.map((b) => {
            const bookIdx = indexOf(b.name);
            const places = placesIn(bookIdx);
            return (
              <section key={b.name} className="co-book">
                <h3 className="serif co-book-name">{b.name}</h3>
                <div className="co-cells">
                  {b.chapters.map((c) => {
                    const voice = voiceAt(volume, b.name, c.n);
                    // Both axes have to be answered, so a kind and a voice
                    // together narrow to their overlap rather than their sum.
                    const held = (only.kind && c.category.name !== only.kind)
                      || (only.voice && voice !== only.voice);
                    const said = [c.category.name, voice].filter(Boolean).join(" · ");
                    const at = places?.get(c.n);
                    return (
                      <button key={c.n} className="co-cell"
                        data-dim={held ? "" : undefined}
                        style={{ background: shade(c.category.weight) }}
                        disabled={at == null}
                        onClick={() => at != null && onOpen(bookIdx, at)}
                        title={`${b.name} ${c.n} — ${said}`}
                        aria-label={`${b.name} ${c.n}, ${said}`}>
                        <span className="co-cell-n" style={numeralOn(c.category.weight)}>{c.n}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}

// One ramp from a cool grey to gold, lightened towards the grey end so the
// doctrine end carries the weight — the scale reads as a single gradient
// rather than as two palettes meeting in the middle.
function rampAt(weight) {
  const grey = [166, 170, 178];
  const gold = [173, 132, 44];
  const at = (i) => grey[i] + (gold[i] - grey[i]) * weight;
  const lift = (1 - weight) * 0.34;
  return [0, 1, 2].map((i) => Math.round(at(i) + (255 - at(i)) * lift));
}

const shade = (weight) => `rgb(${rampAt(weight).join(", ")})`;

// White numerals disappear on the pale end of the ramp, so the ink is chosen
// per square from how light the square actually is rather than fixed once for
// all ten. The threshold is where the ramp stops carrying white.
function numeralOn(weight) {
  const [r, g, b] = rampAt(weight);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62
    ? { color: "rgba(38,40,46,.72)", textShadow: "none" }
    : { color: "rgba(255,255,255,.95)", textShadow: "0 0 3px rgba(31,45,71,.4)" };
}
