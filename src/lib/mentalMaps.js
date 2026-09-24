// The mental maps: one page to each longer book of the Book of Mormon, drawn
// from the data in data/mental-maps — the chapters grouped and coloured by the
// thread they follow, the threads laid side by side against the clock, and the
// passages and dates worth carrying away.
//
// This file is what the rest of the site may know about them without fetching
// them: which books have one, what each is called, and where its print copy
// is. It is read on the first paint (the URL, the tab's title, the search
// field), so it names the maps and nothing more — the data itself is imported
// only by components/MentalMaps.jsx, behind the tile that opens it.
//
// The five one-chapter books have no map; a single chapter has no shape to
// draw. The threads are listed here, as well as in each book's data, because
// the shelf and the search field both describe a map by them.
export const MENTAL_MAP_VOLUME = "bofm";

export const MENTAL_MAPS = [
  { slug: "1-nephi", book: "1 Nephi", threads: ["Lehi's family", "Laman & Lemuel", "Revelation", "The plates"] },
  { slug: "2-nephi", book: "2 Nephi", threads: ["Lehi", "Nephi", "Jacob", "Isaiah"] },
  { slug: "jacob", book: "Jacob", threads: ["Jacob", "The Nephites", "Zenos's allegory", "Sherem"] },
  { slug: "mosiah", book: "Mosiah", threads: ["Zarahemla", "Zeniff's colony", "Alma's people", "Abinadi"] },
  { slug: "alma", book: "Alma", threads: ["Alma", "Sons of Mosiah", "The war", "Dissenters"] },
  { slug: "helaman", book: "Helaman", threads: ["The judgment seat", "The Gadianton band", "The prophets", "The Lamanites", "Samuel", "Mormon"] },
  { slug: "3-nephi", book: "3 Nephi", threads: ["The people", "Gadianton robbers", "Jesus Christ", "The Twelve", "Mormon"] },
  { slug: "mormon", book: "Mormon", threads: ["Mormon", "The war", "Moroni"] },
  { slug: "ether", book: "Ether", threads: ["Brother of Jared", "The kings", "Moroni", "Ether"] },
  { slug: "moroni", book: "Moroni", threads: ["Moroni", "The ordinances", "Mormon"] },
];

export const hasMentalMaps = (volume) => !!volume && volume.id === MENTAL_MAP_VOLUME;

export const mentalMapBySlug = (slug) => MENTAL_MAPS.find((m) => m.slug === slug) || null;

export const mentalMapExists = (slug) => !!mentalMapBySlug(slug);

export const mentalMapTitle = (slug) => {
  const m = mentalMapBySlug(slug);
  return m ? `Mental Map of ${m.book}` : null;
};

// The two-page print copy, built from the same data by the maps' own script.
export const mentalMapPdf = (slug) => {
  const m = mentalMapBySlug(slug);
  return m ? `${import.meta.env.BASE_URL}mental-maps/Mental-Map-of-${m.book.replace(/ /g, "-")}.pdf` : null;
};
