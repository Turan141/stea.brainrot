import { defineConfig } from "vite";

// Relative base so the built app loads correctly inside the Capacitor WebView
// (served from the app's local file/scheme root), as well as on the web.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
