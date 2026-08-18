import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// public/local holds a personal copy of the current editions' chapter
// summaries, which are copyrighted. Vite copies everything under public/ into
// the build, so without this the published site would serve them. The app
// already treats an absent file as the normal case (see lib/summaries.js) and
// falls back to the public-domain 1920 synopses.
function excludeLocalStudyHelps() {
  return {
    name: "exclude-local-study-helps",
    apply: "build",
    async closeBundle() {
      await rm(fileURLToPath(new URL("dist/local", import.meta.url)), {
        recursive: true,
        force: true,
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves a project repo from /<repo>/, so asset URLs need that
  // prefix. The deploy workflow works it out from the repo name; the default
  // root is right for `vite dev` and `vite preview` locally.
  base: process.env.SITE_BASE || "/",
  // Nothing about the site is tied to a port — no callback URL, no webhook —
  // so it takes whichever one it is handed and only falls back to Vite's own
  // when it is handed none. Two copies running at once (a second window, a
  // second session) is the ordinary case, and fixing the port made the second
  // one fail to start rather than simply stand beside the first.
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [react(), excludeLocalStudyHelps()],
  build: {
    rollupOptions: {
      output: {
        // React and its runtime, which change only when the dependency does, so
        // a release that touches the site alone leaves them in the reader's
        // cache. Everything else is left to Rollup, which follows the imports:
        // the written pages are reached through App's lazy imports, and gathering
        // them here by where they sit on disk would put them back in the first
        // download — one manual chunk holding both a chart nobody has opened and
        // the commentary the reader is looking at is fetched for the second, and
        // arrives carrying the first.
        manualChunks(id) {
          if (id.includes("/node_modules/")) return "vendor";
        },
      },
    },
  },
});
