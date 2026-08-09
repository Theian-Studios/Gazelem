// Reading one chart file. Kept apart from the shelf that gathers them
// (charts.js) because two quite different things ask for it: the site, which
// globs the files through Vite, and scripts/build-manifest.mjs, which reads them
// off the disk in plain Node to write out the index of what cites what. Nothing
// here may touch `import.meta`, or the second of those two cannot import it —
// and a build step that parsed a chart differently from the page would index it
// under passages the page never shows.
//
// A chart is a table with a fixed set of columns, gathered into named parts.
// The file opens with its title and its facts, then a paragraph or two of
// introduction, then each `##` is a part: a line saying what the part gathers,
// then a row to a line:
//
//   # The Miracles of Jesus Christ
//   * subtitle: Type, initiative, and the faith connection
//   * volume: new-testament
//   * order: 5
//   * columns: Miracle | Initiated By | Faith Noted? | Reference
//
//   Each entry records who initiated the miracle…
//
//   ## Healings
//   Restorations of the body — sought, brought, and unsought.
//
//   - Cleansing a leper | The leper | Yes | Matt 8:2–4 (Mk 1:40–45)
//
// `form: timeline` sets the rows out as a dated thread rather than a table —
// a chronology is read down its years, not across its columns. Its rows are
// `when // what | the account | reference`.
//
// `widths` is optional and gives the columns their proportions — a chart whose
// first column is a name rather than a quotation wants its width spent
// elsewhere. Left out, the first column takes twice a plain one, which suits
// the charts led by a passage.
//
// A cell holding more than one line writes them `first // second`: a quotation
// and the note under it, a word and the form it takes in the verse. A `##`
// part with no rows under it is prose — the closing essay some charts carry —
// and is set as paragraphs rather than as a table.

export const slugOf = (path) => path.split("/").pop().replace(/\.md$/, "");

const cells = (line) => line.replace(/^-\s*/, "").split("|").map((c) => c.trim());

export function parseChart(md, slug) {
  const doc = {
    slug, title: slug, subtitle: "", volume: "", order: 999, form: "table",
    columns: [], widths: [], intro: [], parts: [],
  };
  let part = null;

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !line.startsWith("##")) { doc.title = h1[1].trim(); continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      part = { name: h2[1].trim(), prose: [], rows: [] };
      doc.parts.push(part);
      continue;
    }

    // A blank line ends a paragraph; a run of lines is one paragraph wrapped,
    // which is how prose is written in these files.
    if (!line) { (part ? part.prose : doc.intro).push(""); continue; }

    const fact = line.match(/^\*\s*(subtitle|volume|order|form|columns|widths)\s*:\s*(.+)$/i);
    if (fact) {
      const key = fact[1].toLowerCase();
      const value = fact[2].trim();
      if (key === "order") doc.order = Number(value);
      else if (key === "columns" || key === "widths") {
        doc[key] = value.split("|").map((c) => c.trim());
      } else doc[key] = value;
      continue;
    }

    if (line.startsWith("- ")) {
      // A chart with no `##` of its own is one unnamed part.
      if (!part) { part = { name: "", prose: [], rows: [] }; doc.parts.push(part); }
      part.rows.push(cells(line).map((c) => c.split("//").map((s) => s.trim()).filter(Boolean)));
      continue;
    }

    (part ? part.prose : doc.intro).push(line);
  }

  const paragraphs = (lines) => lines
    .reduce((out, l) => {
      if (!l) out.push([]);
      else (out[out.length - 1] || out[out.push([]) - 1]).push(l);
      return out;
    }, [[]])
    .map((p) => p.join(" ").trim())
    .filter(Boolean)
    .join("\n\n");

  doc.intro = paragraphs(doc.intro);
  for (const p of doc.parts) p.prose = paragraphs(p.prose);
  return doc;
}

// The order the shelf reads in, which the manifest and the page must agree on.
export const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
