const CDN = "https://cdn.jsdelivr.net/gh/bcbooks/scriptures-json@master";

// Every volume is now built from a public-domain source and served from this
// site — the King James Version for the Bible, and pre-1929 printings for the
// rest. See scripts/build-scriptures.mjs and the rights note in the README.
// The CDN is no longer used; the constant stays for reference.
const SELF_HOSTED = new Set(["ot", "nt", "bofm", "pgp", "dc"]);

const sourceUrl = (volume) =>
  SELF_HOSTED.has(volume.id)
    ? `${import.meta.env.BASE_URL}scriptures/${volume.file}.json`
    : `${CDN}/${volume.file}.json`;

const cache = new Map();

function normalizeVolume(volId, data) {
  if (volId === "dc") {
    return [{
      name: "Sections",
      fullTitle: data.title,
      heading: data.subtitle,
      isSections: true,
      chapters: data.sections.map((s) => ({ n: s.section, label: `Section ${s.section}`, reference: s.reference, verses: s.verses })),
    }];
  }
  return data.books.map((b) => ({
    name: b.book,
    fullTitle: b.full_title,
    heading: b.heading,
    chapters: b.chapters.map((c) => ({ n: c.chapter, label: c.reference, reference: c.reference, verses: c.verses })),
  }));
}

export function getCached(volId) {
  return cache.get(volId) || null;
}

export async function loadVolume(volume) {
  if (cache.has(volume.id)) return cache.get(volume.id);
  const res = await fetch(sourceUrl(volume));
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  const normalized = normalizeVolume(volume.id, data);
  cache.set(volume.id, normalized);
  return normalized;
}
