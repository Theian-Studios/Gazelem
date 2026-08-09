// What has been written about the book, read from markdown in src/data/resources
// — one file per volume, named for it, as the prophets and the coming-forth
// figures are.
//
// A `##` opens a shelf and a `###` is one thing on it, carrying its title, then
// a short list of facts, then the sentence that says what it is:
//
//   ## Books
//
//   ### Understanding the Book of Mormon: A Reader's Guide
//   * author: Grant Hardy
//   * cover: understanding-the-book-of-mormon.jpg
//   * link: Deseret Book | https://www.deseretbook.com/product/5046290.html
//
//   The landmark literary reading that treats Nephi, Mormon, and Moroni as
//   distinct narrators with their own voices and agendas.
//
// `detail` is whatever belongs beside the author in small print — where an
// article was printed and when, or how many volumes a work runs to. `link` may
// be written more than once, since a work in two volumes is sold as two things.
// `cover` is what tells a book from an article: a book is shelved with its
// jacket, and an article has none to shelve.
const FILES = import.meta.glob("../data/resources/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const fileOf = (path) => path.split("/").pop().replace(/\.md$/, "");

function parse(source) {
  const groups = [];
  let group = null;
  let current = null;
  const flush = () => {
    if (!current) return;
    current.body = current.body.join(" ").trim();
    group.works.push(current);
    current = null;
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();

    const shelf = line.match(/^##\s+(.+)$/);
    if (shelf) {
      flush();
      group = { title: shelf[1].trim(), works: [] };
      groups.push(group);
      continue;
    }

    const head = line.match(/^###\s+(.+)$/);
    if (head && group) {
      flush();
      current = { title: head[1].trim(), author: "", detail: "", cover: "", links: [], body: [] };
      continue;
    }
    if (!current) continue;

    const fact = line.match(/^\*\s*(author|detail|cover|link)\s*:\s*(.+)$/i);
    if (fact) {
      const key = fact[1].toLowerCase();
      const value = fact[2].trim();
      if (key === "link") {
        const [label, href] = value.split("|").map((s) => s.trim());
        if (href) current.links.push({ label, href });
      } else {
        current[key] = value;
      }
      continue;
    }
    if (line) current.body.push(line);
  }
  flush();
  return groups.filter((g) => g.works.length);
}

const BY_FILE = Object.fromEntries(
  Object.entries(FILES).map(([path, source]) => [fileOf(path), parse(source)]),
);

// The shelves written for a volume, in the order the file sets them out.
export const resourcesFor = (volume) => (volume && BY_FILE[volume.file]) || [];

export const coverFor = (cover) => `${import.meta.env.BASE_URL}covers/${cover}`;
