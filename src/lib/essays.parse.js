// Reading one translation essay. Kept apart from the shelf that gathers them
// (essays.js) for the reason charts.parse.js is: scripts/build-manifest.mjs
// reads these files in plain Node to work out which passages each one treats,
// and it must read them exactly as the page does. Nothing here may touch
// `import.meta`.
//
// length rather than tabulated. One markdown file per essay in
// src/data/evidences/translation, numbered in the order they are meant to be
// read, and written as ordinary prose — which is what makes them a different
// kind of thing from the evidences beside them on the shelf. An evidence points
// at a pattern in the text; an essay weighs a body of testimony about how the
// text was made, and that argument has to be made in sentences.
//
// The format is the markdown the files were written in, read literally:
//
//   # The Translator: Joseph Smith's Preparation and Limitations
//
//   ## An Unlearned Man
//
//   Any assessment of the Book of Mormon's origins must begin…
//
//   <details>
//   <summary>"Joseph Smith could neither write…" — Emma Smith, 1879</summary>
//
//   > "Joseph Smith could neither write nor dictate a coherent…" ("Last
//   > Testimony of Sister Emma," *Saints' Herald* 26, October 1, 1879)
//
//   </details>
//
// The `# ` title carries the essay's subtitle after a colon. Each `## ` opens a
// part. A `<details>` block is a pull quote: the `<summary>` is the sentence
// worth setting on the page, and what follows is the whole statement, which the
// reader can ask for. The files keep the HTML because it is also how they read
// as plain markdown anywhere else — a quote that opens on its own.

// "1-the-translator.md" → 1 and "translation-the-translator". The number orders
// the series and does not survive into the URL; the prefix keeps a name as
// general as "time" from colliding with anything else on the shelf.
export const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");
export const orderOf = (name) => Number(name.match(/^(\d+)-/)?.[1] ?? 999);
export const slugOf = (name) => `translation-${name.replace(/^\d+-/, "")}`;

// The line a quote is credited to, taken off the end of the summary: the
// sentence, then an em dash, then who said it and when. The last dash wins —
// a quotation may well hold one of its own.
function creditOf(summary) {
  const m = summary.match(/^(.*)\s+—\s+(.+)$/);
  return m ? { text: m[1].trim(), who: m[2].trim() } : { text: summary, who: "" };
}

// The source in brackets at the end of a quoted statement, set apart from the
// words themselves — a citation read in the same face and size as the sentence
// it follows reads as part of the sentence.
function sourceOf(text) {
  const m = text.match(/^(.*[.!?”"'’])\s+\(([^)]+)\)$/);
  return m ? { text: m[1].trim(), source: m[2].trim() } : { text, source: "" };
}

export function parseEssay(md, slug, order) {
  const doc = { slug, order, title: slug, subtitle: "", image: "", parts: [] };
  let part = null;
  let quote = null;   // the <details> being read, if any

  // A stray line before the first `## ` belongs to a part of its own, so
  // nothing an author writes is silently dropped.
  const opening = (name) => {
    part = { name, blocks: [] };
    doc.parts.push(part);
    return part;
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { opening(h2[1].trim()); quote = null; continue; }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      const split = h1[1].match(/^([^:]+):\s*(.+)$/);
      doc.title = (split ? split[1] : h1[1]).trim();
      doc.subtitle = split ? split[2].trim() : "";
      continue;
    }

    if (!line) continue;

    // The plate the essay opens with, named in the file and kept in
    // public/translation. Only read before the first part, so a line of prose
    // that happens to start with an asterisk is not mistaken for one.
    const fact = !part && line.match(/^\*\s*image\s*:\s*(.+)$/i);
    if (fact) { doc.image = fact[1].trim(); continue; }

    if (line === "<details>") {
      quote = { kind: "quote", text: "", who: "", parts: [] };
      (part || opening("")).blocks.push(quote);
      continue;
    }
    if (line === "</details>") { quote = null; continue; }

    const summary = line.match(/^<summary>(.*)<\/summary>$/);
    if (summary && quote) {
      // "(expand for full statement)" is the interface's job to say, and the
      // interface says it below in its own words; left in, the page asks twice.
      const shown = summary[1].replace(/\s*<em>\(.*?\)<\/em>\s*$/, "").trim();
      Object.assign(quote, creditOf(shown));
      continue;
    }

    const quoted = line.match(/^>\s?(.*)$/);
    if (quote) {
      quote.parts.push(quoted
        ? { kind: "said", ...sourceOf(quoted[1].trim()) }
        : { kind: "note", text: line });
      continue;
    }
    (part || opening("")).blocks.push({ kind: "text", text: line });
  }

  return doc;
}


// The order the series reads in, which the manifest and the page must agree on.
export const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
