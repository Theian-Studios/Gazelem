import { useState } from "react";
import { glass, cardTint } from "../theme.js";
import { chartsFor, chartBySlug, chartTemplate } from "../lib/charts.js";
import { chartIcon } from "./ChartIcons.jsx";
import { citedRun } from "./Cited.jsx";
import { treats, useFocusScroll } from "../lib/focus.js";
import { inline } from "../lib/markup.js";

// How much of a part stands open before the reader asks for the rest: enough
// to show what it gathers, without every chart opening at full length.
const TASTE = 3;

// A cell carries both kinds of marking at once: the words the chart is
// pointing at, which the source sets in bold — "and **thus we see**" — and the
// references, which are doors. The marks are read first and the citations
// found inside each run of them, so a bolded phrase keeps its weight and a
// reference inside one still opens.
function Cited({ text, onOpenRef }) {
  return inline(text).map((part, i) => {
    const run = citedRun(part.text, onOpenRef, i);
    if (part.bold) return <b key={i} className="cx-mark-b">{run}</b>;
    if (part.italic) return <em key={i}>{run}</em>;
    return <span key={i}>{run}</span>;
  });
}

// Prose with its titles in italic and the words a chart is pointing at in bold.
// A chart's own paragraphs cite scripture as freely as its cells do — the
// introduction that says what the chart gathers, the line under a part, the
// closing essay — so they are read for references too. Left plain, the
// "(2 Kings 2:9)" that opens the Old Testament miracles was the one reference
// on the page that did not open.
function Prose({ text, onOpenRef }) {
  return inline(text).map((part, i) => {
    const run = citedRun(part.text, onOpenRef, i);
    if (part.bold) return <b key={i}>{run}</b>;
    if (part.italic) return <em key={i}>{run}</em>;
    return <span key={i}>{run}</span>;
  });
}

// The shelf of charts, as the evidences are shelved.
export function ChartGrid({ volume, onOpen }) {
  const charts = chartsFor(volume);
  return (
    <div className="pop">
      <h2 className="serif ev-shelf-title">Charts</h2>
      <p className="ev-shelf-intro">
        The {volume.title} gathered a question at a time — one table to a
        question the record can be asked — each set out with the passages it
        rests on, so every line opens into the text it came from.
      </p>
      <div className="ev-grid">
        {charts.map((c, i) => (
          <button key={c.slug} className="tap popin ev-tile" onClick={() => onOpen(c.slug)}
            style={{ ...glass, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="cx-tile-icon" aria-hidden>{chartIcon(c.slug)}</span>
            <span className="serif ev-tile-name">{c.title}</span>
            {c.subtitle && <span className="ev-tile-sub">{c.subtitle}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// One chart: a part to a table, each opening with a taste of its rows and
// unfolding on request. Every citation in it is a door into the text.
// Named by its slug rather than handed the chart itself: the charts live in
// this module, and this module is only fetched when one is opened, so the
// caller cannot have looked one up to pass down.
export function ChartPage({ slug, volume, onOpenRef, focus }) {
  const chart = chartBySlug(slug);
  // Opened from a chapter, the chart owes that chapter its row. Every row it
  // treats is marked, the part holding them is unfolded, and the first of them
  // is brought into view.
  const wanted = (row) => treats(row.flat(), focus);
  const focusedPart = chart ? chart.parts.findIndex((p) => p.rows.some(wanted)) : -1;
  // That part starts open as a fold the reader has already opened, rather than
  // as a case of its own held true through the render — which is what left its
  // "Show fewer" pressable and inert.
  const [open, setOpen] = useState(() =>
    new Set(focusedPart >= 0 ? [chart.parts[focusedPart].name || focusedPart] : []));
  useFocusScroll(!!focus && focusedPart >= 0, ".cx-row[data-focused]");
  if (!chart) return null;

  const toggle = (name) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <article className="pop">
      <div className="reader-card cx-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="cx-head">
          <span className="cx-mark" aria-hidden>{chartIcon(chart.slug)}</span>
          <h2 className="serif cx-title">{chart.title}</h2>
          {volume && <p className="cx-sub">{volume.title}</p>}
          {chart.intro && (
            <div className="cx-intro">
              {chart.intro.split("\n\n").map((p, i) => <p key={i}><Prose text={p} onOpenRef={onOpenRef} /></p>)}
            </div>
          )}
        </header>

        {/* A chronology: one stop to a year, strung on the thread the
            coming-forth page uses, since both answer the same question — what
            happened, and in what order. */}
        {chart.form === "timeline" && chart.parts.map((part, pi) => (
          <section key={pi} className="cx-part">
            {part.name && <h3 className="serif cx-part-name">{part.name}</h3>}
            {part.prose && <p className="cx-part-gloss"><Prose text={part.prose} onOpenRef={onOpenRef} /></p>}
            <ol className="cx-thread">
              {part.rows.map((row, ri) => {
                const [when, label] = row[0] || [];
                return (
                  <li key={ri} className="cx-stop">
                    <p className="cx-when">{when}</p>
                    <div className="cx-stop-body">
                      {label && <h4 className="serif cx-stop-name"><Cited text={label} onOpenRef={onOpenRef} /></h4>}
                      {(row[1] || []).map((line, li) => (
                        <p key={li} className="cx-stop-text"><Cited text={line} onOpenRef={onOpenRef} /></p>
                      ))}
                      {(row[2] || []).filter(Boolean).map((line, li) => (
                        <p key={li} className="cx-stop-ref"><Cited text={line} onOpenRef={onOpenRef} /></p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {chart.form !== "timeline" && chart.parts.map((part, pi) => {
          // A part with no rows is the closing essay some charts carry.
          if (!part.rows.length) {
            return (
              <section key={pi} className="cx-part cx-essay">
                {part.name && <h3 className="serif cx-part-name">{part.name}</h3>}
                {part.prose.split("\n\n").map((p, i) => <p key={i}><Prose text={p} onOpenRef={onOpenRef} /></p>)}
              </section>
            );
          }
          // A chart with only one part has nothing to scan past, so it stands
          // open: folding it would hide the chart behind a control that leads
          // nowhere else.
          const whole = chart.parts.length === 1;
          const all = whole || open.has(part.name || pi);
          // A wanted row past the taste would be folded away by the very page
          // that was opened to show it, so the fold is opened for it.
          const shown = all ? part.rows : part.rows.slice(0, TASTE);
          return (
            <section key={pi} className="cx-part">
              {part.name && <h3 className="serif cx-part-name">{part.name}</h3>}
              {part.prose && <p className="cx-part-gloss"><Prose text={part.prose} onOpenRef={onOpenRef} /></p>}

              {/* The chart carries its own sideways scroll. Its columns have a
                  floor — a reference is set to keep to one line, so no column
                  can be narrower than the longest reference in it — and six of
                  those floors on a squeezed window come to more than the card
                  is wide. Scrolled, the chart keeps its shape; unscrolled, it
                  bled over the edge. Below the stacking width there is one
                  column and nothing to scroll. */}
              <div className="cx-chart-scroll">
              <div className="cx-chart" style={{ "--cx-template": chartTemplate(chart) }}>
                {chart.columns.map((c, i) => (
                  <div key={i} className={`cx-chart-head${i ? " cx-div" : ""}`}>{c}</div>
                ))}
                {shown.map((row, ri) => (
                  <div key={ri} className="cx-row" data-focused={pi === focusedPart && wanted(row) ? "" : undefined}>
                    {chart.columns.map((_, ci) => {
                      const lines = row[ci] || [];
                      return (
                        <div key={ci} className={`cx-cell${ci ? " cx-div" : ""}${ci === 0 ? " cx-lead" : ""}`}>
                          {lines.map((line, li) => {
                            // A cell of three lines is a reference, the passage
                            // it names, and a note on it — so the middle line is
                            // the reading matter and only the last is small
                            // print. A cell of two is a thing and its note.
                            const last = li === lines.length - 1;
                            const cls = !li ? "cx-line" : last ? "cx-note" : "cx-body";
                            return (
                              <span key={li} className={cls}>
                                <Cited text={line} onOpenRef={onOpenRef} />
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              </div>

              {!whole && part.rows.length > TASTE && (
                <button className="cx-more" onClick={() => toggle(part.name || pi)} aria-expanded={all}>
                  {all ? "Show fewer" : "Show more"}
                  <svg className="cx-more-arrow" viewBox="0 0 10 6" width="9" height="6" aria-hidden
                    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 1.2 5 4.8 9 1.2" />
                  </svg>
                </button>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}
