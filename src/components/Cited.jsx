import { scanCites } from "../lib/cites.js";
import { parseCitations } from "../lib/refs.js";

// Drawing the references inside a run of prose as doors. Written once and
// shared, because several kinds of page want it and want it to behave the same:
// a chart's cells, where a reference is the whole point of the cell, and the
// essays, the map, the coming-forth thread and the reading lists, where one is
// dropped into a sentence and should still open.
//
// The finding is lib/cites.js — the same scan the study index reads, so what
// opens on the page and what the reader is told about a chapter can never
// disagree. This only says how the pieces are set.
export function citedRun(text, onOpenRef, key) {
  return scanCites(text).map((part, i) =>
    part.kind === "text"
      ? <span key={`${key}-${i}`}>{part.text}</span>
      : citeGroup(part, onOpenRef, `${key}-${i}`));
}

// One group of the scan, drawn. Exported on its own because the commentary
// notes scan their prose themselves — they have a second kind of reference to
// look for in what the scan leaves behind (see Commentary.jsx) — and the
// citations they share with everything else must still be drawn the one way.
export function citeGroup(part, onOpenRef, key) {
  return (
    // An opening bracket travels with the citation it introduces, so a line
    // never breaks between the two.
    <span key={key} className="cx-cite-group">
      {part.held ? "(" : ""}
      {part.links.map((l, li) => (
        <span key={li}>
          {l.sep}
          {onOpenRef
            ? <button className="cx-cite" onClick={() => onOpenRef(l.cite)} title={`Open ${l.title}`}>{l.label}</button>
            : l.label}
        </span>
      ))}
    </span>
  );
}

// Marked prose whose references are doors. The marks are read first and the
// citations found inside each run of them, so an italic title keeps its slant,
// a bolded phrase keeps its weight, and a reference standing inside either
// still opens.
//
// `parts` is the source already read — `emphasis` for the pages that only mark
// titles, `inline` for the charts and evidences, which also mark the words they
// are pointing at. Handing the parts in rather than the string keeps this from
// having to know which of the two a page writes in, and is what let five pages
// that each wrote this loop out share the one copy of it.
export function markedRun(parts, onOpenRef, boldClass) {
  return parts.map((part, i) => {
    const run = citedRun(part.text, onOpenRef, i);
    if (part.bold) return <b key={i} className={boldClass}>{run}</b>;
    if (part.italic) return <em key={i}>{run}</em>;
    return <span key={i}>{run}</span>;
  });
}

// One reference on its own — not found inside a sentence but written as the
// whole of a caption, a row, a stop on a thread. The label is the reference as
// the page spells it, and pressing it opens the passage.
//
// `group` is for the pages that bracket theirs: the brackets travel with the
// reference as one word, so a line never breaks between them. A label that does
// not resolve, or a page with nowhere to send the reader, is set as plain text
// rather than as a door that opens onto nothing.
export function CiteLink({ label, onOpenRef, className, linkClassName, group }) {
  const cite = parseCitations(label)[0];
  const inner = !cite || !onOpenRef
    ? <span className={className}>{label}</span>
    : (
      <button className={linkClassName || className} onClick={() => onOpenRef(cite)} title={`Open ${label}`}>
        {label}
      </button>
    );
  return group ? <span className={group}> ({inner})</span> : inner;
}
