import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built app works on GitHub Pages (project subpath)
  // and on Firebase Hosting without changes.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
