import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { VOLUMES, VOL_SHORT } from "./data/volumes.js";
import { loadVolume, getCached } from "./lib/api.js";
import { glass, ink } from "./theme.js";
import AmbientGlow from "./components/AmbientGlow.jsx";
import SearchBox from "./components/SearchBox.jsx";
import VolumeGrid from "./components/VolumeGrid.jsx";
import BookList from "./components/BookList.jsx";
import ChapterGrid from "./components/ChapterGrid.jsx";
import SearchResults from "./components/SearchResults.jsx";
import Reader from "./components/Reader.jsx";
import ChapterTimeline from "./components/ChapterTimeline.jsx";
import RelatedChapters from "./components/RelatedChapters.jsx";
import NavPill from "./components/NavPill.jsx";
import FindBar from "./components/FindBar.jsx";
import { LensBody } from "./components/LensPanel.jsx";
import VolumeTimeline, { hasTimeline } from "./components/VolumeTimeline.jsx";
import ContentsCard from "./components/ContentsCard.jsx";
import StudyDock, { PANELS, useFilledPanels, useSheetDismissal, useHideOnScrollDown } from "./components/StudyDock.jsx";
import SectionTile, { TimelineIcon, ProphetsIcon, MapIcon, ComingForthIcon, OverviewIcon, EvidencesIcon, ResourcesIcon, ChartsIcon } from "./components/SectionTile.jsx";
import { mentionsOf, marginMentions } from "./lib/mentions.js";
import { ChapterOverview, CommentaryNotes, CrossConnections } from "./components/Commentary.jsx";
import { useCommentary, connectionsByVerse } from "./lib/commentary.js";
import { parseCitations } from "./lib/refs.js";
import { useHorizontalSwipe } from "./lib/swipe.js";
import { countIn } from "./lib/find.js";
import { LoadingShimmer, ErrorCard } from "./components/Status.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { hasCategories, hasComingForth, hasResources } from "./lib/sections.js";
import { hasCharts, chartExists, hasEvidences, evidenceExists, essayExists, hasProphets, prophetNames, prophetNamed, placeNamed, pageTitle } from "./lib/manifest.js";

// The volume's own pages, fetched when one is opened rather than with the site.
//
// Between them — the charts above all, then the evidences, the map's places and
// the essays — they are four fifths of everything there is to download, and a
// reader who opens the site to read a chapter wants none of it. What App still
// needs to know about them without opening one (which tiles to offer, whether a
// slug is real, and which of them treat the chapter in hand) comes from the
// manifest and from lib/sections.js, neither of which carries a page.
//
// So none of these may be imported normally anywhere, and nothing they import
// may be either: one static import of lib/charts.js from a module already in
// the first chunk quietly puts all thirty-three charts back into it.
const ProphetGrid = lazy(() => import("./components/Prophets.jsx").then((m) => ({ default: m.ProphetGrid })));
const ProphetPage = lazy(() => import("./components/Prophets.jsx").then((m) => ({ default: m.ProphetPage })));
const MapView = lazy(() => import("./components/MapView.jsx"));
const ComingForth = lazy(() => import("./components/ComingForth.jsx"));
const Resources = lazy(() => import("./components/Resources.jsx"));
const VolumeOverview = lazy(() => import("./components/VolumeOverview.jsx"));
const ChartGrid = lazy(() => import("./components/Charts.jsx").then((m) => ({ default: m.ChartGrid })));
const ChartPage = lazy(() => import("./components/Charts.jsx").then((m) => ({ default: m.ChartPage })));
const EvidenceGrid = lazy(() => import("./components/Evidences.jsx").then((m) => ({ default: m.EvidenceGrid })));
const EvidencePage = lazy(() => import("./components/Evidences.jsx").then((m) => ({ default: m.EvidencePage })));
const EssayPage = lazy(() => import("./components/Essays.jsx").then((m) => ({ default: m.EssayPage })));

export default function App() {
  const [volId, setVolId] = useState(null);
  const [bookIdx, setBookIdx] = useState(null);
  const [chapIdx, setChapIdx] = useState(null);
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Which verses are marked, and scrolled to. A list rather than a number: a
  // reference names a run as often as it names one verse — "vv. 4–6" — and
  // marking only the first of them said the wrong thing about what was cited.
  // Everything that sets a single verse sets a list of one; see markVerses.
  const [targetVerse, setTargetVerse] = useState(null);
  const markVerses = (v) => setTargetVerse(v == null ? null : [].concat(v));
  // -1 / 1 while paging with the nav arrows, 0 for every other entry point.
  const [flipDir, setFlipDir] = useState(0);
  // Which lenses the commentary is read through. Nothing consumes these yet —
  // they're held here so the reader can pick them up once it does.
  const [lens, setLens] = useState({ level: "Chapter", world: "text" });
  // The word search now running, if any. While it is set the main column is
  // the results list; the volume, book and chapter under it are left where
  // they were, so clearing the search puts the reader back.
  const [query, setQuery] = useState(null);
  // How the results are narrowed. Held here rather than in the results panel,
  // which is unmounted every time one of its results is opened.
  const [filters, setFilters] = useState({ volumes: new Set(), exactPhrase: false, byOrder: false });
  // What is being looked for in the chapter on screen, which is a different
  // question from what is being searched for across the standard works.
  const [find, setFind] = useState(null);
  // The prophets of the open volume, which are read alongside its books rather
  // than inside them: null while closed, "" for the shelf of them, and a name
  // for the one being read.
  const [prophet, setProphet] = useState(null);
  // The open book's whole arc, read as one page rather than six rows at a
  // time in the sidebar band.
  // Which of the volume's own sections is open, if any: its arc or its map.
  // (Its prophets are held separately, since one of them can be open too.)
  const [section, setSection] = useState(null);
  // The passage a study page was opened for, where it was opened from a chapter
  // rather than off its own shelf. Held beside the section so leaving the
  // section clears it.
  const [focus, setFocus] = useState(null);
  // Which place the map should open on, when it was opened from a chapter's
  // overview rather than off the shelf. Cleared with the section, like focus.
  const [place, setPlace] = useState(null);
  // Narrow layouts keep the field out of the way until it is asked for; this
  // is whether it is on screen, and the counter beside it hands it the caret
  // each time it is opened afresh.
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setFocusKey((n) => n + 1);
  }, []);
  // Where the reader came from, read off the entry they are standing on rather
  // than kept in a stack of our own. Every push stamps the view it leaves into
  // the entry it creates, so "how you got here" survives a refresh, agrees
  // with the browser's own back button, and — the thing the stack never
  // managed — is written by *every* way through the site rather than by the
  // three that remembered to call it.
  const [from, setFrom] = useState(null);
  // The chapter the reader was last in, kept while they are away among the
  // charts and the essays. Retracing six hops is not what a reader wants from
  // there; the text they were studying is, and this is one press to it.
  const [anchor, setAnchor] = useState(null);
  // Which panels the reader has folded away, by card id. Every card starts
  // open; this is held here rather than in the cards so a card the reader has
  // folded stays folded through the remounts that replay their entrance
  // animations on every chapter and lens change.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleCard = useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const volume = VOLUMES.find((v) => v.id === volId) || null;
  const book = books && bookIdx != null ? books[bookIdx] : null;
  const chapter = book && chapIdx != null ? book.chapters[chapIdx] : null;

  // Where the reader was left in each chapter, so returning to one resumes
  // rather than jumping back to the top.
  const scrollPos = useRef(new Map());
  const chapterKey = chapter ? `${volId}:${bookIdx}:${chapIdx}` : null;
  const chapterKeyRef = useRef(null);
  useEffect(() => { chapterKeyRef.current = chapterKey; });

  // Whether a results list stands over the chapter, read by rememberScroll
  // below — which is called from callbacks that were written once and cannot
  // close over this render's query.
  const queryRef = useRef(null);
  useEffect(() => { queryRef.current = query; });

  // Snapshot before navigating, never from a scroll listener: swapping chapters
  // changes the document height, and the browser clamps the scroll and fires a
  // scroll event *before* effects run — which would overwrite the position we
  // just tried to save with the clamped one.
  const rememberScroll = useCallback(() => {
    const y = window.scrollY;
    // On the history entry as well as in the map below, because the map can
    // only key a chapter: a step back into a results list, a chart or the map
    // has no chapter to be restored through, and this is what puts it back
    // where it was left.
    window.history.replaceState({ ...window.history.state, scrollY: y }, "");
    // The page's scroll belongs to whatever is on it. While a results list is
    // up that is the list, not the chapter still standing underneath — which
    // put its own position away when the search opened, and would otherwise
    // have it overwritten with how far down the results the reader had read.
    if (queryRef.current) return;
    if (chapterKeyRef.current) scrollPos.current.set(chapterKeyRef.current, y);
  }, []);

  // Narrow layout: the chapter title pins just below the sticky top bar, whose
  // height depends on how the breadcrumbs wrap — so it's measured, not guessed.
  // (The wide layout ignores --chrome-h; there the bar is a sidebar.)
  useEffect(() => {
    const el = document.querySelector(".chrome");
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--chrome-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Every navigation takes a ticket. A volume is fetched, and the reader can
  // ask for another before the first arrives — so what a fetch does when it
  // lands is settled by whether it is still the thing being waited for. Without
  // it a slow volume asked for first can drop its books over a fast one asked
  // for second, and the page ends up titled one volume and filled with another.
  // Held in a ref so the question is answered against the latest navigation
  // rather than against whatever render a callback was written in.
  const navToken = useRef(0);
  const current = (token) => token === navToken.current;

  const ensure = useCallback(async (v, token) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadVolume(v);
      return current(token) ? data : null;
    } catch (e) {
      if (current(token)) setError("Couldn't load this volume. Check your connection and try again.");
      return null;
    } finally {
      // A stale request must not report the newer one's loading as over.
      if (current(token)) setLoading(false);
    }
  }, []);

  const openVolume = useCallback(async (v) => {
    rememberScroll();
    const token = ++navToken.current;
    setProphet(null);
    setSection(null);
    setFocus(null);
    setVolId(v.id);
    setBooks(getCached(v.id));
    setBookIdx(null);
    setChapIdx(null);
    setTargetVerse(null);
    setFlipDir(0);
    const data = await ensure(v, token);
    if (!data) return;
    setBooks(data);
    if (v.id === "dc") setBookIdx(0);
  }, [ensure, rememberScroll]);

  const goTo = useCallback(async (s) => {
    rememberScroll();
    const token = ++navToken.current;
    setQuery(null);
    setProphet(null);
    setSection(null);
    setFocus(null);
    const vol = VOLUMES.find((x) => x.id === s.v);
    if (!vol) return;
    setFlipDir(0);
    setVolId(vol.id);

    // Where in the volume the reference lands. Set in the same breath as the
    // volume rather than after the await: a book and a chapter are places in a
    // list, and left over from the volume before they name whatever happens to
    // stand at those places in this one — which renders as a chapter the reader
    // never asked for, in the moment before the right one arrives.
    const place = (data) => {
      const bi = data ? (s.v === "dc" ? 0 : data.findIndex((b) => b.name === s.book)) : -1;
      setBookIdx(bi < 0 ? null : bi);
      const ci = s.ch != null && bi >= 0 ? data[bi].chapters.findIndex((c) => c.n === s.ch) : -1;
      setChapIdx(ci < 0 ? null : ci);
      // A reference that names a run marks the run; one that names a verse,
      // or a search hit, marks the one it landed on.
      markVerses(ci < 0 ? null : (s.verses?.length ? s.verses : s.verse || null));
    };

    const cached = getCached(vol.id);
    setBooks(cached);
    place(cached);
    // Already here: nothing to wait for, and nothing to clear but the last
    // failure, which `ensure` would have cleared on its way past.
    if (cached) { setError(null); return; }
    const data = await ensure(vol, token);
    if (!data) return;
    setBooks(data);
    place(data);
  }, [ensure, rememberScroll]);

  // A written page of the site's own — a chart, an evidence — opened straight
  // from the search field rather than off the shelf it belongs to. It stands
  // inside its volume the same way one opened off that shelf does, so the
  // volume is put under it here too.
  const openArticle = useCallback(async (a) => {
    rememberScroll();
    const token = ++navToken.current;
    setQuery(null);
    setFind(null);
    setProphet(null);
    setFlipDir(0);
    setTargetVerse(null);
    setChapIdx(null);
    setFocus(null);
    const vol = VOLUMES.find((v) => v.id === a.volId);
    if (!vol) return;
    setVolId(vol.id);
    setBooks(getCached(vol.id));
    setBookIdx(vol.id === "dc" ? 0 : null);
    setSection(a.section);
    window.scrollTo({ top: 0 });
    const data = await ensure(vol, token);
    if (data) setBooks(data);
  }, [ensure, rememberScroll]);

  // ---- The URL -----------------------------------------------------------
  // Where the reader stands, written into the hash — #bofm/alma/34,
  // #bofm/evidences/hebraisms — so back, forward, refresh and a copied link
  // all mean what they mean everywhere else on the web. The hash is derived
  // from the same state everything above sets; nothing navigates "through" the
  // URL except the browser's own back and forward, which are replayed into
  // that state below.
  const HASH_SECTIONS = ["timeline", "overview", "map", "coming-forth", "resources", "evidences", "charts"];
  const hashSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // The one hash this state spells. Books are named, chapters numbered; the
  // D&C skips the book, its sections being its front door.
  const hashOf = () => {
    // A search is a place, not a state of the chapter underneath it. Written
    // into the hash it can be linked and refreshed, and — the point — stepped
    // out of backwards, which is how every reader expects to leave one. The
    // chapter it was run from is left standing in the state below, so nothing
    // has to be re-fetched when the step back lands.
    if (query) return `#search/${encodeURIComponent(query)}`;
    if (!volId) return "#/";
    const h = `#${volId}`;
    if (prophet != null) return prophet ? `${h}/prophets/${hashSlug(prophet)}` : `${h}/prophets`;
    if (section) return `${h}/${section}`;
    let out = h;
    if (bookIdx != null && books?.[bookIdx]) {
      if (volId !== "dc") out += `/${hashSlug(books[bookIdx].name)}`;
      const ch = chapIdx != null && books[bookIdx].chapters[chapIdx];
      if (ch) out += `/${ch.n}`;
    }
    return out;
  };

  // ---- The title ---------------------------------------------------------
  // What the tab says, and with it the bookmark, the browser's history and the
  // card a phone's share sheet offers — all of which read document.title. One
  // title for the whole site left every one of those saying "Gazelem" and
  // nothing else, so a reader with four chapters open could tell none of them
  // apart.
  //
  // Most particular first, because a tab shows only its opening characters: the
  // chapter, then where it sits, then the site.
  const SHELF_NAMES = {
    timeline: "Timeline", overview: "Chapter Overview", map: "Map",
    "coming-forth": "Coming Forth", resources: "Study Resources",
    evidences: "Evidences", charts: "Charts",
  };

  const titleOf = () => {
    const site = "Gazelem";
    if (query) return `Search: ${query} · ${site}`;
    if (!volume) return site;
    // A shelved page is named by its file; a shelf, by the site.
    const named = section && (pageTitle(section) || SHELF_NAMES[section]);
    if (prophet) return `${prophet} · Prophets · ${volume.title} · ${site}`;
    if (prophet === "") return `Prophets · ${volume.title} · ${site}`;
    if (named) return `${named} · ${volume.title} · ${site}`;
    // The reference names its own book, so the volume would only repeat it.
    if (chapter) return `${chapter.reference} · ${site}`;
    if (book && volId !== "dc") return `${book.name} · ${site}`;
    return `${volume.title} · ${site}`;
  };

  useEffect(() => { document.title = titleOf(); });

  // What to call where the reader is standing, in the fewest words that still
  // name it. Two things read it: the Back button, which is labelled with what
  // it returns to rather than with the word "back", and the stamp every
  // history entry carries of the view it was reached from.
  const viewLabel = () => {
    if (query) return `“${query}”`;
    if (!volume) return "All scriptures";
    if (prophet) return prophet;
    if (prophet === "") return "Prophets";
    if (section) return pageTitle(section) || SHELF_NAMES[section] || section;
    if (chapter) return chapter.reference;
    if (book && volId !== "dc") return book.name;
    return VOL_SHORT[volId] || volume.title;
  };

  // A hash, replayed into the state that spells it. Async for the same reason
  // goTo is: the books have to be there before a name can be found among them.
  // The flag holds the state→URL write below off for the whole replay: the
  // replay passes through commits that spell the wrong hash, and writing those
  // would put entries the reader never stood at into the history.
  const applyingHash = useRef(false);
  const applyHash = useCallback(async (raw) => {
    applyingHash.current = true;
    try {
      await replayHash(raw);
    } finally {
      applyingHash.current = false;
    }
  }, []); // eslint-disable-line -- replayHash is stable across renders in all but identity

  const replayHash = useCallback(async (raw) => {
    setFocus(null);
    const token = ++navToken.current;
    const parts = raw.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    // A search stands over whatever the reader was reading, and stepping back
    // into one leaves that untouched: the chapter is still there underneath,
    // and is what the next step back returns to.
    if (parts[0] === "search") { setQuery(parts[1] || ""); return; }
    setQuery(null);
    const vol = VOLUMES.find((v) => v.id === parts[0]);
    if (!vol) {
      setVolId(null); setBooks(null); setBookIdx(null); setChapIdx(null);
      setProphet(null); setSection(null); setTargetVerse(null); setFlipDir(0);
      return;
    }
    const head = parts[1];
    if (!head) { openVolume(vol); return; }
    if (head === "prophets" || HASH_SECTIONS.includes(head)) {
      setVolId(vol.id); setBooks(getCached(vol.id));
      setBookIdx(vol.id === "dc" ? 0 : null); setChapIdx(null);
      setTargetVerse(null); setFlipDir(0);
      if (head === "prophets") {
        setSection(null);
        // An unknown name falls back to the shelf of them.
        setProphet(parts[2] ? prophetNames(vol).find((n) => hashSlug(n) === parts[2]) ?? "" : "");
      } else {
        setProphet(null);
        // The two shelves — the evidences and the charts — hold pages of their
        // own, so a third part of the hash names one. An unknown slug falls
        // back to the shelf it was asked for.
        const onShelf = parts[2] && (
          (head === "evidences" && (evidenceExists(parts[2]) || essayExists(parts[2]))) ||
          (head === "charts" && chartExists(parts[2]))
        );
        setSection(onShelf ? `${head}/${parts[2]}` : head);
      }
      window.scrollTo({ top: 0 });
      ensure(vol, token).then((data) => data && setBooks(data));
      return;
    }
    // A book, or in the D&C a section number.
    setProphet(null); setSection(null); setFlipDir(0);
    setVolId(vol.id); setBooks(getCached(vol.id));
    setBookIdx(vol.id === "dc" ? 0 : null); setChapIdx(null);
    const data = await ensure(vol, token);
    if (!data) return;
    setBooks(data);
    const [bi, chRaw] = vol.id === "dc" ? [0, head] : [data.findIndex((b) => hashSlug(b.name) === head), parts[2]];
    setBookIdx(bi < 0 ? null : bi);
    const n = Number(chRaw);
    const ci = bi >= 0 && Number.isFinite(n) ? data[bi].chapters.findIndex((c) => c.n === n) : -1;
    setChapIdx(ci < 0 ? null : ci);
    setTargetVerse(null);
  }, [ensure, openVolume]);

  // Putting a page back where it was left. A results list re-queries its index
  // and a chart fetches itself, so the page a step back lands on is usually
  // still filling and too short to hold the offset — the browser clamps what it
  // cannot reach, and one attempt lands at the top every time, which is the
  // whole reason a step back used to feel like a fresh arrival. So it is asked
  // again each frame until the document is tall enough, and given up on after
  // half a second or the moment the reader takes the scroll into their own
  // hands, whichever is first.
  const restoreScroll = useCallback((top) => {
    if (!top) return;
    let tries = 0, stop = false;
    const done = () => {
      stop = true;
      for (const ev of ["wheel", "touchstart", "keydown"]) window.removeEventListener(ev, done);
    };
    for (const ev of ["wheel", "touchstart", "keydown"]) window.addEventListener(ev, done, { once: true, passive: true });
    const again = () => {
      if (stop) return;
      window.scrollTo({ top });
      if (window.scrollY >= top - 1 || ++tries > 32) { done(); return; }
      requestAnimationFrame(again);
    };
    requestAnimationFrame(again);
  }, []);

  // URL → state, and it comes first. On the very first pass the state is still
  // empty, which spells "#/" — so the write below, running before anything had
  // read the bar, replaced the hash the reader arrived on with the library's
  // and then found nothing left to open. Reading first sets `applyingHash`,
  // which holds the write off for the whole replay; `readHash` says the reading
  // has happened at all, so the two cannot be put back in the wrong order
  // without the write noticing.
  const readHash = useRef(false);
  useEffect(() => {
    readHash.current = true;
    if (location.hash && location.hash !== "#/") applyHash(location.hash);
    // The entry being landed on carries both of the things a step back needs:
    // the view it was itself reached from, and how far down it the reader had
    // read. Neither can be worked out from the hash, and both are gone if the
    // entry is not asked.
    const onPop = (e) => {
      setFrom(e.state?.from ?? null);
      applyHash(location.hash).then(() => restoreScroll(e.state?.scrollY));
    };
    // A hash the reader typed, or followed in from outside. Our own writes go
    // through pushState and replaceState, neither of which fires this, so
    // anything arriving here came from off the page — and had to be answered,
    // because the effect below compares the bar against the state and would
    // otherwise quietly put the old address back over the one just asked for.
    const onHash = () => {
      if (applyingHash.current) return;
      setFrom(null);
      applyHash(location.hash);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHash);
    };
  }, [applyHash, restoreScroll]);

  // State → URL. Held while a volume loads: an async navigation passes through
  // states that spell the wrong hash, and pushing those would write junk into
  // the history. When the browser's own back or forward set this state, the
  // landing hash equals the bar's and nothing is pushed. The first write
  // replaces rather than pushes, so opening the site is one entry, not two.
  //
  // Each push stamps the entry it creates with the view being left behind.
  // That stamp is the whole of the Back button: there is no second history to
  // keep in step, and nothing can navigate without writing it.
  const firstHashSync = useRef(true);
  // The view on screen, as the next push will name it.
  const here = useRef(null);
  useEffect(() => {
    if (!readHash.current || applyingHash.current || loading) return;
    if (bookIdx != null && !books?.[bookIdx]) return;
    const h = hashOf();
    const label = viewLabel();
    // Already standing on it. The name is refreshed rather than left as it was
    // when the entry was pushed: a volume still fetching spells its hash before
    // it can name the chapter in it, and the name is what the next push stamps.
    if (location.hash === h) { here.current = { label, hash: h }; firstHashSync.current = false; return; }
    const stamp = firstHashSync.current ? null : here.current;
    if (firstHashSync.current) window.history.replaceState({ from: null }, "", h);
    else window.history.pushState({ from: stamp }, "", h);
    setFrom(stamp);
    here.current = { label, hash: h };
    firstHashSync.current = false;
  }); // eslint-disable-line -- compares against location.hash, its own dep

  // What was being looked for on one page has no bearing on the next.
  useEffect(() => { setFind(null); }, [volId, bookIdx, chapIdx]);

  // Bringing a targeted verse into view, and taking the mark off it again after
  // a moment. Keyed by the target as well as the chapter: a reference into the
  // chapter already open changes nothing else, and keyed by the chapter alone
  // it neither scrolled to the verse nor ever let the highlight go.
  const scrolledFor = useRef(null);
  useEffect(() => {
    if (!chapter || targetVerse == null) return;
    // A sidebar entry glides to its own verse as it is pressed, so there is
    // nothing left here but the mark and the clearing of it.
    const already = scrolledFor.current === targetVerse;
    scrolledFor.current = null;
    // The first of them is what is brought into view: a run reads downward, and
    // its opening verse is where the reader starts.
    const t = already ? null : setTimeout(() => {
      document.getElementById(`verse-${targetVerse[0]}`)?.scrollIntoView({ block: "center", behavior: "auto" });
    }, 60);
    const clear = setTimeout(() => setTargetVerse(null), 3200);
    return () => { if (t) clearTimeout(t); clearTimeout(clear); };
  }, [chapterKey, targetVerse]); // eslint-disable-line

  // Landing in a chapter with no verse asked for: where the reader left it.
  // Deliberately not watching `targetVerse` — it falls back to null on its own
  // three seconds after a reference lands, and watching it would read that as a
  // fresh arrival and haul the reader away from the verse they were sent to.
  useEffect(() => {
    if (targetVerse != null) return;
    window.scrollTo({ top: chapterKey ? scrollPos.current.get(chapterKey) ?? 0 : 0 });
  }, [volId, bookIdx, chapIdx]); // eslint-disable-line

  // Where a step in this direction lands, or null at the ends of the volume.
  // Asked by step() to go there, and by the drag to show what is coming.
  const neighbour = useCallback((dir) => {
    if (!books || bookIdx == null || chapIdx == null) return null;
    let b = bookIdx, c = chapIdx + dir;
    if (c < 0) {
      if (b === 0) return null;
      b -= 1; c = books[b].chapters.length - 1;
    } else if (c >= books[b].chapters.length) {
      if (b === books.length - 1) return null;
      b += 1; c = 0;
    }
    return { book: books[b], chapter: books[b].chapters[c], bookIdx: b, chapIdx: c };
  }, [books, bookIdx, chapIdx]);

  const step = (dir) => {
    const to = neighbour(dir);
    if (!to) return;
    rememberScroll();
    setTargetVerse(null);
    setFlipDir(dir);
    setBookIdx(to.bookIdx);
    setChapIdx(to.chapIdx);
  };

  // The gold runs in the text and the letters in their margin mirror the Cross
  // Connections list, so like that list they stand whichever world the
  // commentary is being read through. They used to go with the Text world, and
  // a reader who moved the lens to Behind — from a sheet, on a phone, with the
  // control then hidden behind it — watched the chapter itself lose its marks
  // for no reason they could see.
  // Fetched when the chapter is opened, so the marks appear a moment after the
  // text rather than the whole corpus arriving before either.
  const { notes: chapterNotes } = useCommentary(
    chapter ? (volId === "dc" ? "Doctrine and Covenants" : book?.name) : null,
    chapter?.n ?? null,
  );
  const verseConnections = chapter ? connectionsByVerse(chapterNotes, chapter.n) : null;
  // The notes' `underline:` anchors are still parsed (see underlinesByVerse in
  // lib/commentary.js) but nothing draws them for now.

  // What the site has written about the chapter on screen. The D&C's single
  // book is called Sections in the data, while anything citing it writes the
  // volume's name.
  const bookName = volId === "dc" ? "Doctrine and Covenants" : book?.name;
  const study = chapter ? marginMentions(bookName, chapter.n) : null;
  // The same pages as a flat list, for the Related card beside the reader.
  const studyList = chapter ? mentionsOf(bookName, chapter.n) : [];

  // Follow a cross reference. Where we stood is remembered by the push itself
  // — see the hash effect — so there is nothing to record here.
  const openReference = useCallback(async (cite) => {
    rememberScroll();
    await goTo({
      v: cite.book.v,
      book: cite.book.n,
      ch: cite.chapter,
      verses: cite.verses,
    });
  }, [goTo, rememberScroll]);

  // One step back, through the browser's own history — the same thing the
  // hardware button, the trackpad swipe and ⌘[ do. There is nothing else to
  // undo: the entry being returned to carries its own scroll and its own
  // stamp, and the popstate listener above applies both.
  const goBack = useCallback(() => window.history.back(), []);

  // The chapter last read, kept as the reader leaves it for a chart or an
  // essay. Not a step in any history — a fixed place to come home to, however
  // far the wandering went.
  useEffect(() => {
    if (chapter && chapterKey) setAnchor({ label: chapter.reference, volId, bookIdx, chapIdx });
  }, [chapterKey]); // eslint-disable-line -- the chapter is the whole of the key

  const goReading = useCallback(() => {
    if (!anchor) return;
    rememberScroll();
    setQuery(null); setProphet(null); setSection(null); setFocus(null);
    setVolId(anchor.volId);
    setBooks(getCached(anchor.volId));
    setBookIdx(anchor.bookIdx);
    setChapIdx(anchor.chapIdx);
    setTargetVerse(null);
    setFlipDir(0);
  }, [anchor, rememberScroll]);

  // Leaving a results list is a step back, not a fresh navigation — the list
  // is an entry of its own now, and setting the query to null would push the
  // chapter underneath on top of it as a second copy.
  const closeSearch = useCallback(() => {
    if (window.history.state?.from) window.history.back();
    else setQuery(null);
  }, []);

  // Jump to any chapter of the volume from the chapter band, including one in
  // a neighbouring book. Pages in the direction of travel, like the nav arrows.
  const openChapterAt = useCallback((bi, n) => {
    if (!books?.[bi]) return;
    const ci = books[bi].chapters.findIndex((c) => c.n === n);
    if (ci < 0 || (bi === bookIdx && ci === chapIdx)) return;
    rememberScroll();
    setFlipDir(bi === bookIdx ? (ci > chapIdx ? 1 : -1) : (bi > bookIdx ? 1 : -1));
    setTargetVerse(null);
    setBookIdx(bi);
    setChapIdx(ci);
  }, [books, bookIdx, chapIdx, rememberScroll]);

  // Open a search result at the verse the search landed on. The list is a
  // history entry of its own, so Back returns to it rather than to wherever
  // the reader was standing when they ran it.
  const openHit = useCallback((row) => {
    goTo({ v: row.volId, book: row.book, ch: row.n, verse: row.firstVerse });
  }, [goTo]);

  // Follow an entry in the similar-chapters chart. It goes through the same
  // path as a cross reference, so the Back button can undo it.
  const openRelated = useCallback((label) => {
    const cite = parseCitations(label)[0];
    if (cite) openReference(cite);
  }, [openReference]);

  // A study page opened from the chapter it treats.
  const openStudyPage = useCallback((page) => {
    rememberScroll();
    const token = ++navToken.current;
    setQuery(null);
    setFind(null);
    setProphet(null);
    setFlipDir(0);
    setChapIdx(null);
    const vol = VOLUMES.find((x) => x.id === page.volId);
    if (!vol) return;
    // What the page is being opened *for*: the passage the reader was standing
    // in. The page reads this to unfold the part that treats it and bring that
    // part into view, rather than opening at the top and leaving the reader to
    // hunt for the row they were promised.
    setFocus({ book: bookName, chapter: chapter?.n ?? null });
    setVolId(vol.id);
    setBooks(getCached(vol.id));
    setBookIdx(vol.id === "dc" ? 0 : null);
    setTargetVerse(null);
    setSection(page.section);
    window.scrollTo({ top: 0 });
    ensure(vol, token).then((data) => data && setBooks(data));
  }, [ensure, rememberScroll, bookName, chapter]);

  // All the way out, to the shelf of volumes.
  const goLibrary = useCallback(() => {
    rememberScroll();
    setQuery(null); setProphet(null); setSection(null); setFocus(null);
    setVolId(null); setBooks(null); setBookIdx(null); setChapIdx(null); setTargetVerse(null);
  }, [rememberScroll]);

  // Try the volume again after a failed fetch, keeping the reader where they
  // asked to be — the section they were opening, or the book list they were
  // waiting on — rather than putting them back at the volume's front door.
  const retryLoad = useCallback(() => {
    if (!volume) return;
    const token = ++navToken.current;
    ensure(volume, token).then((data) => {
      if (!data || !current(token)) return;
      setBooks(data);
      if (volume.id === "dc" && bookIdx == null) setBookIdx(0);
    });
  }, [ensure, volume, bookIdx]);

  // Scroll the reader to a verse (from a sidebar entry). The glide is this
  // one's own — the verse is already on the page, and a jump would be a worse
  // way to reach it than the eye travelling there. The mark, and the taking of
  // it off again, belong to the effect above like every other target's.
  const jumpToVerse = useCallback((v) => {
    const marks = [].concat(v);
    document.getElementById(`verse-${marks[0]}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    scrolledFor.current = marks;
    setTargetVerse(marks);
  }, []);

  // Keep the notes column beside whatever the reader is showing: find the verse
  // nearest the top of the viewport, then bring its entry into view.
  useEffect(() => {
    if (!chapter) return;
    // Debounced rather than per-frame: the column scrolls smoothly (CSS
    // scroll-behavior), and re-targeting it every frame would stall the glide.
    let timer = 0;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const verses = document.querySelectorAll('[id^="verse-"]');
        let top = null;
        for (const el of verses) {
          if (el.getBoundingClientRect().bottom > 120) { top = el.id.slice(6); break; }
        }
        if (!top) return;
        // The column tracking the reader is whichever one this width scrolls on
        // its own. Narrow, the panels ride in the page's own scroll, so there is
        // nothing to nudge and the reader stays in charge of it.
        const col = [".commentary-col", ".side-extras"]
          .map((sel) => document.querySelector(sel))
          .find((el) => el && el.scrollHeight > el.clientHeight + 1);
        if (!col) return;
        // The column follows the notes themselves — never the footnote
        // list. Levels without verse-anchored notes (chapter, block) read as
        // essays, so the column stays where the reader left it.
        //
        // The last note in DOM order that the reader has reached, rather than
        // the highest verse number: the In Front and Behind worlds run several
        // cards whose verse sequences restart (Applications 18–29, then
        // Self-reflection 31–40), and picking the maximum jumps between them.
        // Reading order is what the eye expects the column to track.
        const notes = col.querySelectorAll("[data-note-verse]");
        if (!notes.length) return;
        let match = null;
        for (const el of notes) {
          if (Number(el.getAttribute("data-note-verse")) <= Number(top)) match = el;
        }
        if (!match) match = notes[0];
        // Only nudge the column; never yank it while the pointer is inside.
        if (col.matches(":hover")) return;
        const cr = col.getBoundingClientRect();
        const mr = match.getBoundingClientRect();
        col.scrollTop += mr.top - cr.top - 90;
      }, 120);
    };
    window.addEventListener("scroll", sync, { passive: true });
    sync();
    return () => { window.removeEventListener("scroll", sync); clearTimeout(timer); };
  }, [chapter, lens.world, lens.level]);

  const atStart = bookIdx === 0 && chapIdx === 0;
  const atEnd = books && bookIdx === books.length - 1 && book && chapIdx === book.chapters.length - 1;

  // Swiping across the page turns the chapter, the way the ‹ › arrows do — and
  // the chapter slides in from the side the swipe came from, so the gesture and
  // the animation agree. Bound only while a chapter is open.
  // The chapter travels with the finger, so the gesture needs the element as
  // well as the outcome — and needs to know, while it is underway, whether
  // there is a chapter that way to pull toward.
  const pageRef = useRef(null);
  const canGo = useCallback((dir) => (dir > 0 ? !atEnd : !atStart), [atEnd, atStart]);
  // The chapters either side are only worth rendering while a drag can show
  // them, so the gesture says when it starts and when it stops.
  const [dragging, setDragging] = useState(false);
  useHorizontalSwipe((dir) => {
    if (canGo(dir)) step(dir);
  }, !!chapter && !query, { target: pageRef, canGo, onDrag: setDragging });

  // Narrow, the study panels are markers in the top corners rather than a
  // column, and pressing one opens it over the page. Which panel that is lives
  // here; the corners and the sheet are styles.css's, so the same markup can be
  // a column again as soon as there is room for one. See StudyDock.
  const [sheet, setSheet] = useState(null);
  // Both docks answer to this: the markers at the top and the pill at the foot
  // are one set of controls, and they come and go together.
  const controlsHidden = useHideOnScrollDown();
  const panelsRef = useRef(null);
  const filled = useFilledPanels(panelsRef, [chapter, lens, volId, bookIdx, chapIdx]);
  const closeSheet = useCallback(() => setSheet(null), []);
  useSheetDismissal(sheet, closeSheet);

  // A sheet is about the chapter under it, so it does not survive leaving that
  // chapter — nor a panel emptying out from under it as the next one loads.
  useEffect(() => {
    if (sheet && !filled.has(sheet)) setSheet(null);
  }, [sheet, filled]);
  // Anything that takes the reader off the chapter closes the sheet with it —
  // a section or a prophet's page opened from inside one included, which is how
  // the overview's links leave. The sheet holds the page's scroll while it is
  // open, so one left standing behind a map would lock it.
  useEffect(() => { setSheet(null); }, [chapter, query, section, prophet]);

  // One level up the hierarchy, mirroring the breadcrumbs. Returns false at the
  // top so the caller can leave the key alone.
  const goUp = () => {
    rememberScroll();
    // The volume's own pages stand over its books rather than inside them, so
    // they are stepped out of before anything under them is — and left set
    // while the volume beneath was cleared, they went on rendering against a
    // volume that was no longer there.
    if (prophet) { setProphet(""); setFocus(null); return true; }
    // A page shelved under a section — one evidence, one chart — steps back to
    // the shelf it stands on before the shelf steps back to the volume.
    if (section?.includes("/")) { setSection(section.split("/")[0]); setFocus(null); return true; }
    if (prophet != null || section != null) {
      setProphet(null); setSection(null); setFocus(null);
      return true;
    }
    if (chapter) { setChapIdx(null); setTargetVerse(null); return true; }
    // The D&C has no book list — its sections are the only level — so from the
    // section grid the step up is straight out to the volumes.
    if (book && volId !== "dc") { setBookIdx(null); setChapIdx(null); return true; }
    if (volume) {
      setVolId(null); setBooks(null); setBookIdx(null); setChapIdx(null); setTargetVerse(null);
      return true;
    }
    return false;
  };

  // Arrow keys: ← / → page through chapters, ↑ goes back a level. No dependency
  // array — the handler closes over this render's state, so re-binding each
  // render keeps it current.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target;
      // Never steal a key from the search field or any other text entry.
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      // The results list is what the arrows would be paging past, so while one
      // is up they belong to it, not to the chapter underneath.
      if (query) return;
      if (e.key === "ArrowLeft" && chapter && !atStart) { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight" && chapter && !atEnd) { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") {
        // Scrolling comes first: ↑ only steps back out once the page is already
        // at the top, so the key still works its way up through a long chapter.
        if (window.scrollY > 0) return;
        if (goUp()) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The bottom pill's trail: every level above the one on screen, so it reads
  // library · volume · book while reading and shrinks as you climb. A level
  // that IS the current view is left out — its button would go nowhere.
  // Any step in the trail is a place in the library, so taking one puts a
  // results list away.
  const trail = [];
  if (query) {
    // A word search is asked of the standard works, not of the volume the
    // reader happened to be standing in when they ran it, so the library is
    // the whole of its trail. The chapter underneath is not above it in any
    // hierarchy — it is behind it, which is Back's business, not the trail's.
    trail.push({ icon: true, label: "All scriptures", onClick: goLibrary });
  } else if (volume) {
    trail.push({ icon: true, label: "All scriptures", onClick: goLibrary });
    if (chapter || prophet != null || section != null || (book && volId !== "dc")) {
      trail.push({
        label: VOL_SHORT[volId] || volume.title,
        onClick: () => { rememberScroll(); setQuery(null); setProphet(null); setSection(null); setBookIdx(volId === "dc" ? 0 : null); setChapIdx(null); setTargetVerse(null); },
      });
    }
    // Reading one prophet, the step back is the shelf of them.
    if (prophet) {
      trail.push({ label: "Prophets", onClick: () => { rememberScroll(); setProphet(""); } });
    }
    // A page off a shelf — one chart, one evidence — names the shelf it stands
    // on, exactly as a chapter names its book. Without this a chart was the one
    // page on the site whose trail skipped a level: ⌂ › BoM, and no Charts.
    if (section?.includes("/")) {
      const shelf = section.split("/")[0];
      trail.push({
        label: SHELF_NAMES[shelf] || shelf,
        onClick: () => { rememberScroll(); setFocus(null); setSection(shelf); window.scrollTo({ top: 0 }); },
      });
    }
    // The book's own step: back to its chapters, from a chapter or from its arc.
    if (book && volId !== "dc" && chapter) {
      trail.push({
        label: book.name,
        onClick: () => { rememberScroll(); setQuery(null); setSection(null); setChapIdx(null); setTargetVerse(null); },
      });
    }
  }

  // ---- The two controls, and the one rule ---------------------------------
  // The trail says where you are; Back says how you got here. Both stand in
  // the bottom pill, on every kind of page.
  //
  // Back is labelled with what it returns to, never with the bare word "back":
  // a control that will not say where it goes is one the reader has to gamble
  // on. Where the name it would carry is already the last step of the trail —
  // which is every plain walk down the hierarchy — the trail is that way back
  // and Back would only be the same word twice, so it stands down.
  const lastCrumb = trail.length ? trail[trail.length - 1].label : null;
  const back = from && from.label !== lastCrumb ? { label: from.label, onClick: goBack } : null;
  // And the way home. Off the text, with a chapter to return to that neither
  // of the two above is already offering: one press, however many hops deep
  // into the charts the reader has gone.
  const resume = anchor && (!chapter || query) &&
    anchor.label !== back?.label && anchor.label !== lastCrumb
    ? { label: anchor.label, onClick: goReading } : null;

  // The field keeps to the side column only while a chapter is being read,
  // where the reader's own width is the thing worth protecting. Everywhere
  // else it stands in the middle of the page, under whatever titles it.
  const home = !(chapter && !query && prophet == null && section == null);
  // Neither a search nor one of the volume's own sections is over the reader.
  const reading = !query && prophet == null && section == null;
  // The contents card stands where the page has left a margin free: a volume
  // is open, and nothing is holding the side columns. Whether the margin is
  // actually wide enough is a question about the window, so styles.css has the
  // last word — this only says there is something worth putting there.
  const showContents = !!volume && !!books && home && !query;

  // The ways into a volume that are not its books, offered wherever its books
  // are — or, in the D&C, wherever its sections are. Each renders itself away
  // when the volume has nothing of that kind written for it.
  // A volume's sections are alternatives to one another, so opening one closes
  // whatever else was over the reader — the prophets included, which are held
  // separately and would otherwise stay on screen underneath.
  const open = (what) => {
    rememberScroll();
    setProphet(null);
    setFocus(null);
    setPlace(null);
    setSection(what);
    window.scrollTo({ top: 0 });
  };

  // The overview names a speaker and a place. Where the volume has a page about
  // that person, or a point on its map for that place, the name is the way
  // there — asked of the manifest, so neither page is fetched to find out.
  // A name the site has nothing to show for stays plain text.
  const openFor = {
    speakers: (name) => {
      const found = prophetNamed(volume, name);
      if (!found) return null;
      return {
        title: `Read about ${found}`,
        onClick: () => {
          rememberScroll();
          setSection(null);
          setFocus(null);
          setPlace(null);
          setProphet(found);
          window.scrollTo({ top: 0 });
        },
      };
    },
    location: (name) => {
      const found = placeNamed(volume, name);
      if (!found) return null;
      return {
        title: `Find ${found.name} on the map`,
        // The section is opened the ordinary way and told where to go; the map
        // reads `place` once, on arrival, and is the reader's after that.
        onClick: () => { open("map"); setPlace(found.id); },
      };
    },
  };
  // Described once, as data, because two things are built from it: the tiles
  // shelved beside the volume's books, and the rows in the contents card.
  const sectionDefs = [
    hasTimeline(volId, books) && {
      id: "timeline", name: "Timeline", icon: TimelineIcon,
      on: section === "timeline", onClick: () => open("timeline"),
    },
    hasProphets(volume) && {
      id: "prophets", name: "Prophets", icon: ProphetsIcon,
      on: prophet != null,
      onClick: () => { rememberScroll(); setProphet(""); setSection(null); window.scrollTo({ top: 0 }); },
    },
    // What kind of chapter each chapter is, over the whole volume at once —
    // the timeline's question asked of the text rather than of the story.
    hasCategories(volume) && {
      id: "overview", name: "Chapter Overview", icon: OverviewIcon,
      on: section === "overview", onClick: () => open("overview"),
    },
    // The map is drawn from the Book of Mormon's own geography.
    volId === "bofm" && {
      id: "map", name: "Map", icon: MapIcon,
      on: section === "map", onClick: () => open("map"),
    },
    // How the volume itself reached the reader, as against what happens inside
    // it — which is what the timeline above answers.
    hasComingForth(volume) && {
      id: "coming-forth", name: "Coming Forth", icon: ComingForthIcon,
      on: section === "coming-forth", onClick: () => open("coming-forth"),
    },
    // What the book carries in itself that is easier to account for if it is
    // what it says it is. A shelf rather than one page: each evidence is its
    // own study, and there will be more of them than Hebraisms.
    hasEvidences(volume) && {
      id: "evidences", name: "Evidences", icon: EvidencesIcon,
      on: section?.startsWith("evidences") || undefined,
      onClick: () => open("evidences"),
    },
    // The study charts written for this volume — a shelf rather than one
    // page, as the evidences are: each is its own table, and there are more of
    // them than a row of tiles could carry one apiece.
    hasCharts(volume) && {
      id: "charts", name: "Charts", icon: ChartsIcon,
      on: section?.startsWith("charts") || undefined,
      onClick: () => open("charts"),
    },
    // What has been written about the volume, which is the one door on this
    // shelf that leads off the site.
    hasResources(volume) && {
      id: "resources", name: "Study Resources", icon: ResourcesIcon,
      on: section === "resources", onClick: () => open("resources"),
    },
  ].filter(Boolean);

  const volumeSections = sectionDefs.map((s, i) => (
    <SectionTile key={s.id} icon={s.icon} name={s.name} onClick={s.onClick} delay={180 + i * 9} />
  ));

  // Written once and placed in one of two spots. Only ever mounted in one of
  // them, so the "type anywhere" listener it installs is never doubled up.
  const searchField = (
    <SearchBox
      onNavigate={goTo}
      onSearch={(q) => { rememberScroll(); setFind(null); setQuery(q); window.scrollTo({ top: 0 }); }}
      onFind={setFind}
      onOpenArticle={openArticle}
      // On the home screen the field is already on show, so there is nothing
      // to ask to be opened.
      onRequestOpen={home ? undefined : openSearch}
      onDismiss={() => setSearchOpen(false)}
      focusKey={focusKey}
      // Only a chapter is a page to find things on. The connections come with
      // it because they break the verse into the runs the marks are drawn in,
      // and what is counted has to be what can be marked.
      page={chapter && !query ? { label: chapter.reference, verses: chapter.verses, connections: verseConnections } : null}
    />
  );

  const inlineSearch = home ? <div className="inline-search">{searchField}</div> : null;

  // The lens controls, which now stand at the head of the commentary they
  // govern rather than in a card of their own — see LensBody.
  const lensBody = <LensBody lens={lens} setLens={setLens} chapter={chapter} />;

  // Narrow, the field itself is too wide to stand anywhere while a chapter is
  // being read, so it waits in the dock as the glyph alone and opens the real
  // one at the foot of the window. Standing in the dock rather than floating
  // over it is what keeps it on the pill's line — see the .navdock rules.
  const searchButton = (
    <button className="tap dock-search" onClick={openSearch}
      aria-label="Search" aria-expanded={searchOpen}>
      <svg aria-hidden viewBox="0 0 24 24" width="21" height="21" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <line x1="16" y1="16" x2="21" y2="21" />
      </svg>
    </button>
  );

  return (
    <div className={sheet ? "sheet-open" : undefined}
      style={{ minHeight: "100vh", position: "relative", color: ink, background: "linear-gradient(175deg,#f6f7f9 0%,#eef1f5 55%,#eceef3 100%)", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" }}>
      <AmbientGlow />

      {/* Layout lives in styles.css so a media query can turn this bar into a
          left sidebar once the window is wide enough for one. */}
      <header className={`chrome${searchOpen ? " chrome-open" : ""}${home ? " chrome-away" : ""}`}>
        <div className="chrome-inner">
          <div className="searchcard" style={{ ...glass, borderRadius: 18 }}>
            {!home && searchField}
          </div>
        </div>
      </header>

      {/* `content-solo` while nothing is standing in the side columns: with no
          sidebar to balance against, reserving its width would only push the
          page off centre. See styles.css. */}
      {/* The volume laid out in the margin, where there is a margin to lay it
          out in — never beside a chapter, which needs both its columns. */}
      {showContents && (
        <ContentsCard
          volume={volume} volId={volId} books={books} sections={sectionDefs}
          bookIdx={bookIdx} section={section} prophet={prophet}
          onLibrary={goLibrary}
          onVolume={() => { rememberScroll(); setQuery(null); setProphet(null); setSection(null); setBookIdx(volId === "dc" ? 0 : null); setChapIdx(null); setTargetVerse(null); }}
          onBook={(bi) => { rememberScroll(); setQuery(null); setProphet(null); setSection(null); setBookIdx(bi); setChapIdx(null); setTargetVerse(null); window.scrollTo({ top: 0 }); }}
        />
      )}

      <main className={`content${home ? " content-solo" : ""}${showContents ? " content-toc" : ""}`}>
        {/* Only the column is inside the boundary: a panel that throws should
            cost the reader that page and not the bar, the pill and the contents
            card that are how they leave it. Moving clears it — see the key. */}
        <ErrorBoundary
          resetKey={`${volId}:${bookIdx}:${chapIdx}:${section}:${prophet}:${query}`}
          onReset={goLibrary}
        >
        {/* A word search takes the column over while it runs. Deliberately not
            keyed by the query: the same panel carries its filters from one
            search to the next, and back from a chapter opened out of it. */}
        {query && (
          <SearchResults query={query} filters={filters} setFilters={setFilters}
            field={inlineSearch} onSearch={setQuery} onOpen={openHit} onClose={closeSearch} />
        )}

        {/* The volume's own pages carry the field at the head of the column,
            the same way its book and chapter grids do. The margin beside them
            is the contents card's, so there is no side column to keep it in and
            without this the field is nowhere at all on a map or a chart. */}
        {!query && (prophet != null || section != null) && inlineSearch}

        {/* Every one of the volume's own pages is fetched when it is opened, so
            each of them may be a moment arriving. One boundary around the lot
            of them: only ever one is on screen, and the shimmer is the same
            shimmer a volume's books wait behind — a page being fetched and a
            page being loaded look alike to the reader, and should. */}
        <Suspense fallback={<LoadingShimmer />}>

        {/* The prophets stand beside the books of their volume rather than
            inside one, so they take the column the same way a book list does. */}
        {!query && prophet === "" && (
          <ProphetGrid volume={volume} onOpen={(n) => { rememberScroll(); setProphet(n); }} />
        )}
        {!query && prophet && (
          <ProphetPage key={prophet} volume={volume} name={prophet} onOpenRef={openReference} />
        )}

        {/* Handed down bare: the grid puts it in the card itself, and a wrapper
            carrying the same class would apply that class's outer spacing a
            second time, inside the card. */}
        {!query && !volume && <VolumeGrid onOpen={openVolume} search={searchField} />}
        {reading && volume && loading && <LoadingShimmer />}
        {reading && volume && error && !loading && <ErrorCard message={error} onRetry={retryLoad} />}
        {/* The volume's own pages wait on it too — the timeline and the chapter
            overview are drawn from its books — so a fetch still running or
            failed under one of them has to say so here as well, or the column
            simply stands empty with nothing to press. */}
        {!query && section != null && !books && loading && <LoadingShimmer />}
        {!query && section != null && !books && error && !loading && (
          <ErrorCard message={error} onRetry={retryLoad} />
        )}
        {reading && volume && books && bookIdx == null && volId !== "dc" && (
          <BookList volume={volume} books={books} sections={volumeSections} search={inlineSearch}
            onOpen={(i) => { rememberScroll(); setBookIdx(i); setChapIdx(null); }} />
        )}
        {reading && book && chapIdx == null && (
          <ChapterGrid volId={volId} book={book}
            // Only the D&C, whose sections are its front door.
            sections={volId === "dc" ? volumeSections : []} search={inlineSearch}
            onOpen={(i) => { rememberScroll(); setChapIdx(i); setTargetVerse(null); setFlipDir(0); }} />
        )}

        {/* The volume's whole arc. Choosing a stop is choosing a chapter, so it
            leaves by the same door a chapter grid does. */}
        {!query && section === "timeline" && books && (
          <VolumeTimeline volId={volId} volume={volume} books={books}
            onOpen={(bi, ci) => { rememberScroll(); setSection(null); setBookIdx(bi); setChapIdx(ci); setTargetVerse(null); setFlipDir(0); }} />
        )}
        {!query && section === "overview" && books && (
          <VolumeOverview volume={volume} books={books}
            onOpen={(bi, ci) => { rememberScroll(); setSection(null); setBookIdx(bi); setChapIdx(ci); setTargetVerse(null); setFlipDir(0); }} />
        )}
        {!query && section === "map" && <MapView onOpenRef={openReference} place={place} />}
        {/* The shelf, and one evidence off it. Held in the section name rather
            than in a state of its own, so climbing back out is the same move
            as leaving any other section. */}
        {!query && section === "evidences" && (
          <EvidenceGrid volume={volume} onOpen={(slug) => open(`evidences/${slug}`)} />
        )}
        {/* Both kinds of page are shelved under `evidences/`, and which one a
            slug names is settled by which of the two answers to it. */}
        {!query && section?.startsWith("evidences/") && (
          essayExists(section.slice("evidences/".length))
            ? <EssayPage key={section} slug={section.slice("evidences/".length)}
                onOpenRef={openReference} focus={focus} />
            : <EvidencePage key={section} slug={section.slice("evidences/".length)}
                onOpenRef={openReference} focus={focus} />
        )}
        {!query && section === "coming-forth" && (
          <ComingForth volume={volume} onOpenRef={openReference} />
        )}
        {!query && section === "resources" && (
          <Resources volume={volume} onOpenRef={openReference} />
        )}
        {!query && section === "charts" && (
          <ChartGrid volume={volume} onOpen={(slug) => open(`charts/${slug}`)} />
        )}
        {!query && section?.startsWith("charts/") && (
          <ChartPage key={section} volume={volume}
            slug={section.slice("charts/".length)} onOpenRef={openReference} focus={focus} />
        )}

        </Suspense>
        {/* key remounts the article so its entrance animation replays per chapter */}
        {reading && chapter && (
          <Reader key={`${bookIdx}-${chapIdx}`} volId={volId} book={book}
            chapter={chapter} targetVerse={targetVerse} flipDir={flipDir}
            connections={verseConnections} find={find} onOpenRef={openReference}
            study={study} onOpenStudy={openStudyPage} pageRef={pageRef}
            prev={dragging ? neighbour(-1) : null} next={dragging ? neighbour(1) : null} />
        )}

        {/* What frames the chapter: what it is, where it sits, what it
            resembles, and what it points at. It is written into the reading
            flow and lifted out of it — into the left column — once the window
            is wide enough to hold one, so a phone scrolls to the same panels a
            desktop keeps in view. The lens controls and the notes they drive
            move again at the three-column width, to the right. */}
        <aside ref={panelsRef} className="side-extras" aria-label="Study panels"
          hidden={!reading} data-sheet={sheet || undefined}>
          {/* Narrow, the sheet is the whole window and the chapter is behind it,
              so it says which panel this is and how to get back. The column
              never shows either — there the panels are simply in view. */}
          <div className="sheet-bar">
            <span className="sheet-title">{PANELS.find((p) => p.id === sheet)?.title}</span>
            <button className="tap sheet-close" onClick={closeSheet} aria-label="Close panel">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" aria-hidden focusable="false">
                <path d="M3.4 3.4 11.6 11.6M11.6 3.4 3.4 11.6" />
              </svg>
            </button>
          </div>

          <div className="overview-box" data-panel="overview">
            <ChapterOverview book={book} chapter={chapter} volId={volId}
              collapsed={collapsed} onToggle={toggleCard} openFor={openFor} />
          </div>
          {/* Where this chapter sits in the book's arc. Renders itself away
              when the book has no captions written for it. Keyed by book: a
              new book should place its band without gliding there from the
              old book's position. */}
          <div className="timeline-box" data-panel="timeline">
            <ChapterTimeline key={volId} volId={volId} volumeTitle={volume?.title}
              books={books} book={book} chapter={chapter}
              onOpen={openChapterAt} collapsed={collapsed} onToggle={toggleCard} />
          </div>
          {/* Renders nothing unless this chapter is in the chart. */}
          <div className="related-box" data-panel="related">
            <RelatedChapters volId={volId} book={book} chapter={chapter}
              pages={studyList} onOpen={openRelated} onOpenPage={openStudyPage}
              collapsed={collapsed} onToggle={toggleCard} />
          </div>
          <div className="notes-inline" data-panel="notes">
            <CommentaryNotes book={book} chapter={chapter} lens={lens} volId={volId}
              collapsed={collapsed} onToggle={toggleCard} controls={lensBody}
              onOpenRef={openReference} onJump={jumpToVerse} />
          </div>
          {/* Last in the column: the index of what the chapter points at. */}
          <div className="connections-box" data-panel="connections">
            <CrossConnections book={book} chapter={chapter} volId={volId}
              onJump={jumpToVerse} onOpenRef={openReference} collapsed={collapsed} onToggle={toggleCard} />
          </div>
        </aside>
        </ErrorBoundary>
      </main>

      {/* The notes read a chapter, and a results list is not one. */}
      {/* Notes on a chapter, so it goes when there is no chapter. Not merely
          empty: it is a fixed column over the right of the page, and left
          standing it takes the clicks meant for whatever is under it — which
          on a shelf or a study page is real content, not margin. */}
      <aside className="commentary-col" aria-label="Commentary column" hidden={!reading || !chapter}>
        <CommentaryNotes book={book} chapter={chapter} lens={lens} volId={volId}
          collapsed={collapsed} onToggle={toggleCard} controls={lensBody}
          onOpenRef={openReference} onJump={jumpToVerse} />
      </aside>

      {/* Only while a chapter is on screen to find anything in. */}
      {find && chapter && !query && (
        <FindBar query={find} total={countIn(chapter.verses, find)} onClose={() => setFind(null)} />
      )}

      {/* The markers belong to a chapter, so they go when there is none — and
          while a sheet is up, the sheet is the panel and the corners under it
          have nothing left to offer. */}
      {chapter && reading && !sheet && (
        <StudyDock filled={filled} hidden={controlsHidden} onOpen={setSheet} />
      )}

      {(trail.length > 0 || back || resume) && (
        <NavPill trail={trail} chapter={query ? null : chapter} atStart={atStart} atEnd={atEnd}
          onPrev={() => step(-1)} onNext={() => step(1)}
          back={back} resume={resume} search={!home && searchButton}
          /* Only where the markers are also giving way. Wide, the dock is the
             only way through the chapters and never stands over the text. */
          hidden={controlsHidden && !!chapter && !query} />
      )}
    </div>
  );
}
