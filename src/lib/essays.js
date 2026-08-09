// The translation essays: the coming forth of the Book of Mormon argued at
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
//
// The whole series is inlined here, so nothing outside an essay page may import
// this file: what the rest of the site needs to know without opening one is
// answered from the manifest instead. See lib/manifest.js.
import { VOLUMES } from "../data/volumes.js";
import { parseEssay, fileOf, orderOf, slugOf, byOrder } from "./essays.parse.js";

const FILES = import.meta.glob("../data/evidences/translation/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The essays are written about the Book of Mormon, which is the shelf they
// stand on. Named here rather than in each file, since the whole series is one
// subject and repeating it twelve times would only invite it to disagree.
export const ESSAY_VOLUME = "bofm";
export const ESSAY_SECTION = "Translation";

const ALL = Object.entries(FILES)
  .map(([path, md]) => {
    const name = fileOf(path);
    return parseEssay(md, slugOf(name), orderOf(name));
  })
  .sort(byOrder);

export const ESSAYS = ALL;

export const essayBySlug = (slug) => ALL.find((e) => e.slug === slug) || null;

export const hasEssays = (volume) => !!volume && volume.id === ESSAY_VOLUME && ALL.length > 0;

export const essayVolume = () => VOLUMES.find((v) => v.id === ESSAY_VOLUME) || null;

// Where an essay's plate is served from, as the portraits and the covers are.
export const essayImage = (image) => `${import.meta.env.BASE_URL}translation/${image}`;

