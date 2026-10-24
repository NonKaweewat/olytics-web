import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root (a stray lockfile in the home folder confuses Next's detection).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // a second server (e.g. a test run) can use its own build folder: NEXT_DIST_DIR=.next-test
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PGlite loads its WASM from disk, so it must not be bundled.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};
export default nextConfig;
