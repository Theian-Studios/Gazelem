// Reading one evidence file. Kept apart from the shelf that gathers them
// (evidences.js) for the reason charts.parse.js is: scripts/build-manifest.mjs
// reads these files in plain Node to work out which passages each one treats,
// and it must read them exactly as the page does. Nothing here may touch
// `import.meta`.
//
// The evidences: things about the book that are easier to explain if it is what
// it says it is. One markdown file per evidence in src/data/evidences, read the
// same way the prophets and the categories are.
//
// A file opens with its title, a few facts about it, and a paragraph of
// introduction. Then each `##` is a form, carrying the shape its examples take:
//
//   # Hebraisms
//   * subtitle: Hebrew literary forms in an English book
//   * order: 1
//
//   Fifteen Hebrew literary forms, with the passages that exhibit them.
//
//   ## Cognate Verbs and Objects
//   * form: phrases
//   * gloss: The cognate accusative, where verb and object share a root
//
//   - I have dreamed a dream | 1 Nephi 3:2
//
// Five shapes, because the examples genuinely are five different things and
// flattening them into one would lose what each is showing:
//
//   phrases   a short phrase and where it stands, sometimes with a gloss
//   tchart    two readings set in columns and read across — source against
//             reversal, earliest text against the one printed now
//   ladder    a whole passage, set a line to a rung
//   quotes    a passage quoted at length, sometimes under a heading
//   wordplay  a name, what it means, and the verses that play on it
//
// An entry line is `text | reference` with an optional third field: a gloss for
// phrases and quotes, and for a chart row a leading label instead — `label |
// text | reference`, since the halves have to be told apart. A chart's labels
// are the same down every row, so they are set once as the heads of it.
//
// A `## ` form may be followed by prose, which is joined onto the end of its
// gloss: the gloss alone is what a card carries, and the two together are the
// description the form is opened with.

export const slugOf = (path) => path.split("/").pop().replace(/\.md$/, "");
const cells = (line) => line.replace(/^-\s*/, "").split("|").map((c) => c.trim());

// `* key: value`, the same fact syntax the coming-forth entries use.
const fact = (line) => {
  const m = line.match(/^\*\s*([a-z]+)\s*:\s*(.+)$/i);
  return m ? { key: m[1].toLowerCase(), value: m[2].trim() } : null;
};

export function parseEvidence(md, slug) {
  const doc = { slug, title: slug, subtitle: "", order: 999, intro: [], forms: [] };
  let form = null;   // the `##` being read
  let group = null;  // the `###` inside it
  let target = doc;  // where a fact or a stray line belongs right now

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) { doc.title = h1[1].trim(); target = doc; continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      form = { name: h2[1].trim(), form: "phrases", gloss: "", note: [], items: [], groups: [] };
      doc.forms.push(form);
      group = null;
      target = form;
      continue;
    }

    // A `###` opens a group. Its heading is optional: the pairs use bare ones,
    // since what tells those apart is the labels on the lines inside.
    const h3 = line.match(/^###\s*(.*)$/);
    if (h3 && form) {
      group = { title: h3[1].trim(), root: "", lines: [], items: [] };
      form.groups.push(group);
      target = group;
      continue;
    }

    if (!line) continue;

    const f = fact(line);
    if (f) {
      if (target === doc && (f.key === "subtitle" || f.key === "order")) {
        doc[f.key] = f.key === "order" ? Number(f.value) : f.value;
      } else if (target === form && (f.key === "form" || f.key === "gloss")) {
        form[f.key] = f.value;
      } else if (target === group && f.key === "root") {
        group.root = f.value;
      }
      continue;
    }

    if (line.startsWith("- ")) {
      const c = cells(line);
      if (!form) continue;
      const item = form.form === "tchart"
        ? { label: c[0] || "", text: c[1] || "", ref: c[2] || "" }
        : { text: c[0] || "", ref: c[1] || "", gloss: c[2] || "" };
      (group ? group.items : form.items).push(item);
      continue;
    }

    // Anything else is prose: the file's introduction, a form's note, or — in a
    // ladder — a rung of the passage itself.
    if (target === doc) doc.intro.push(line);
    else if (target === group) group.lines.push(line);
    else if (target === form) form.note.push(line);
  }

  doc.intro = doc.intro.join(" ").trim();
  for (const f of doc.forms) f.note = f.note.join(" ").trim();
  return doc;
}

// The order the shelf reads in, which the manifest and the page must agree on.
export const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
