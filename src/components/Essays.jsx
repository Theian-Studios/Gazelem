import { useState } from "react";
import { glass, cardTint } from "../theme.js";
import { ESSAYS, ESSAY_SECTION, essayBySlug, essayImage } from "../lib/essays.js";
import { citedRun } from "./Cited.jsx";
import { treats, useFocusScroll } from "../lib/focus.js";
import { linked } from "../lib/markup.js";

// Prose with everything the essays put in it: titles in italic, the terms the
// argument turns on in bold, sources as links off the site, and references as
// doors into the text. The marks are read first and the citations found inside
// each run of them, so a bolded phrase keeps its weight and a reference inside
// one still opens.
function Rich({ text, onOpenRef }) {
  return linked(text).map((part, i) => {
    // A link is somebody else's page and stays one — a reference inside a
    // linked title would otherwise be two destinations in one word.
    if (part.href) {
      return (
        <a key={i} className="es-link" href={part.href} target="_blank" rel="noopener noreferrer">
          {part.parts.map((p, j) => p.italic ? <em key={j}>{p.text}</em> : <span key={j}>{p.text}</span>)}
        </a>
      );
    }
    const run = citedRun(part.text, onOpenRef, i);
    if (part.bold) return <b key={i} className="es-mark">{run}</b>;
    if (part.italic) return <em key={i}>{run}</em>;
    return <span key={i}>{run}</span>;
  });
}

// One statement, set on the page as the sentence worth reading and opened to
// the whole of it on request. The essays rest on testimony given at length, and
// the length is part of the evidence — a witness who says the same thing four
// ways over half a century is saying something a paraphrase cannot carry. But
// six full affidavits down a page is a wall, so the page shows the line and
// keeps the rest a press away.
//
// Opened, the full statement stands in place of the line rather than under it:
// the line is the statement's own opening words, and showing both would have
// the reader read them twice.
function PullQuote({ quote, onOpenRef }) {
  const [open, setOpen] = useState(false);
  return (
    <figure className="es-quote" data-open={open || undefined}>
      {open ? (
        <div className="es-quote-full">
          {quote.parts.map((p, i) => p.kind === "note" ? (
            <p key={i} className="es-quote-note"><Rich text={p.text} onOpenRef={onOpenRef} /></p>
          ) : (
            <blockquote key={i} className="serif es-said">
              <Rich text={p.text} onOpenRef={onOpenRef} />
              {p.source && <cite className="es-source"><Rich text={p.source} onOpenRef={onOpenRef} /></cite>}
            </blockquote>
          ))}
        </div>
      ) : (
        <blockquote className="serif es-said es-said-lead">{quote.text}</blockquote>
      )}

      {quote.who && <figcaption className="es-who">{quote.who}</figcaption>}

      <button className="es-expand" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Show less" : "Read the full statement"}
        <svg className="es-expand-arrow" viewBox="0 0 10 6" width="9" height="6" aria-hidden
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1.2 5 4.8 9 1.2" />
        </svg>
      </button>
    </figure>
  );
}

// The essays shelved together under the subject they share. Set apart from the
// evidences above them because they are read differently: an evidence is a
// pattern to be examined, an essay is an argument to be followed, and the two
// invite different kinds of attention.
export function EssayShelf({ onOpen }) {
  return (
    <div className="es-shelf">
      <h3 className="serif es-shelf-title">{ESSAY_SECTION}</h3>
      <div className="ev-grid">
        {ESSAYS.map((e, i) => (
          <button key={e.slug} className="tap popin ev-tile" onClick={() => onOpen(e.slug)}
            style={{ ...glass, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="es-tile-order" aria-hidden>{e.order}</span>
            <span className="serif ev-tile-name">{e.title}</span>
            {e.subtitle && <span className="ev-tile-sub">{e.subtitle}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// The lines of a part, flattened, so the focus can be asked which part of the
// essay speaks to the passage the reader came from.
const linesOf = (part) => part.blocks.flatMap((b) => b.kind === "quote"
  ? [b.text, ...b.parts.flatMap((x) => [x.text, x.source].filter(Boolean))]
  : [b.text]);

// One essay, read straight down: its parts in order, its quotations standing
// out of the prose, and its sources at the foot where a reader goes looking for
// them rather than in the middle of the argument.
// Named by its slug rather than handed the essay itself: the essays live in
// this module, and this module is only fetched when one is opened.
export function EssayPage({ slug, onOpenRef, focus }) {
  const essay = essayBySlug(slug);
  const focusedPart = essay?.parts.findIndex((p) => treats(linesOf(p), focus));
  useFocusScroll(!!focus && focusedPart >= 0, ".es-part[data-focused]");
  if (!essay) return null;

  return (
    <article className="pop">
      <div className="reader-card es-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="es-head">
          <p className="es-kicker">{ESSAY_SECTION}</p>
          <h2 className="serif es-title">{essay.title}</h2>
          {essay.subtitle && <p className="es-sub">{essay.subtitle}</p>}
        </header>

        {essay.parts.map((part, pi) => {
          // The closing list of what the essay was built from, which is
          // reference matter rather than argument and is set as such.
          const sources = /^sources/i.test(part.name);
          return (
            <section key={pi} className={`es-part${sources ? " es-sources" : ""}`}
              data-focused={pi === focusedPart ? "" : undefined}>
              {/* The plate the essay opens on, set into the head of the first
                  part so the opening runs down beside it rather than starting
                  under it. It is the first thing in the part, so the part's own
                  heading sits alongside the picture too — which is where a
                  heading belongs when a picture opens the page. */}
              {pi === 0 && essay.image && (
                <figure className="es-plate">
                  <img src={essayImage(essay.image)} alt="" loading="lazy" decoding="async" />
                </figure>
              )}
              {part.name && <h3 className="serif es-part-name">{part.name}</h3>}
              {part.blocks.map((b, bi) => b.kind === "quote"
                ? <PullQuote key={bi} quote={b} onOpenRef={onOpenRef} />
                : <p key={bi} className="es-p"><Rich text={b.text} onOpenRef={onOpenRef} /></p>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}
