// The people the book came through, read from markdown in src/data/coming-forth
// — one file per volume, named for it, as the prophets and the timeline are.
//
// Each figure is a `#` heading carrying the year of the work they are
// remembered for, then a short list of facts, then the prose:
//
//   # 1830 · John H. Gilbert
//   * years: 1802–1895
//   * role: Compositor
//   * image: john-gilbert
//
//   E. B. Grandin's compositor, who set the type of the 1830 edition…
//
// The year is part of the heading rather than a field of its own because it is
// what the entry is filed under: two people can share one, and the order they
// are written in is the order they are read in.
const FILES = import.meta.glob("../data/coming-forth/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");

// "1830 · John H. Gilbert" → the two halves. Anything without a leading year is
// the file's own title, which is not a figure.
const splitHeading = (text) => {
  const m = text.match(/^(\d{3,4})\s*[·•|-]\s*(.+)$/);
  return m ? { year: +m[1], name: m[2].trim() } : null;
};

function parse(source) {
  const figures = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    current.body = current.body.join("\n").trim();
    if (current.body) figures.push(current);
    current = null;
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const head = line.match(/^#\s+(.+)$/);
    if (head) {
      flush();
      const split = splitHeading(head[1].trim());
      // The file's own title has no year, and neither has anything else that
      // is not a person; both are simply not figures.
      current = split ? { ...split, years: "", role: "", image: "", body: [] } : null;
      continue;
    }
    if (!current) continue;
    const fact = line.match(/^\*\s*(years|role|image)\s*:\s*(.+)$/i);
    if (fact) {
      current[fact[1].toLowerCase()] = fact[2].trim();
      continue;
    }
    if (line === "---") continue;
    current.body.push(line);
  }
  flush();
  return figures;
}

const BY_FILE = Object.fromEntries(
  Object.entries(FILES).map(([path, source]) => [fileOf(path), parse(source)]),
);

// The figures of a volume, in the order the file writes them — which is the
// order the years run.
export const comingForthFor = (volume) => (volume && BY_FILE[volume.file]) || [];

export const portraitFor = (image) => `${import.meta.env.BASE_URL}figures/${image}.jpg`;
