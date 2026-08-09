// Line icons for the overview's four facets, drawn to one set of rules so the
// row reads as a family: a 24 unit box, 1.6 stroke, round caps and joins, and
// no fills. They inherit currentColor, so the ring around them controls the
// colour in one place.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

// A single figure, centred — set against the audience's three, the count is
// what tells them apart.
export function SpeakerIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.2 20c0-3.5 3-5.7 6.8-5.7s6.8 2.2 6.8 5.7" />
    </svg>
  );
}

// Several figures, the front one nearer — the people being spoken to. Each
// shoulder line rises to just under its own head; leaving a gap there reads as
// a floating head rather than a person.
export function AudienceIcon() {
  return (
    <svg {...base}>
      {/* the two behind: smaller, higher, and cut off by the edge */}
      <circle cx="5.4" cy="7.9" r="2.1" />
      <path d="M2.1 14.6c0-2 1.4-3.3 3.3-3.3" />
      <circle cx="18.6" cy="7.9" r="2.1" />
      <path d="M21.9 14.6c0-2-1.4-3.3-3.3-3.3" />
      {/* the one in front: larger, lower, and whole */}
      <circle cx="12" cy="10.4" r="2.7" />
      <path d="M6.8 20c0-3.9 2.3-6.1 5.2-6.1s5.2 2.2 5.2 6.1" />
    </svg>
  );
}

// A pin over the ground it marks — where the chapter happens.
export function LocationIcon() {
  return (
    <svg {...base}>
      <path d="M12 21.2s6.6-5.7 6.6-11a6.6 6.6 0 1 0-13.2 0c0 5.3 6.6 11 6.6 11z" />
      <circle cx="12" cy="10.1" r="2.4" />
    </svg>
  );
}

// A struck light: the ideas the chapter turns on, rather than its furniture.
export function PrinciplesIcon() {
  return (
    <svg {...base}>
      <path d="M12 2.6v3.1M12 18.3v3.1M2.6 12h3.1M18.3 12h3.1" />
      <path d="M5.9 5.9 8 8M16 16l2.1 2.1M18.1 5.9 16 8M8 16l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}
