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
  plugins: [react(), excludeLocalStudyHelps()],
});
