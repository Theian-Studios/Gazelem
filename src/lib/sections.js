// Which of a volume's own pages have been written, asked without reading them.
//
// The map, the coming forth, the study resources and the chapter overview are
// each a file per volume, named for it — so whether a volume has one is a
// question about the names of the files, and a glob left unresolved answers it
// for nothing. Vite gives back the paths either way; only `eager` decides
// whether the contents come with them.
//
// This exists so App can decide which tiles to offer without importing the
// pages that would answer the same question — which is what kept every one of
// them in the first download.
const globbed = (files) =>
  new Set(Object.keys(files).map((p) => p.split("/").pop().replace(/\.md$/, "")));

// Deliberately not eager. Adding `eager: true` to any of these silently undoes
// the split: the data lands back in the first chunk and nothing looks wrong.
// `?raw` is still needed unresolved — it says what these files would be if they
// were ever fetched, and without it the build tries to read markdown as code.
// Written out at each call because Vite reads these arguments rather than
// running them, and will only accept an object written where it stands.
const CATEGORIES = globbed(import.meta.glob("../data/categories/*.md", { query: "?raw", import: "default" }));
const COMING_FORTH = globbed(import.meta.glob("../data/coming-forth/*.md", { query: "?raw", import: "default" }));
const RESOURCES = globbed(import.meta.glob("../data/resources/*.md", { query: "?raw", import: "default" }));

const has = (set) => (volume) => !!volume && set.has(volume.file);

export const hasCategories = has(CATEGORIES);
export const hasComingForth = has(COMING_FORTH);
export const hasResources = has(RESOURCES);
