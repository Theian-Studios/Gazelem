import { glass, gold } from "../theme.js";

// A way into a volume that isn't one of its books — its prophets, its arc, its
// map. Shelved with the books but marked in gold, so it reads as a different
// kind of door rather than as a book that has been mis-filed.
export default function SectionTile({ icon, name, count, onClick, delay = 0 }) {
  return (
    <button className="tap popin section-tile" onClick={onClick}
      style={{ ...glass, animationDelay: `${delay}ms` }}>
      <span className="section-tile-icon" aria-hidden>{icon}</span>
      <span className="serif section-tile-name">{name}</span>
      {count != null && <span className="section-tile-count" style={{ color: gold }}>{count}</span>}
    </button>
  );
}

// The four marks, drawn rather than typed so they sit on the same optical
// line and take the gold from their parent.
export const TimelineIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 2v12" />
    <circle cx="3" cy="5" r="1.7" fill="#fdfdfe" />
    <circle cx="3" cy="11" r="1.7" fill="#fdfdfe" />
    <path d="M7.5 5h6M7.5 11h4" />
  </svg>
);

export const ProphetsIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="5" r="2.6" />
    <path d="M2.8 14c.6-2.9 2.7-4.4 5.2-4.4s4.6 1.5 5.2 4.4" />
  </svg>
);

export const MapIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.8 4.1 5.8 2.4v9.5L1.8 13.6z" />
    <path d="M5.8 2.4l4.4 1.7v9.5L5.8 11.9z" />
    <path d="M10.2 4.1l4-1.7v9.5l-4 1.7z" />
  </svg>
);

// A grid of cells, two of them filled: the volume laid out a chapter to a
// square, which is what the overview draws.
export const OverviewIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinejoin="round">
    <rect x="1.6" y="1.6" width="5.2" height="5.2" rx="1.3" />
    <rect x="9.2" y="1.6" width="5.2" height="5.2" rx="1.3" fill="currentColor" stroke="none" />
    <rect x="1.6" y="9.2" width="5.2" height="5.2" rx="1.3" fill="currentColor" stroke="none" />
    <rect x="9.2" y="9.2" width="5.2" height="5.2" rx="1.3" />
  </svg>
);

// A balance: what is claimed set against what the text actually carries.
export const EvidencesIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2.6v11M4.4 13.6h7.2M3 5.4h10M8 2.6 3 5.4M8 2.6l5 2.8" />
    <path d="M1.1 9.2a1.9 1.9 0 0 0 3.8 0L3 5.4z" />
    <path d="M11.1 9.2a1.9 1.9 0 0 0 3.8 0L13 5.4z" />
  </svg>
);

// Bars standing on a baseline: a chart, plainly. A question mark stood here
// before, which said what the shelf was for — questions asked of the record —
// and not what was on it. Bars rather than a ruled table, because the table
// would come out at this size as the overview's grid of squares.
export const ChartsIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 13.6h12" />
    <path d="M4.2 13.6V9.4M8 13.6V5.6M11.8 13.6V7.8" />
  </svg>
);

// Books shelved upright, and the shelf under them: what has been written about
// the record, as against the record itself. Three spines and a leaning volume
// stood here, which at fifteen pixels was four shapes fighting for the same
// square — two spines and a rule say the same thing and can be read.
export const ResourcesIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.2" y="2.6" width="4.2" height="9.8" rx="1" />
    <rect x="8.2" y="2.6" width="4.2" height="9.8" rx="1" />
    <path d="M1.4 14.4h13.2" />
  </svg>
);

// An open book with light rising off it: the record coming out rather than the
// record being read.
export const ComingForthIcon = (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 8.6c-1.5-1.1-3.1-1.3-5.2-1.2V14c2.1-.1 3.7.1 5.2 1.2 1.5-1.1 3.1-1.3 5.2-1.2V7.4c-2.1-.1-3.7.1-5.2 1.2z" />
    <path d="M8 8.6v6.6" />
    <path d="M8 5.2V1.4M5.2 4.3 4 2.9M10.8 4.3 12 2.9" />
  </svg>
);
