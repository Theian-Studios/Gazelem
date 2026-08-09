// The little of markdown the data files actually use.
//
// The prose in src/data is written by hand, and the one thing it needs that
// plain text cannot carry is a book title: *Preserved in Translation*,
// *Rough Stone Rolling*. Marking it in the source keeps the sentence one
// string everywhere else — nothing downstream has to know about asterisks.

// "Follows *Preserved in Translation* closely" → the run of parts, each
// knowing whether it is set in italic. Empty parts are dropped, so a string
// that opens or closes with a title does not come back with blanks either end.
export const emphasis = (text) =>
  (text || "").split(/(\*[^*]+\*)/g).map((part) => {
    const inner = part.match(/^\*(.+)\*$/);
    return inner ? { italic: true, text: inner[1] } : { italic: false, text: part };
  }).filter((p) => p.text);

// The same, but reading **bold** as well — which the evidences need, since what
// they are pointing at inside a passage is marked rather than described. The
// two-star form is matched first, or the one-star rule would take its opening
// pair for an empty italic and leave the rest in pieces.
export const inline = (text) =>
  (text || "").split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part) => {
    const strong = part.match(/^\*\*(.+)\*\*$/);
    if (strong) return { bold: true, italic: false, text: strong[1] };
    const em = part.match(/^\*(.+)\*$/);
    return em ? { bold: false, italic: true, text: em[1] } : { bold: false, italic: false, text: part };
  }).filter((p) => p.text);

// The same again, reading links — [text](url) — which the translation essays
// need and the charts do not: an essay's authority is other people's work, and
// a source the reader cannot follow is half a citation.
//
// A link comes back whole, as one part carrying its `href` and the run of marked
// pieces its label is made of, rather than as one part per piece: "David
// Whitmer, *An Address to All Believers in Christ* (1887)" is one destination,
// and split three ways it would be three things to tab through and an underline
// with gaps in it. Everything else comes back as it does from `inline`, with a
// null href.
export const linked = (text) =>
  (text || "").split(/(\[[^\]]+\]\([^)]+\))/g).flatMap((part) => {
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return m
      ? [{ href: m[2], parts: inline(m[1]) }]
      : inline(part).map((p) => ({ ...p, href: null }));
  });
