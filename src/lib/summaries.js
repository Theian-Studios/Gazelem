import { useState, useEffect } from "react";
import SYNOPSES_1920 from "../data/synopses1920.json";

// Optional personal copy of the chapter summaries, served from public/local/.
// It is deliberately NOT bundled with the source: the current editions'
// summaries are copyrighted, so the file stays local to this machine (see
// .gitignore and public/local/README.md).
const LOCAL_URL = `${import.meta.env.BASE_URL}local/summaries.json`;

let request = null;

function fetchLocal() {
  if (!request) {
    request = fetch(LOCAL_URL)
      .then((r) => (r.ok ? r.json() : null))
      // Absent file is the normal case, not an error.
      .catch(() => null)
      .then((d) => (d && typeof d.summaries === "object" ? d : null));
  }
  return request;
}

export function useLocalSummaries() {
  const [local, setLocal] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchLocal().then((d) => { if (alive) setLocal(d); });
    return () => { alive = false; };
  }, []);
  return local;
}

// The D&C is normalized into a single pseudo-book named "Sections", so key it
// by its real title instead.
export const summaryKey = (volId, book) =>
  volId === "dc" ? "Doctrine and Covenants" : book.name;

// A personal copy wins; otherwise fall back to the public-domain 1920
// synopses, which only exist for the Book of Mormon.
export function resolveSummary(local, volId, book, chapterN) {
  const key = summaryKey(volId, book);
  const n = String(chapterN);

  const mine = local?.summaries?.[key]?.[n];
  if (mine) return mine;

  return volId === "bofm" ? SYNOPSES_1920[book.name]?.[n] ?? null : null;
}
