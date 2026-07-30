import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { glassOverlay, ink, inkSoft } from "../theme.js";

const clean = (s) => s.replace(/\s+/g, " ").trim();

// The portion of `el` that actually falls inside `range`. Used instead of
// Selection.containsNode, which counts an element as selected when the range
// merely touches its boundary — that made a one-verse selection cite two.
function selectedTextIn(range, el) {
  if (!range.intersectsNode(el)) return "";
  const whole = document.createRange();
  whole.selectNodeContents(el);
  const sub = range.cloneRange();
  try {
    if (sub.compareBoundaryPoints(Range.START_TO_START, whole) < 0) {
      sub.setStart(whole.startContainer, whole.startOffset);
    }
    if (sub.compareBoundaryPoints(Range.END_TO_END, whole) > 0) {
      sub.setEnd(whole.endContainer, whole.endOffset);
    }
  } catch {
    return "";
  }
  return clean(sub.toString());
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for contexts without the async clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Floating actions for the current selection inside `containerRef`.
export default function SelectionMenu({ containerRef, reference }) {
  const [state, setState] = useState(null); // { text, cite, top, left, below }
  const [flash, setFlash] = useState("");
  const flashTimer = useRef(null);

  const read = useCallback(() => {
    const sel = window.getSelection();
    const root = containerRef.current;
    if (!root || !sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !root.contains(el)) return null;

    // Walk the verse text spans rather than the whole paragraph: the verse
    // number is a sibling span, and Range.toString() would otherwise splice
    // those digits into both the citation and the copied text.
    const hits = Array.from(root.querySelectorAll("[data-verse-text]"))
      .map((sp) => ({
        n: Number(sp.closest('[id^="verse-"]')?.id.slice(6)),
        text: selectedTextIn(range, sp),
      }))
      .filter((h) => h.text);

    const text = hits.length ? hits.map((h) => h.text).join(" ") : clean(sel.toString());
    if (!text) return null;

    const nums = hits.map((h) => h.n).filter(Number.isFinite);
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const cite = !nums.length
      ? reference
      : lo === hi
        ? `${reference}:${lo}`
        : `${reference}:${lo}–${hi}`;

    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const below = r.top < 96; // not enough headroom — sit under the selection
    return {
      text,
      cite,
      top: below ? r.bottom + 10 : r.top - 10,
      left: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150),
      below,
    };
  }, [containerRef, reference]);

  useEffect(() => {
    const sync = () => {
      const next = read();
      setState(next);
      if (!next) setFlash("");
    };
    // Settle after the gesture ends so the bar doesn't jump mid-drag.
    const later = () => setTimeout(sync, 0);
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setState(null); setFlash(""); }
    };

    document.addEventListener("mouseup", later);
    document.addEventListener("touchend", later);
    document.addEventListener("keyup", later);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("mouseup", later);
      document.removeEventListener("touchend", later);
      document.removeEventListener("keyup", later);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
      clearTimeout(flashTimer.current);
    };
  }, [read]);

  if (!state) return null;

  // Confirm, then drop the selection so the bar dismisses itself.
  const run = async (fn, msg) => {
    const ok = await fn();
    setFlash(ok ? msg : "Couldn't copy");
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      window.getSelection()?.removeAllRanges();
      setFlash("");
      setState(null);
    }, 420);
  };

  const quoted = `“${state.text}” (${state.cite})`;

  const actions = [
    { key: "copy", label: "Copy", title: "Copy the selected text", onClick: () => run(() => copyText(state.text), "Copied") },
    { key: "cite", label: "Copy with reference", title: `Copy with “${state.cite}”`, onClick: () => run(() => copyText(quoted), "Copied") },
  ];
  if (typeof navigator !== "undefined" && navigator.share) {
    actions.push({
      key: "share",
      label: "Share",
      title: "Share the selected passage",
      onClick: async () => {
        try {
          await navigator.share({ title: state.cite, text: quoted });
        } catch {
          /* dismissed by the user — nothing to report */
        }
      },
    });
  }

  // Portalled to <body>: the reader's card uses backdrop-filter, which would
  // otherwise become the containing block for a position:fixed child.
  return createPortal(
    <div
      role="toolbar"
      aria-label={`Actions for ${state.cite}`}
      className="selbar"
      onMouseDown={(e) => e.preventDefault()} // keep the selection alive
      style={{
        ...glassOverlay,
        position: "fixed",
        top: state.top,
        left: state.left,
        transform: state.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        borderRadius: 999,
        padding: 4,
        display: "flex",
        alignItems: "center",
        gap: 2,
        zIndex: 60,
      }}
    >
      {flash ? (
        <span style={{ fontSize: 13, fontWeight: 600, color: ink, padding: "7px 16px", whiteSpace: "nowrap" }}>
          {flash}
        </span>
      ) : (
        <>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: inkSoft, padding: "0 8px 0 12px", whiteSpace: "nowrap", letterSpacing: ".02em" }}>
            {state.cite}
          </span>
          <span aria-hidden style={{ width: 1, height: 18, background: "rgba(31,45,71,.12)", margin: "0 4px" }} />
          {actions.map((a) => (
            <button
              key={a.key}
              title={a.title}
              onClick={a.onClick}
              className="lift selbar-btn"
              style={{
                border: 0, color: ink,
                fontSize: 13, fontWeight: 500, padding: "7px 12px", borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {a.label}
            </button>
          ))}
        </>
      )}
    </div>,
    document.body
  );
}
