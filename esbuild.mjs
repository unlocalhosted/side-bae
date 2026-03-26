import * as esbuild from "esbuild";
import { cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Copy webview static assets to dist
function copyWebviewAssets() {
  cpSync(
    join(__dirname, "src", "views", "tour-player", "webview"),
    join(__dirname, "dist", "webview"),
    { recursive: true }
  );
}

const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: !production,
  minify: production,
  plugins: [
    {
      name: "copy-webview-assets",
      setup(build) {
        build.onEnd(() => {
          copyWebviewAssets();
        });
      },
    },
  ],
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
}
