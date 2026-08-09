// The written pages of the site, as against its scripture: the study charts
// and the evidences. Both are read out of markdown and both are shelved inside
// a volume, so they are gathered here into one list with the one thing a
// search needs of them — a title, the line under it, and the door they stand
// behind.
//
// The search field looks through titles and subtitles only. What a chart says
// in its rows is scripture quoted from elsewhere, and the word search already
// answers for that; what is worth finding here is the page itself — which is
// why the list can come from the manifest rather than from the pages, and the
// field can offer a chart by name without the chart having been fetched.
import { ARTICLES } from "./manifest.js";

// Punctuation and case set aside, so "d&c" and "dc" and "D & C" all read the
// same and a title's commas never stand between a query and its match.
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Titles are matched with and without the article they open with: half of them
// begin "The", and nobody types it when they are reaching for "war chapters".
const bare = (t) => t.replace(/^(?:the|a|an) /, "");

const INDEX = ARTICLES.map((a) => ({
  ...a,
  t: norm(a.title),
  b: bare(norm(a.title)),
  s: norm(`${a.title} ${a.subtitle}`),
}));

// Enough of a title typed that opening the page is plainly what was meant. A
// prefix alone is not enough — "war" opens The War Chapters and is far likelier
// to be a word someone wants found in the text — so it has to be a good part of
// the name, or the whole of it.
const NAMED = 8;

// Where a word of the text begins with the query — "miracles" finding "The
// Miracles of Jesus Christ" from the middle of its name rather than only from
// the front of it.
const atWordStart = (text, q) => text === q || text.startsWith(`${q} `) || text.includes(` ${q}`);

// The pages this query is asking for, best first. `strong` is whether the
// query reads as the name of the page rather than as a word that happens to
// appear in it — the caller offers a strong match ahead of the word search and
// a weak one behind it, so pressing Return still means "search for what I
// typed" unless what was typed is plainly a title.
export function findArticles(query, limit = 3) {
  const q = norm(query);
  if (q.length < 3) return [];
  const words = q.split(" ").filter(Boolean);
  const out = [];
  for (const a of INDEX) {
    const named = a.t === q || a.b === q;
    const opens = a.t.startsWith(q) || a.b.startsWith(q);
    let score = 0;
    if (named) score = 100;
    else if (opens) score = 80;
    else if (atWordStart(a.t, q)) score = 60;
    else if (a.t.includes(q)) score = 45;
    else if (atWordStart(a.s, q)) score = 30;
    else if (a.s.includes(q)) score = 20;
    // Every word of the query somewhere in the title or the line under it,
    // which is how a half-remembered name still lands: "psalms categories".
    else if (words.length > 1 && words.every((w) => a.s.includes(w))) score = 12;
    if (score) out.push({ ...a, score, strong: named || (opens && q.length >= NAMED) });
  }
  out.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
  return out.slice(0, limit);
}
