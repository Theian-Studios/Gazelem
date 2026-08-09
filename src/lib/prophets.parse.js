// Reading one volume's prophets file. Kept apart from the shelf that gathers
// them (prophets.js) for the reason charts.parse.js is: scripts/build-manifest.mjs
// reads these files in plain Node to write out the names, and it must find the
// same prophets the page does — a heading dropped here for having nothing under
// it must be dropped there too. Nothing here may touch `import.meta`.
//
// per volume, named for it. Each prophet is a `#` heading followed by `##`
// sections of bullets:
//
//   # Lehi
//   ## Quotes
//   * "Adam fell that men might be" (2 Ne 2:25)
//   ## Roles
//   * Patriarch
//
// Vite inlines every match at build time, the same arrangement as the notes,
// the timeline and the related chapters.

// "../data/prophets/book-of-mormon.md" → "book-of-mormon", which is the `file`
// each volume is named by in data/volumes.js.
export const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");

// A bullet reads as prose, its reference in brackets, and — where the words
// are not the prophet's own — a note after the brackets saying whose they are.
// Splitting the three lets the reference be made a link and each part set as
// what it is.
function splitRef(line) {
  const m = line.match(/^(.*?)\s*\(([^()]*\d[^()]*)\)\s*(?:—\s*(.+))?$/);
  if (!m) return { text: line.trim(), ref: null, said: null };
  return { text: m[1].trim(), ref: m[2].trim(), said: m[3]?.trim() || null };
}

// "Prophet in Jerusalem: "There came many prophets…"" — a timeline entry often
// names the moment before quoting it, and the two want setting differently.
function splitLead(text) {
  const m = text.match(/^([^:]{2,60}):\s+(.+)$/s);
  return m ? { lead: m[1].trim(), rest: m[2].trim() } : { lead: null, rest: text };
}

const SECTIONS = {
  quotes: "quotes",
  roles: "roles",
  "key teachings": "teachings",
  "key chapters": "chapters",
  timeline: "timeline",
};

export function parseProphets(md) {
  const out = [];
  let prophet = null;
  let key = null;

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      // The file's own title is a `#` too; it is the one with no sections
      // under it, so it falls away when the next heading arrives empty.
      prophet = { name: h1[1].trim(), quotes: [], roles: [], teachings: [], chapters: [], timeline: [] };
      out.push(prophet);
      key = null;
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      key = SECTIONS[h2[1].trim().toLowerCase()] || null;
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.+)$/);
    if (!bullet || !prophet || !key) continue;

    // Emphasis and the trailing attributions the file adds to words that are
    // the Lord's rather than the prophet's are kept as written; only the
    // markdown markers go.
    const text = bullet[1].replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");

    if (key === "quotes") {
      const { text: quote, ref, said } = splitRef(text);
      prophet.quotes.push({ text: quote.replace(/^["“]|["”]$/g, "").trim(), ref, said });
    } else if (key === "timeline") {
      // A timeline entry can carry several references through its sentence, so
      // they are left where they stand and linked in place.
      prophet.timeline.push(splitLead(text));
    } else {
      prophet[key].push(text);
    }
  }

  // A heading with nothing under it was the file's title, not a prophet — and
  // "nothing" means every section, not the three most prophets happen to carry.
  return out.filter((p) => Object.values(SECTIONS).some((k) => p[k].length));
}

