import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { glass, cardTint } from "../theme.js";
import { EVIDENCES, evidenceBySlug, splitTitle } from "../lib/evidences.js";
import { EssayShelf } from "./Essays.jsx";
import { inline } from "../lib/markup.js";
import { parseCitations } from "../lib/refs.js";
import { treats, useFocusScroll } from "../lib/focus.js";

// Prose with its book titles in italic and, inside a passage, the words that
// exhibit the form in bold. Marking them is the whole argument: the chart is
// pointing at something, and without the marks the reader has to be told in
// prose what the passage is supposed to be showing.
function Prose({ text }) {
  return inline(text).map((part, i) => {
    if (part.bold) return <b key={i} className="ev-mark">{part.text}</b>;
    if (part.italic) return <em key={i}>{part.text}</em>;
    return <span key={i}>{part.text}</span>;
  });
}

// A reference set as a link into the text it names. The whole point of these
// pages is the passages, so every one of them opens.
//
// Bracketed, as the prophets' are: the brackets and the reference travel as one
// word, so a line never breaks between them.
function Ref({ label, onOpenRef }) {
  const cite = parseCitations(label)[0];
  const inner = !cite || !onOpenRef
    ? <span className="ev-ref">{label}</span>
    : (
      <button className="ev-ref ev-ref-link" onClick={() => onOpenRef(cite)} title={`Open ${label}`}>
        {label}
      </button>
    );
  return <span className="ev-ref-group"> ({inner})</span>;
}

// The shelf of evidences, as the prophets and the books are shelved. The
// translation essays are shelved under it, in a section of their own — they
// answer the same question and are read a different way, so they belong on this
// shelf but not in the same row of it.
export function EvidenceGrid({ volume, onOpen }) {
  return (
    <div className="pop">
      <h2 className="serif ev-shelf-title">Evidences</h2>
      <div className="ev-grid">
        {EVIDENCES.map((e, i) => (
          <button key={e.slug} className="tap popin ev-tile" onClick={() => onOpen(e.slug)}
            style={{ ...glass, background: `linear-gradient(140deg, ${cardTint}, rgba(255,255,255,0.62))`, animationDelay: `${Math.min(i * 9, 170)}ms` }}>
            <span className="serif ev-tile-name">{e.title}</span>
            {e.subtitle && <span className="ev-tile-sub">{e.subtitle}</span>}
          </button>
        ))}
      </div>
      <EssayShelf onOpen={onOpen} />
    </div>
  );
}

// A phrase and where it stands, with a gloss where the phrase needs one.
function Phrases({ items, onOpenRef }) {
  return (
    <ul className="ev-phrases">
      {items.map((it, i) => (
        <li key={i}>
          {/* Quoted, short as they are: every one is the record's own wording,
              and the site marks scripture as scripture wherever it stands. */}
          <span className="serif ev-phrase">“<Prose text={it.text} />”</span>
          {it.gloss && <span className="ev-gloss">{it.gloss}</span>}
          <Ref label={it.ref} onOpenRef={onOpenRef} />
        </li>
      ))}
    </ul>
  );
}

// Two readings set against each other in columns — the source down one side
// and the reversal down the other, the earliest text down one and the one
// printed now down the other — so a row is read across as one comparison and
// the eye can catch what moved. Every row carries the same two labels, so they
// are lifted out and set once as the heads of the chart.
//
// A row with nothing to set against it — a reading that no edition touched —
// takes the width of the chart and keeps its own label, since neither head is
// true of it.
//
// Narrow, the columns become a stack and every half takes its label back: two
// columns of quotation on a phone would be a column of one word.
function TChart({ groups, onOpenRef }) {
  const widest = groups.reduce((a, b) => (b.items.length > a.items.length ? b : a), groups[0]);
  const heads = (widest?.items || []).map((it) => it.label);

  return (
    <div className="ev-tchart" style={{ "--ev-cols": heads.length }}>
      {heads.map((head, i) => (
        <div key={`h${i}`} className={`ev-tchart-head${i ? " ev-tchart-div" : ""}`}>{head}</div>
      ))}
      {groups.map((g, i) => {
        const wide = g.items.length < heads.length;
        return (
          <div key={i} className="ev-tchart-row" style={{ display: "contents" }}>
            {g.title && <p className="ev-tchart-note">{g.title}</p>}
            {g.items.map((it, j) => (
              <div key={j} className={[
                "ev-tchart-cell",
                j && "ev-tchart-div",
                j === g.items.length - 1 && "ev-tchart-end",
                wide && "ev-tchart-wide",
              ].filter(Boolean).join(" ")}>
                <span className="ev-side-label ev-tchart-label">{it.label}</span>
                <p className="serif ev-side-text">
                  “<Prose text={it.text} />”
                  <Ref label={it.ref} onOpenRef={onOpenRef} />
                </p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// A whole passage, set a line to a rung so the repetitions stack up the page
// the way the argument does.
function Ladder({ groups, onOpenRef }) {
  return (
    <div className="ev-ladders">
      {groups.map((g, i) => {
        const { label, ref } = splitTitle(g.title);
        return (
          <div key={i} className="ev-ladder">
            {label && (
              <p className="ev-ladder-head"><span className="ev-ladder-title">{label}</span></p>
            )}
            {/* A ladder is one quotation broken across its rungs, so the marks
                go on the outside of the whole passage rather than on each
                line — opening on the first rung and closing on the last, where
                the reference follows them as it does under every other form:
                the passage first, then where it is from. */}
            <p className="serif ev-rungs">
              {g.lines.map((line, j) => {
                const last = j === g.lines.length - 1;
                return (
                  <span key={j} className="ev-rung">
                    {j === 0 && "“"}
                    <Prose text={line} />
                    {last && "”"}
                    {last && ref && <Ref label={ref} onOpenRef={onOpenRef} />}
                  </span>
                );
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// A passage quoted at length, under a heading where it has been given one.
function Quotes({ items, onOpenRef }) {
  return (
    <ul className="ev-quotes">
      {items.map((it, i) => (
        <li key={i}>
          {it.gloss && <p className="ev-quote-head">{it.gloss}</p>}
          <p className="serif ev-quote">
            “<Prose text={it.text} />”
            <Ref label={it.ref} onOpenRef={onOpenRef} />
          </p>
        </li>
      ))}
    </ul>
  );
}

// A name, what it means, and the verses that play on the meaning.
function Wordplay({ groups, onOpenRef }) {
  return (
    <div className="ev-words">
      {groups.map((g, i) => (
        <div key={i} className="ev-word">
          <h4 className="serif ev-word-name">{g.title}</h4>
          {g.root && <p className="ev-word-root"><Prose text={g.root} /></p>}
          <ul className="ev-quotes ev-quotes-tight">
            {g.items.map((it, j) => (
              <li key={j}>
                <p className="serif ev-quote">
                  “<Prose text={it.text} />”
                  <Ref label={it.ref} onOpenRef={onOpenRef} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Examples({ form, onOpenRef }) {
  if (form.form === "tchart") return <TChart groups={form.groups} onOpenRef={onOpenRef} />;
  if (form.form === "ladder") return <Ladder groups={form.groups} onOpenRef={onOpenRef} />;
  if (form.form === "wordplay") return <Wordplay groups={form.groups} onOpenRef={onOpenRef} />;
  if (form.form === "quotes") return <Quotes items={form.items} onOpenRef={onOpenRef} />;
  return <Phrases items={form.items} onOpenRef={onOpenRef} />;
}

// What stands on the card as a taste of the form. Enough of it to actually
// show the thing, which differs by shape: a cognate pair is one phrase, but an
// inverted quotation is only an inversion if both halves are there, and a
// ladder is only a ladder once a rung has repeated.
function sampleOf(form) {
  if (form.form === "ladder") {
    const g = form.groups[0];
    if (!g) return null;
    const { ref } = splitTitle(g.title);
    // Far enough down to catch the first repetition, which is the whole point.
    // One quotation broken across rungs, so it takes one pair of marks.
    return { lines: g.lines.slice(0, 4).map((text) => ({ text })), ref, oneQuote: true };
  }
  if (form.form === "tchart") {
    const g = form.groups.find((x) => x.items.length > 1) || form.groups[0];
    if (!g) return null;
    return { lines: g.items.slice(0, 2) };
  }
  if (form.form === "wordplay") {
    const g = form.groups[0];
    if (!g?.items.length) return null;
    return { lines: [g.items[0]] };
  }
  const first = form.items[0];
  return first ? { lines: [first] } : null;
}

// What the form is. The gloss is the line a card can carry; where a form has
// more to say than fits on a card, the rest is joined onto the end of it rather
// than set as a second paragraph inside the window — one description reads as
// one description. The gloss does without a stop where it stands alone, so it
// is given one here.
function description({ gloss, note }) {
  if (!gloss || !note) return gloss || note;
  return `${gloss}${/[.!?]["”’']?$/.test(gloss) ? "" : "."} ${note}`;
}

// One form, opened over the page. Portalled to <body> for the reason the
// search menu is: the card it came from sits inside a stack of backdrop
// filters, and anything nested in one can only sample that ancestor's own
// contents — the blur behind this would silently do nothing.
function FormWindow({ form, onClose, onOpenRef }) {
  // Escape closes, and the page behind is held still: a window over a page
  // that scrolls under it reads as two things at once.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="ev-veil" onClick={onClose}>
      {/* The window keeps its own presses; only the ground around it closes. */}
      <div className="ev-window" role="dialog" aria-modal="true" aria-label={form.name}
        onClick={(e) => e.stopPropagation()}>
        <header className="ev-window-head">
          <div>
            <h3 className="serif ev-window-name">{form.name}</h3>
            {description(form) && <p className="ev-form-gloss">{description(form)}</p>}
          </div>
          <button className="ev-window-close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="ev-window-body">
          <Examples form={form} onOpenRef={onOpenRef} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// One evidence: a card to a form, each showing what the form is and enough of
// an example to show it. Choosing one opens it over the page.
// Everything a form points at, so the focus can be asked which form speaks to
// the passage the reader came from.
const refsOf = (form) => [
  ...form.items.map((it) => it.ref),
  ...form.groups.flatMap((g) => [g.title, ...g.items.map((it) => it.ref)]),
].filter(Boolean);

// Named by its slug rather than handed the evidence itself: the evidences live
// in this module, and this module is only fetched when one is opened.
export function EvidencePage({ slug, onOpenRef, focus }) {
  const evidence = evidenceBySlug(slug);
  const [openName, setOpenName] = useState(null);
  const focusedForm = evidence?.forms.find((f) => treats(refsOf(f), focus))?.name;
  useFocusScroll(!!focus && !!focusedForm, ".ev-form[data-focused]");
  if (!evidence) return null;

  const active = evidence.forms.find((f) => f.name === openName) || null;

  return (
    <article className="pop">
      <div className="reader-card ev-card" style={{ ...glass, borderRadius: 26 }}>
        <header className="ev-head">
          <h2 className="serif ev-title">{evidence.title}</h2>
          {evidence.subtitle && <p className="ev-sub">{evidence.subtitle}</p>}
          {evidence.intro && <p className="ev-intro"><Prose text={evidence.intro} /></p>}
        </header>

        <div className="ev-forms">
          {evidence.forms.map((form) => {
            const sample = sampleOf(form);
            return (
              <section key={form.name} className="ev-form"
                data-focused={form.name === focusedForm ? "" : undefined}
                /* The whole card is the control. A reference inside it is a
                   door into the text and must keep its own click; everything
                   else on the card means "show me this form". */
                onClick={(e) => { if (!e.target.closest(".ev-ref-link")) setOpenName(form.name); }}>
                <h3 className="serif ev-form-name">{form.name}</h3>
                {form.gloss && <p className="ev-form-gloss">{form.gloss}</p>}

                {sample && (
                  <div className="ev-sample">
                    <span className="ev-sample-tag">Ex.</span>
                    {sample.lines.map((line, j) => (
                      <p key={j} className="ev-sample-line">
                        {line.label && <span className="ev-sample-side">{line.label}</span>}
                        {(!sample.oneQuote || j === 0) && "“"}
                        <Prose text={line.text} />
                        {(!sample.oneQuote || j === sample.lines.length - 1) && "”"}
                        {line.ref && <Ref label={line.ref} onOpenRef={onOpenRef} />}
                      </p>
                    ))}
                    {sample.ref && <Ref label={sample.ref} onOpenRef={onOpenRef} />}
                  </div>
                )}

                {/* No handler of its own: the press bubbles to the card, which
                    is what a press anywhere on the card does. Kept a button so
                    the card has one thing a keyboard can reach. */}
                <button className="ev-more">See more</button>
              </section>
            );
          })}
        </div>
      </div>

      {active && (
        <FormWindow form={active} onClose={() => setOpenName(null)} onOpenRef={onOpenRef} />
      )}
    </article>
  );
}
