import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { getSuggestions } from "../lib/search.js";
import { recentSearches, rememberSearch, forgetSearch } from "../lib/recent.js";
import { countIn } from "../lib/find.js";
import { completions } from "../lib/suggest.js";
import { findArticles } from "../lib/articles.js";
import { words } from "../lib/stem.js";
import { VOL_SHORT } from "../data/volumes.js";
import { glassInset, glassOverlay, ink, inkSoft } from "../theme.js";

// One field, four ways of asking. What parses as a reference is offered as a
// place to go; what names one of the site's own written pages opens it; what
// is on the page in front of you can be found there; and anything at all can
// be searched for across the standard works. They are offered in that order —
// nearest first — so the top row is the one a reader most often means. With
// the field empty it shows what has been searched before instead.
// `focusKey` changes when the field has just been revealed and should take the
// caret; `onDismiss` lets the caller put it away again once it is done with.
export default function SearchBox({ onNavigate, onSearch, onFind, onOpenArticle, onRequestOpen, onDismiss, focusKey, page }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [recents, setRecents] = useState(() => recentSearches());
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [anchor, setAnchor] = useState(null);
  const inputRef = useRef(null);
  const fieldRef = useRef(null);

  const trimmed = query.trim();

  // What the last word being typed could still turn into. Debounced, because
  // it is asked again on every keystroke, and cancelled on the way out so a
  // slow answer can't overwrite a newer one.
  const [completes, setCompletes] = useState([]);
  useEffect(() => {
    const last = words(trimmed).pop();
    // Only while the caret is still inside that word. "alma 3" ends on a digit,
    // and completing the "alma" behind it would swallow the 3.
    if (!last || !/[a-z’']$/i.test(trimmed)) { setCompletes([]); return; }
    let alive = true;
    const timer = setTimeout(() => {
      completions(last, 4).then((list) => {
        if (alive) setCompletes(list.map((full) => completeLast(trimmed, full)));
      });
    }, 110);
    return () => { alive = false; clearTimeout(timer); };
  }, [trimmed]);

  const items = useMemo(() => {
    if (!trimmed) return recents.map((label) => ({ kind: "recent", label }));
    const onPage = page ? countIn(page.verses, trimmed, page.connections) : 0;
    // The charts and evidences whose titles answer to this. One that reads as
    // the name of a page stands with the references, ahead of the word search;
    // one that merely mentions the word stands behind it, so a common word
    // typed and entered still searches the text rather than opening an essay.
    const articles = findArticles(trimmed).map((a) => ({ kind: "article", label: a.title, article: a }));
    return [
      ...suggestions.map((s) => ({ kind: "ref", label: s.label, suggestion: s })),
      ...articles.filter((a) => a.article.strong),
      // Only when the chapter actually says it: a row offering to find nothing
      // is worse than no row.
      ...(onPage ? [{ kind: "page", label: trimmed, count: onPage, where: page.label }] : []),
      // What was typed comes before what it might become, so Return always
      // searches for the thing in the field.
      { kind: "search", label: trimmed },
      ...articles.filter((a) => !a.article.strong),
      ...completes.map((label) => ({ kind: "complete", label, typed: sharedRun(label, trimmed) })),
    ];
  }, [trimmed, suggestions, recents, page, completes]);

  // The menu is portalled to <body>, so it needs the field's viewport rect.
  // On a narrow screen the field sits at the foot of the window, where there
  // is no room beneath it — so the menu opens upward instead, and is anchored
  // by its bottom edge to keep it pinned to the field as it grows.
  const measure = useCallback(() => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r) return;
    const room = window.innerHeight - r.bottom;
    setAnchor(
      room < 240
        ? { bottom: window.innerHeight - r.top + 8, left: r.left, width: r.width }
        : { top: r.bottom + 8, left: r.left, width: r.width }
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  const apply = useCallback((v) => {
    setQuery(v);
    const sugg = v.trim() ? getSuggestions(v) : [];
    setSuggestions(sugg);
    setOpen(true);
    // A reference match is the likelier intent when there is one, so it starts
    // selected; failing that, a page called by name; failing both, the word
    // search.
    setActiveIdx(0);
  }, []);

  // Revealed by a button rather than by typing — take the caret.
  //
  // On a change of the key, never on arriving with one. The field is written
  // once and placed in one of two spots — the bar at the top while a chapter is
  // open, the middle of the page everywhere else — so moving between them
  // unmounts it and mounts it again. Firing on mount meant that once the reader
  // had opened the search even once, every step out of a chapter took the caret
  // and, on a phone, threw the keyboard up over the page they had just asked
  // for.
  const lastKey = useRef(focusKey);
  useEffect(() => {
    if (focusKey === lastKey.current) return;
    lastKey.current = focusKey;
    inputRef.current?.focus();
  }, [focusKey]);

  // Typing anywhere starts a search. The keystroke happens on <body>, so
  // focusing the field alone would swallow it — the character is applied here
  // and the field picks up from there.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1 || e.key === " ") return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!window.getSelection()?.isCollapsed) return;   // mid-selection, leave it alone
      e.preventDefault();
      // On a narrow screen the field is put away until it is called for, and
      // it cannot take focus until it is on screen — so ask first, then focus
      // on the other side of the paint that reveals it.
      onRequestOpen?.();
      requestAnimationFrame(() => inputRef.current?.focus());
      apply(query + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, query, onRequestOpen]);

  // Said outright rather than left to the blur below: choosing a row may
  // happen without the field ever having held focus (a tap on a row takes it
  // straight from the button), and then no blur would come to put it away.
  const close = () => {
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    onDismiss?.();
  };

  const choose = (item) => {
    if (!item) return;
    if (item.kind === "ref") {
      setQuery("");
      setSuggestions([]);
      close();
      onNavigate(item.suggestion);
      return;
    }
    // A page of the site's own, which is a place to go rather than a search.
    if (item.kind === "article") {
      setQuery("");
      setSuggestions([]);
      close();
      onOpenArticle?.(item.article);
      return;
    }
    // A completion is just a longer search, and runs as one.
    if (item.kind === "page") {
      close();
      onFind(item.label);
      return;
    }
    // A word search keeps its text in the field, so it can be adjusted and run
    // again without retyping.
    setQuery(item.label);
    setSuggestions(getSuggestions(item.label));
    setRecents(rememberSearch(item.label));
    close();
    onSearch(item.label);
  };

  const drop = (query) => {
    setRecents(forgetSearch(query));
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { close(); return; }
    if (!open || items.length === 0) {
      if (e.key === "Enter" && trimmed) { e.preventDefault(); choose({ kind: "search", label: trimmed }); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[Math.max(0, activeIdx)]); }
  };

  return (
    <>
      <div ref={fieldRef} className="searchbar" style={{ ...glassInset, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "8px 12px" }}>
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke={inkSoft} strokeWidth="2.1" strokeLinecap="round" style={{ flexShrink: 0, display: "block" }}>
          <circle cx="11" cy="11" r="6.5" />
          <line x1="16" y1="16" x2="21" y2="21" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Go to a reference, or search for a word"
          value={query}
          onChange={(e) => apply(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          // The delay lets a click on a menu row land before the menu goes.
          onBlur={() => setTimeout(() => { setOpen(false); onDismiss?.(); }, 120)}
          placeholder="Search"
          style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 15, color: ink, minWidth: 0 }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setSuggestions([]); inputRef.current?.focus(); }} aria-label="Clear search" className="lift"
            style={{ border: 0, background: "rgba(110,110,115,.14)", borderRadius: 999, width: 20, height: 20, fontSize: 11, color: inkSoft, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}>
            ✕
          </button>
        )}
      </div>

      {/* Portalled to <body>: the header sets backdrop-filter, which makes it a
          backdrop root — a menu nested inside it can only sample the header's
          own (empty) contents, so its blur would silently do nothing. */}
      {open && items.length > 0 && anchor && createPortal(
        <div role="listbox" className={anchor.bottom ? "dropup" : "dropdown"}
          style={{ ...glassOverlay, position: "fixed", top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width, borderRadius: 16, padding: 6, zIndex: 40, maxHeight: 340, overflowY: "auto" }}>
          {!trimmed && <p className="srch-recent-head">Recent searches</p>}
          {items.map((item, i) => (
            <div key={`${item.kind}-${item.label}`} className="srch-opt-wrap">
              <button
                role="option"
                className="lift srch-opt"
                aria-selected={i === activeIdx}
                data-active={i === activeIdx || undefined}
                onMouseDown={(e) => { e.preventDefault(); choose(item); }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {(item.kind === "search" || item.kind === "complete") && <SearchGlyph />}
                {item.kind === "recent" && <ClockGlyph />}
                {item.kind === "page" && <PageGlyph />}
                {item.kind === "article" && <ChartGlyph />}
                <span className={`${item.kind === "ref" || item.kind === "article" ? "serif " : ""}srch-opt-label${item.kind === "article" ? " srch-opt-stack" : ""}`}>
                  {item.kind === "search" && <>Search for <strong>{item.label}</strong></>}
                  {item.kind === "page" && <>Find <strong>{item.label}</strong> in {item.where}</>}
                  {/* A page's own name, and the line under it: two charts often
                      answer to the same word, and the subtitle is what tells
                      them apart. */}
                  {item.kind === "article" && (
                    <>
                      <span>{item.label}</span>
                      {item.article.subtitle && <span className="srch-opt-sub">{item.article.subtitle}</span>}
                    </>
                  )}
                  {/* What was typed, then what the word grows into — the tail
                      set apart so the eye can see what is being offered. */}
                  {item.kind === "complete" && (
                    <>{item.label.slice(0, item.typed)}<strong>{item.label.slice(item.typed)}</strong></>
                  )}
                  {(item.kind === "ref" || item.kind === "recent") && item.label}
                </span>
                {item.kind === "ref" && <span className="srch-opt-tag">{VOL_SHORT[item.suggestion.v]}</span>}
                {item.kind === "article" && <span className="srch-opt-tag">{VOL_SHORT[item.article.volId]}</span>}
                {item.kind === "page" && <span className="srch-opt-tag">{item.count}</span>}
              </button>
              {item.kind === "recent" && (
                <button className="lift srch-forget" aria-label={`Remove ${item.label} from recent searches`}
                  onMouseDown={(e) => { e.preventDefault(); drop(item.label); }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// Swaps the word being typed for the longer one it could be, leaving whatever
// came before it in the field alone: "infinite aton" → "infinite atonement".
// The word is found where it stands rather than searched for by the stripped
// form the vocabulary knows it as — "lord's" is one word there and another in
// the field, and looking for the stripped one found nothing and dropped
// everything before it.
function completeLast(query, full) {
  const at = query.search(/[A-Za-z’']+$/);
  return at < 0 ? full : query.slice(0, at) + full;
}

// How much of the offered word is already in the field, which is what stays
// plain while the rest of it is set in bold. The run the two share, rather than
// the length of what was typed: an apostrophe in the field makes the two
// different lengths for the same reading.
function sharedRun(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return i;
}

function SearchGlyph() {
  return (
    <svg aria-hidden className="srch-opt-glyph" viewBox="0 0 24 24" width="15" height="15" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <line x1="16" y1="16" x2="21" y2="21" />
    </svg>
  );
}

// A page with a line picked out on it: finding within what is already open.
function PageGlyph() {
  return (
    <svg aria-hidden className="srch-opt-glyph" viewBox="0 0 24 24" width="15" height="15" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 15.5h4" />
      <path d="M8.5 12h7" strokeWidth="3" />
    </svg>
  );
}

// A ruled table: the shape the charts and the evidences are set in, which is
// what tells an article row apart from a passage at a glance.
function ChartGlyph() {
  return (
    <svg aria-hidden className="srch-opt-glyph" viewBox="0 0 24 24" width="15" height="15" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M10 9.5V19.5" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg aria-hidden className="srch-opt-glyph" viewBox="0 0 24 24" width="15" height="15" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
