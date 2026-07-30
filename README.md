# The Scriptures — liquid glass reader

A scripture study site: all five standard works with reference search
(autocomplete like "m 2 3" → Mosiah 2:3) and 1920 edition chapter
synopses over the current text.

## Run locally
    npm install
    npm run dev        # http://localhost:5173

## Build for production
    npm run build      # outputs to dist/

## Deploying to GitHub Pages
`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
Enable it once under **Settings → Pages → Build and deployment → Source:
GitHub Actions**; no branch or `docs/` folder is involved.

The base path is not hard-coded — the workflow derives it from the repository
name, so `<user>.github.io` publishes at the root and any other repo name
publishes at `/<repo>/`. Renaming the repo needs no code change.

`npm run build` locally still uses `/`; set `SITE_BASE=/<repo>/ npm run build`
to reproduce exactly what the workflow produces.

## Structure
    src/App.jsx              state + routing between views
    src/components/          one file per UI piece
    src/data/volumes.js      the five standard works (CDN file names)
    src/data/bookIndex.js    all 87 books w/ chapter counts (powers search)
    src/data/synopses1920.json  1920 chapter synopses overlay (Book of Mormon)
    src/lib/search.js        reference parser + autocomplete
    src/lib/api.js           volume fetching + cache
    src/theme.js             glass styles + palette

## Adding study layers
Follow the synopses pattern: put new data (footnotes, cross-references,
variants) in src/data/ keyed by book → chapter, import it in Reader.jsx,
and render it as another overlay. The scripture text itself stays untouched.

## Sources and rights
**Chapter synopses** (`src/data/synopses1920.json`) come from the 1920 Salt
Lake City edition and are public domain.

**The personal summaries** in `public/local/summaries.json` are extracted from
the current editions and are copyrighted, so they never leave this machine:
they are gitignored, a Vite plugin deletes them from `dist/`, and the deploy
workflow fails if they reappear. The app treats the file as optional and falls
back to the 1920 synopses, which is what the published site shows.

**The verse text** for three volumes is built from public-domain sources by
`npm run build:scriptures` into `public/scriptures/`, and served from this site:

| Volume | Source | State |
|---|---|---|
| Old & New Testament | King James Version (aruljohn/Bible-kjv) | 1,189 chapters, 31,102 verses; every chapter matches the canonical verse counts |
| Book of Mormon | 1920 Salt Lake City edition, Internet Archive page scan | 6,548 of 6,604 verses; 56 listed in `gaps.json` |

The Book of Mormon is OCR of a two-column setting, so the build separates
scripture from page furniture and places each verse by comparing wording with
the modern edition — used only as a map of where verses belong; every word
written out comes from the 1920 scan. Mean agreement with the modern edition is
0.985; the difference is a mix of genuine 1920 readings ("a white and
delightsome people", "a descendant of Joseph") and leftover OCR damage. Verses
the scan did not yield say so in the reader rather than appearing blank.

**Still owed:** the Doctrine and Covenants and the Pearl of Great Price are
still fetched from `bcbooks/scriptures-json`, which is *not* public domain — it
is the current (1981/2013) edition, © Intellectual Reserve. Two checks settle
it: 2 Nephi 30:6 there reads "pure and a delightsome", wording introduced in
1981, and 1 Nephi 20:1 carries the "waters of baptism" clause restored in 1981.
Publishing those two volumes needs pre-1929 scans of the 1921 editions, the
same way the Book of Mormon was done.
