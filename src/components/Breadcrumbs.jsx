import { ink, blue } from "../theme.js";

export default function Breadcrumbs({ crumbs }) {
  return (
    /* Layout is in styles.css so the sidebar breakpoint can stack these one per
       line and drop the separators. */
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <span key={i} className="crumb">
          {i > 0 && <span aria-hidden className="crumb-sep" style={{ color: "rgba(110,110,115,.5)", fontSize: 12 }}>›</span>}
          {c.onClick ? (
            <button onClick={c.onClick} className="lift" style={{ background: "none", border: 0, padding: "2px 2px", color: i === crumbs.length - 1 ? ink : blue, fontSize: 14, fontWeight: i === crumbs.length - 1 ? 600 : 500, cursor: "pointer", borderRadius: 6 }}>
              {c.label}
            </button>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
