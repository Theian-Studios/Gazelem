import { glass } from "../theme.js";

// The open volume's ways in, standing in the margin beside the page.
//
// It is the bottom pill's job written out at length: the pill can only offer
// the steps back up the hierarchy one at a time, because it has a pill's worth
// of room. Given a column there is space to show them at once.
//
// What it does not do is repeat the page. On a volume's own shelf the books are
// already the thing being looked at, so the card carries only the sections; it
// is when one of those is open — a timeline, the prophets, the map — that the
// books leave the screen, and that is when the card puts them back. Chapters it
// never lists: a book is one press away, and its chapters are what that press
// opens.
//
// Only ever shown where the margin is genuinely empty: never beside a chapter,
// which has its own two columns to keep, and never narrow, where there is no
// margin to stand in. Both are decided in styles.css, so this renders whenever
// a volume is open and lets the page say where there is room for it.
export default function ContentsCard({
  volume, volId, books, sections, bookIdx, section, prophet,
  onLibrary, onVolume, onBook,
}) {
  if (!volume || !books) return null;

  // One of the volume's sections is open, so the books are not on the page.
  const articleOpen = section != null || prophet != null;
  // The D&C is one long book of sections rather than a shelf, so its single
  // entry stands where another volume's books would.
  const isSections = volId === "dc";

  return (
    <nav className="toc-card" style={{ ...glass, borderRadius: 20 }} aria-label={`${volume.title} contents`}>
      <button className="toc-up" onClick={onLibrary}>
        <span className="toc-up-chev" aria-hidden>‹</span>
        <span>All scriptures</span>
      </button>

      <div className="toc-scroll">
        {/* The D&C's front door is its sections rather than a shelf of books, so
            its own row is the current one whenever nothing stands above it —
            bookIdx being pinned to its single book there, never null. */}
        <button className="serif toc-volume" onClick={onVolume}
          data-on={(!articleOpen && (isSections || bookIdx == null)) || undefined}>
          {volume.title}
        </button>

        {/* The ways in that are not the text itself, in the order they are
            shelved in on the volume's own page. */}
        {sections.length > 0 && (
          <ul className="toc-list toc-sections">
            {sections.map((s) => (
              <li key={s.id}>
                <button className="toc-row toc-section" onClick={s.onClick} data-on={s.on || undefined}>
                  <span className="toc-row-icon" aria-hidden>{s.icon}</span>
                  <span className="toc-row-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* The shelf, once the page is showing something other than the shelf. */}
        {articleOpen && (
          <div className="toc-group">
            <p className="toc-heading">{isSections ? "The text" : "Books"}</p>
            <ul className="toc-list">
              {(isSections ? [books[0]] : books).map((b, bi) => (
                <li key={b.name}>
                  {/* Never in the D&C, whose one book is pinned open under
                      every section — the map is not the text, and marking the
                      text current while the map is up says it is. */}
                  <button className="toc-row toc-book" data-on={(!isSections && bi === bookIdx) || undefined}
                    onClick={() => onBook(bi)}>
                    <span className="toc-row-name serif">{isSections ? "Sections" : b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
