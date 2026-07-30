# The Scriptures — liquid glass reader

A scripture study site: all five standard works with reference search
(autocomplete like "m 2 3" → Mosiah 2:3) and 1920 edition chapter
synopses over the current text.

## Run locally
    npm install
    npm run dev        # http://localhost:5173

## Build for production
    npm run build      # outputs to dist/

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

Scripture text: bcbooks/scriptures-json (public domain). 1920 synopses:
extracted from the 1920 Salt Lake City edition (public domain).
