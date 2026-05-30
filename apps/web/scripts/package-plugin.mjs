#!/usr/bin/env node
/**
 * Package the WordPress plugin source at apps/wp-plugin/ into a .zip file
 * that customers can download from the dashboard's connect-site wizard and
 * upload to their WP admin.
 *
 * Output: apps/web/public/downloads/workforce-seo.zip
 *
 * Runs as a pre-build step (chained from the `build` and `dev` scripts in
 * apps/web/package.json) so the served download stays in sync with the
 * current plugin source. Can also be run manually: `node scripts/package-plugin.mjs`.
 *
 * The plugin source is wrapped inside a "workforce-seo/" folder INSIDE the
 * zip so that when a user uploads the zip through WP admin → Plugins → Add
 * new, it lands at wp-content/plugins/workforce-seo/ — the canonical layout
 * WordPress expects for plugin headers and updates.
 */

import archiver from "archiver";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WP_PLUGIN_DIR = join(__dirname, "..", "..", "wp-plugin");
const OUTPUT_DIR = join(__dirname, "..", "public", "downloads");
const OUTPUT_ZIP = join(OUTPUT_DIR, "workforce-seo.zip");
const PLUGIN_FOLDER_NAME = "workforce-seo";

// Sanity check the source exists — bail noisily if the workspace layout
// changes so the build doesn't ship an empty zip.
if (!existsSync(WP_PLUGIN_DIR)) {
  console.error(`✗ Plugin source not found at ${WP_PLUGIN_DIR}`);
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
if (existsSync(OUTPUT_ZIP)) {
  rmSync(OUTPUT_ZIP);
}

const output = createWriteStream(OUTPUT_ZIP);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  const size = statSync(OUTPUT_ZIP).size;
  console.log(
    `✓ Packaged plugin: ${(size / 1024).toFixed(1)} KB → public/downloads/workforce-seo.zip`
  );
});

archive.on("warning", (err) => {
  if (err.code === "ENOENT") {
    console.warn("Archiver warning:", err);
  } else {
    throw err;
  }
});
archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(WP_PLUGIN_DIR, PLUGIN_FOLDER_NAME);
await archive.finalize();
