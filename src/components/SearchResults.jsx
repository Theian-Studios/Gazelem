import { useState, useEffect, useMemo, useReducer } from "react";
import { glass, ink, inkSoft, gold } from "../theme.js";
import { VOLUMES, VOL_SHORT } from "../data/volumes.js";
import { search, snippet, cachedVerses, loadTextFor } from "../lib/wordsearch.js";
import { nearest, replaceWord } from "../lib/suggest.js";

// How many rows are drawn at once. The rest are a button away, which also
// keeps the volumes fetched for their quoted lines to what is on screen.
const PAGE = 25;

function Chip({ on, onClick, title, children }) {
  return (
    <button className="lift srch-chip" data-on={on || undefined} onClick={onClick} title={title} aria-pressed={on}>
      {children}
    </button>
  );
}

// The verse a result lands on, cut to a window around the match. Renders as
// plain text until the volume holding it arrives.
function Snippet({ row, stems }) {
  const verses = cachedVerses(row);
  const text = verses?.[row.firstVerse];
  if (!text) return <p className="srch-snippet srch-waiting">{row.reference}:{row.firstVerse}</p>;
  return (
    <p className="serif srch-snippet">
      {snippet(text, stems).map((p, i) =>
        p.hit ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>
      )}
    </p>
  );
}

// `filters` is held by the caller: opening a result unmounts this panel, and a
// reader coming back from that chapter should find the list as they left it.
// `field` is the search field itself, handed down to stand under the heading —
// named for what it is rather than for what it does, since `search` here is the
// index query above.
export default function SearchResults({ query, filters, setFilters, field, onSearch, onOpen, onClose }) {
  const { volumes, exactPhrase, byOrder } = filters;
  const set = (patch) => setFilters({ ...filters, ...patch });
  const [result, setResult] = useState({ status: "loading", rows: [], terms: [] });
  const [shown, setShown] = useState(PAGE);
  // Scripture text lives in a module-level cache rather than in state, so a
  // volume landing changes nothing React watches. This says "look again".
  const [, textArrived] = useReducer((n) => n + 1, 0);

  useEffect(() => setShown(PAGE), [query, exactPhrase, volumes]);

  useEffect(() => {
    let alive = true;
    setResult((r) => ({ ...r, status: "loading" }));
    search(query, { volumes, exactPhrase })
      .then((r) => alive && setResult({ status: "ready", ...r }))
      .catch(() => alive && setResult({ status: "error", rows: [], terms: [] }));
    return () => { alive = false; };
  }, [query, exactPhrase, volumes]);

  const rows = useMemo(() => {
    const list = result.rows;
    return byOrder ? [...list].sort((a, b) => a.unit - b.unit) : list;
  }, [result.rows, byOrder]);

  const page = rows.slice(0, shown);

  // Only the rows on screen pull their volume down, and the volume with the
  // most of them comes first.
  useEffect(() => {
    let alive = true;
    loadTextFor(page, () => alive && textArrived());
    return () => { alive = false; };
  }, [rows, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing found, and a word in the query the scriptures never say: the near
  // misses for that word are worth offering rather than a dead end.
  const [meantInstead, setMeantInstead] = useState([]);
  useEffect(() => {
    const missing = result.status === "ready" && !result.rows.length ? result.missing || [] : [];
    if (!missing.length) { setMeantInstead([]); return; }
    let alive = true;
    Promise.all(missing.map((t) => nearest(t.word, 3).then((words) => ({ term: t.word, words }))))
      .then((all) => alive && setMeantInstead(all.filter((x) => x.words.length)));
    return () => { alive = false; };
  }, [result]);

  const stems = useMemo(() => new Set(result.terms.map((t) => t.stem)), [result.terms]);
  // Verses, not occurrences: `hits` counts every time a term is said, so a verse
  // that says it three times would be three verses in the count under the
  // heading. It is what ranks a chapter; what is reported is how many of its
  // verses the reader would actually be shown.
  const found = rows.reduce((a, r) => a + r.verses.length, 0);

  return (
    <section className="pop srch" aria-label={`Search results for ${query}`}>
      <header className="srch-head">
        <h2 className="serif srch-title">{query}</h2>
        <button className="lift srch-close" onClick={onClose} aria-label="Close search results">✕</button>
      </header>

      {field}

      <div className="srch-controls" style={{ ...glass, borderRadius: 18 }}>
        <div className="srch-chips">
          {VOLUMES.map((v) => (
            <Chip key={v.id} title={v.title} on={volumes.has(v.id)}
              onClick={() => {
                const next = new Set(volumes);
                next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                set({ volumes: next });
              }}
            >
              {VOL_SHORT[v.id]}
            </Chip>
          ))}
          {/* No volumes chosen means every volume, so the reset is only worth
              offering once something has been narrowed. */}
          {volumes.size > 0 && (
            <button className="lift srch-clear" onClick={() => set({ volumes: new Set() })}>All</button>
          )}
          <span className="srch-divider" aria-hidden />
          <Chip on={exactPhrase} onClick={() => set({ exactPhrase: !exactPhrase })}
            title="Only verses where these words stand together, in this order">
            Exact Phrase
          </Chip>
        </div>

        <button className="lift srch-sort" onClick={() => set({ byOrder: !byOrder })}>
          Sort by {byOrder ? "Scripture Order" : "Relevance"}
        </button>
      </div>

      {result.status === "loading" && <p className="srch-note">Searching…</p>}
      {result.status === "error" && (
        <p className="srch-note">Couldn't reach the search index. Check your connection and try again.</p>
      )}
      {result.status === "ready" && rows.length === 0 && (
        <>
          <p className="srch-note">
            No {exactPhrase ? "verse holds that phrase" : "chapter carries every one of those words"}
            {volumes.size ? " in the volumes you've chosen" : ""}.
          </p>
          {meantInstead.map(({ term, words }) => (
            <p key={term} className="srch-note srch-meant">
              Did you mean{" "}
              {words.map((w, i) => (
                <span key={w}>
                  {i > 0 && (i === words.length - 1 ? " or " : ", ")}
                  <button className="srch-meant-word" onClick={() => onSearch(replaceWord(query, term, w))}>
                    {w}
                  </button>
                </span>
              ))}
              ?
            </p>
          ))}
        </>
      )}

      {result.status === "ready" && rows.length > 0 && (
        <>
          <p className="srch-count">
            {rows.length.toLocaleString()} chapter{rows.length === 1 ? "" : "s"} · {found.toLocaleString()} verse{found === 1 ? "" : "s"}
          </p>
          <ul className="srch-list">
            {page.map((row) => (
              <li key={row.unit}>
                <button className="srch-row" onClick={() => onOpen(row)}>
                  <span className="srch-row-head">
                    <span className="serif srch-ref">{row.reference}</span>
                    <span className="srch-hits" title={`${row.verses.length} verse${row.verses.length === 1 ? "" : "s"}`}>{row.verses.length}</span>
                  </span>
                  <span className="srch-vol">{VOLUMES.find((v) => v.id === row.volId)?.title}</span>
                  <Snippet row={row} stems={stems} />
                </button>
              </li>
            ))}
          </ul>
          {shown < rows.length && (
            <button className="lift srch-more" onClick={() => setShown((n) => n + PAGE)}>
              Show more
            </button>
          )}
        </>
      )}
    </section>
  );
}
