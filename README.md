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

**The verse text** is fetched at runtime from `bcbooks/scriptures-json`. That
dataset is *not* public domain, despite what this file previously claimed —
it is the current (1981/2013) edition, © Intellectual Reserve. Two checks that
settle it: 2 Nephi 30:6 reads "pure and a delightsome", wording introduced in
1981 (the public-domain 1920 edition reads "white and delightsome"), and
1 Nephi 20:1 carries the "or out of the waters of baptism" clause restored in
1981. Replacing it with a genuinely public-domain text is unfinished work:
the KJV covers the Old and New Testaments cleanly, but no clean digital
transcription of a pre-1929 Book of Mormon, Doctrine and Covenants, or Pearl
of Great Price appears to exist — only page scans whose OCR corrupts the text.
