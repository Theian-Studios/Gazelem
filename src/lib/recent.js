// The searches this browser has run, most recent first. Kept locally: it is a
// record of what someone has been studying, and it belongs to them.
const KEY = "gazelem.recentSearches";
const LIMIT = 5;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    // Trimmed on the way in as well as on the way out, so a list saved when
    // the limit was longer comes back the length it is now.
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, LIMIT) : [];
  } catch {
    // Private browsing, a full quota, a hand-edited value — none of them are
    // worth failing a search over.
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* nothing to do about it, and nothing depends on it */
  }
}

export const recentSearches = read;

// Re-searching something moves it back to the top rather than listing twice.
export function rememberSearch(query) {
  const q = query.trim();
  if (!q) return read();
  const next = [q, ...read().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, LIMIT);
  write(next);
  return next;
}

export function forgetSearch(query) {
  const next = read().filter((s) => s !== query);
  write(next);
  return next;
}
