import { useState, useEffect, useCallback, useRef } from "react";
import { VOLUMES, VOL_SHORT } from "./data/volumes.js";
import { loadVolume, getCached } from "./lib/api.js";
import { glass, ink } from "./theme.js";
import AmbientGlow from "./components/AmbientGlow.jsx";
import SearchBox from "./components/SearchBox.jsx";
import VolumeGrid from "./components/VolumeGrid.jsx";
import BookList from "./components/BookList.jsx";
import ChapterGrid from "./components/ChapterGrid.jsx";
import Reader from "./components/Reader.jsx";
import ChapterTimeline from "./components/ChapterTimeline.jsx";
import NavPill from "./components/NavPill.jsx";
import { LensControls } from "./components/LensPanel.jsx";
import Commentary from "./components/Commentary.jsx";
import { getCommentary, connectionsByVerse } from "./lib/commentary.js";
import { LoadingShimmer, ErrorCard } from "./components/Status.jsx";

export default function App() {
  const [volId, setVolId] = useState(null);
  const [bookIdx, setBookIdx] = useState(null);
  const [chapIdx, setChapIdx] = useState(null);
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetVerse, setTargetVerse] = useState(null);
  // -1 / 1 while paging with the nav arrows, 0 for every other entry point.
  const [flipDir, setFlipDir] = useState(0);
  // Which lenses the commentary is read through. Nothing consumes these yet —
  // they're held here so the reader can pick them up once it does.
  const [lens, setLens] = useState({ level: "Chapter", breadth: "volume", world: "text" });
  // Where to return to after following a cross reference.
  const [history, setHistory] = useState([]);
  // Which panels the reader has folded away, by card id. Held here rather than
  // in the cards so the choice survives the remounts that replay their
  // entrance animations on every chapter and lens change.
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

  // Snapshot before navigating, never from a scroll listener: swapping chapters
  // changes the document height, and the browser clamps the scroll and fires a
  // scroll event *before* effects run — which would overwrite the position we
  // just tried to save with the clamped one.
  const rememberScroll = useCallback(() => {
    if (chapterKeyRef.current) scrollPos.current.set(chapterKeyRef.current, window.scrollY);
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

  const ensure = useCallback(async (v) => {
    setLoading(true);
    setError(null);
    try {
      return await loadVolume(v);
    } catch (e) {
      setError("Couldn't load this volume. Check your connection and try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const openVolume = useCallback(async (v) => {
    rememberScroll();
    setVolId(v.id);
    setBooks(getCached(v.id));
    setBookIdx(null);
    setChapIdx(null);
    setTargetVerse(null);
    setFlipDir(0);
    const data = await ensure(v);
    if (!data) return;
    setBooks(data);
    if (v.id === "dc") setBookIdx(0);
  }, [ensure, rememberScroll]);

  const goTo = useCallback(async (s) => {
    rememberScroll();
    const vol = VOLUMES.find((x) => x.id === s.v);
    setFlipDir(0);
    setVolId(vol.id);
    setBooks(getCached(vol.id));
    const data = await ensure(vol);
    if (!data) return;
    setBooks(data);
    const bi = s.v === "dc" ? 0 : data.findIndex((b) => b.name === s.book);
    setBookIdx(bi < 0 ? null : bi);
    if (s.ch != null && bi >= 0) {
      const ci = data[bi].chapters.findIndex((c) => c.n === s.ch);
      setChapIdx(ci < 0 ? null : ci);
      setTargetVerse(s.verse || null);
    } else {
      setChapIdx(null);
      setTargetVerse(null);
    }
  }, [ensure, rememberScroll]);

  useEffect(() => {
    if (chapter && targetVerse != null) {
      // An explicit verse target beats the remembered position.
      const t = setTimeout(() => {
        document.getElementById(`verse-${targetVerse}`)?.scrollIntoView({ block: "center", behavior: "auto" });
      }, 60);
      const clear = setTimeout(() => setTargetVerse(null), 3200);
      return () => { clearTimeout(t); clearTimeout(clear); };
    }
    window.scrollTo({ top: chapterKey ? scrollPos.current.get(chapterKey) ?? 0 : 0 });
  }, [volId, bookIdx, chapIdx]); // eslint-disable-line

  const step = (dir) => {
    if (!books || bookIdx == null || chapIdx == null) return;
    rememberScroll();
    let b = bookIdx, c = chapIdx + dir;
    if (c < 0) {
      if (b === 0) return;
      b -= 1; c = books[b].chapters.length - 1;
    } else if (c >= books[b].chapters.length) {
      if (b === books.length - 1) return;
      b += 1; c = 0;
    }
    setTargetVerse(null);
    setFlipDir(dir);
    setBookIdx(b);
    setChapIdx(c);
  };

  // Margin markers mirror the Cross Connections list, so they follow the same
  // breadth. Only in the Text world — the other two have no breadth to set.
  const chapterNotes = chapter
    ? getCommentary(volId === "dc" ? "Doctrine and Covenants" : book?.name, chapter.n)
    : null;
  const verseConnections = chapter && lens.world === "text"
    ? connectionsByVerse(chapterNotes, chapter.n, lens.breadth)
    : null;
  // The notes' `underline:` anchors are still parsed (see underlinesByVerse in
  // lib/commentary.js) but nothing draws them for now.

  // Follow a cross reference, remembering where we stood so Back can undo it.
  const openReference = useCallback(async (cite) => {
    rememberScroll();
    setHistory((h) => [...h, { volId, bookIdx, chapIdx, scrollY: window.scrollY }]);
    await goTo({
      v: cite.book.v,
      book: cite.book.n,
      ch: cite.chapter,
      verse: cite.verses[0] ?? null,
    });
  }, [goTo, rememberScroll, volId, bookIdx, chapIdx]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (!prev) return h;
      setVolId(prev.volId);
      setBooks(getCached(prev.volId));
      setBookIdx(prev.bookIdx);
      setChapIdx(prev.chapIdx);
      setTargetVerse(null);
      setFlipDir(0);
      // The restore effect keys off the chapter change; give it the offset.
      if (prev.volId != null && prev.bookIdx != null && prev.chapIdx != null) {
        scrollPos.current.set(`${prev.volId}:${prev.bookIdx}:${prev.chapIdx}`, prev.scrollY);
      }
      return h.slice(0, -1);
    });
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

  // Scroll the reader to a verse (from a sidebar entry).
  const jumpToVerse = useCallback((v) => {
    document.getElementById(`verse-${v}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setTargetVerse(v);
    setTimeout(() => setTargetVerse(null), 3200);
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
        const col = document.querySelector(".commentary-col") || document.querySelector(".chrome");
        if (!col) return;
        // The cross-connections list still marks the current verse…
        const conns = col.querySelectorAll("[id^='conn-']");
        for (const el of conns) {
          const v = parseInt(el.id.replace("conn-", ""), 10);
          el.querySelector(".conn-jump")?.setAttribute("data-current", String(v === Number(top)));
        }
        // …but the column follows the notes themselves — never the footnote
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
  }, [chapter, lens.breadth, lens.world, lens.level]);

  const atStart = bookIdx === 0 && chapIdx === 0;
  const atEnd = books && bookIdx === books.length - 1 && book && chapIdx === book.chapters.length - 1;

  // One level up the hierarchy, mirroring the breadcrumbs. Returns false at the
  // top so the caller can leave the key alone.
  const goUp = () => {
    rememberScroll();
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
  const trail = [];
  if (volume) {
    trail.push({
      icon: true, label: "All scriptures",
      onClick: () => { rememberScroll(); setVolId(null); setBooks(null); setBookIdx(null); setChapIdx(null); setTargetVerse(null); },
    });
    if (chapter || (book && volId !== "dc")) {
      trail.push({
        label: VOL_SHORT[volId] || volume.title,
        onClick: () => { rememberScroll(); setBookIdx(volId === "dc" ? 0 : null); setChapIdx(null); setTargetVerse(null); },
      });
    }
    if (book && volId !== "dc" && chapter) {
      trail.push({ label: book.name, onClick: () => { rememberScroll(); setChapIdx(null); setTargetVerse(null); } });
    }
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", color: ink, background: "linear-gradient(175deg,#f6f7f9 0%,#eef1f5 55%,#eceef3 100%)", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" }}>
      <AmbientGlow />

      {/* Layout lives in styles.css so a media query can turn this bar into a
          left sidebar once the window is wide enough for one. */}
      <header className="chrome">
        <div className="chrome-inner">
          <div style={{ ...glass, borderRadius: 18, padding: "12px 18px" }}>
            <SearchBox onNavigate={goTo} />
          </div>
          {/* Both live in the left column; CSS decides which are on show. The
              lens controls hide here once the right-hand panel has room. */}
          <div className="side-extras">
            <div className="lens-box">
              <LensControls lens={lens} setLens={setLens} volumeTitle={volume?.title} bookName={book && volId !== "dc" ? book.name : null} />
            </div>
            {/* Where this chapter sits in the book's arc. Renders itself away
                when the book has no captions written for it. */}
            {/* Keyed by book: a new book should place its band without gliding
                there from the old book's position. */}
            <div className="timeline-box">
              <ChapterTimeline key={volId} volId={volId} volumeTitle={volume?.title}
                books={books} book={book} chapter={chapter}
                onOpen={openChapterAt} collapsed={collapsed} onToggle={toggleCard} />
            </div>
            {/* Falls back into this column when the window is too narrow for a
                second one; hidden once .commentary-col has room. */}
            <div className="commentary-inline">
              <Commentary book={book} chapter={chapter} lens={lens} volId={volId} onJump={jumpToVerse}
          collapsed={collapsed} onToggle={toggleCard} />
            </div>
          </div>
        </div>
      </header>

      <main className="content">
        {!volume && <VolumeGrid onOpen={openVolume} />}
        {volume && loading && <LoadingShimmer />}
        {volume && error && !loading && <ErrorCard message={error} onRetry={() => openVolume(volume)} />}
        {volume && books && bookIdx == null && volId !== "dc" && (
          <BookList volume={volume} books={books} onOpen={(i) => { setBookIdx(i); setChapIdx(null); }} />
        )}
        {book && chapIdx == null && (
          <ChapterGrid volId={volId} book={book} onOpen={(i) => { setChapIdx(i); setTargetVerse(null); setFlipDir(0); }} />
        )}
        {/* key remounts the article so its entrance animation replays per chapter */}
        {chapter && (
          <Reader key={`${bookIdx}-${chapIdx}`} volId={volId} book={book}
            chapter={chapter} targetVerse={targetVerse} flipDir={flipDir}
            connections={verseConnections} onOpenRef={openReference} />
        )}
      </main>

      <aside className="commentary-col" aria-label="Commentary column">
        <Commentary book={book} chapter={chapter} lens={lens} volId={volId} onJump={jumpToVerse}
          collapsed={collapsed} onToggle={toggleCard} />
      </aside>

      {trail.length > 0 && (
        <NavPill trail={trail} chapter={chapter} atStart={atStart} atEnd={atEnd}
          onPrev={() => step(-1)} onNext={() => step(1)}
          onBack={history.length ? goBack : null} />
      )}
    </div>
  );
}
