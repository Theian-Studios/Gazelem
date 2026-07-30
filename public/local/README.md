# Personal content (not tracked by git)

Drop a file named `summaries.json` in this folder and the reader will use it for
every chapter summary and section heading, in place of the bundled 1920
Book of Mormon synopses.

This folder is gitignored on purpose. The chapter summaries, D&C section
headings and footnotes in the current editions are © Intellectual Reserve — fine
to keep a personal copy, not fine to redistribute. Keeping them out of the repo
means they can't be committed or pushed by accident.

## Format

```json
{
  "label": "Chapter summary",
  "summaries": {
    "Genesis": {
      "1": "God creates the heaven and the earth…",
      "2": "…"
    },
    "1 Nephi": { "1": "…" },
    "Doctrine and Covenants": { "76": "…" }
  }
}
```

- **Book names must match** the app's names exactly — see `src/data/bookIndex.js`.
  Run `npm run check:summaries` to verify; it reports unmatched names and
  coverage per volume.
- The D&C is keyed as `"Doctrine and Covenants"`, with section numbers as the
  chapter keys.
- `label` is the small caption under the summary. Omit it and it reads
  "Chapter summary".
- Partial files are fine. Anything missing falls back to the 1920 synopses
  (Book of Mormon only), and chapters with neither simply show no summary.

Reload the page after changing the file — it's fetched once per session.
