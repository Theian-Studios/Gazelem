import { relatedFor } from "../lib/related.js";
import { versesLabel } from "../lib/mentions.js";
import Card from "./Card.jsx";

// What else there is to read alongside this chapter, of both kinds: the other
// chapters that read with it, and the site's own pages that treat it. They are
// one card rather than two because they answer one question — where do I go
// from here — and a reader who has read the chapter is not weighing "similar
// chapter" against "study page", only looking for what is next.
//
// The pages are also marked in the margin, against the verses they begin at.
// That mark is for the reader in the middle of a verse; this list is for the
// reader who has finished and is looking about.
//
// Most chapters have neither, so the card renders nothing at all for them
// rather than standing there empty.
export default function RelatedChapters({ volId, book, chapter, pages = [], onOpen, onOpenPage, collapsed, onToggle }) {
  // The D&C's single book is called Sections in the data, while its chart
  // entries would be filed under the volume's name.
  const related = relatedFor(volId === "dc" ? "Doctrine and Covenants" : book?.name, chapter?.n);
  if (!related?.length && !pages.length) return null;

  return (
    /* One wrapped row of pills needs less room beneath it than a card of prose
       does; styles.css closes this card up tighter by its id. */
    <Card id="related" title="Related" label="Related reading"
      collapsed={!!collapsed?.has("related")} onToggle={onToggle}>
      {related?.length > 0 && (
        <ul className="rel-list">
          {related.map((label) => (
            <li key={label}>
              {/* A citation naming a range opens at its first chapter, which is
                  where you would start reading it. */}
              <button className="rel-jump" onClick={() => onOpen(label)} title={`Open ${label}`}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pages.length > 0 && (
        /* Set below the chapters and ruled off from them where both are
           present: they are different kinds of thing going to different kinds
           of page, and a row of pills followed by a run of titles reads as two
           answers rather than one long list. */
        <ul className={`rel-pages${related?.length ? " rel-pages-under" : ""}`}>
          {pages.map((p) => (
            <li key={p.section}>
              <button className="rel-page" onClick={() => onOpenPage(p)} title={`Open ${p.title}`}>
                <span className="serif rel-page-name">{p.title}</span>
                <span className="rel-page-meta">
                  <span className="rel-page-kind">{p.kind}</span>
                  {p.verses.length > 0 && <span className="rel-page-verses">{versesLabel(p.verses)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
