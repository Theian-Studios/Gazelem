// Which file a stem's postings live in. The builder and the reader have to
// agree on this exactly, so it is written once and imported by both — see
// scripts/build-search-index.mjs.
//
// Normally the first two letters. Prefixes whose shard grew too large are
// split a letter deeper; meta.json lists which, since only the builder knows.
export function shardKey(stem, depth = 2) {
  return stem.length >= depth ? stem.slice(0, depth) : stem.padEnd(depth, "_");
}

export const shardFor = (stem, deep) =>
  shardKey(stem, deep?.has(shardKey(stem, 2)) ? 3 : 2);
