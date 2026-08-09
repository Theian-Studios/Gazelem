import { scanCites } from "../lib/cites.js";

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
  return scanCites(text).map((part, i) => {
    if (part.kind === "text") return <span key={`${key}-${i}`}>{part.text}</span>;
    return (
      // An opening bracket travels with the citation it introduces, so a line
      // never breaks between the two.
      <span key={`${key}-${i}`} className="cx-cite-group">
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
  });
}
