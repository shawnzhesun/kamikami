// Builds what the installed app runs instead of sources (see electron/service.cjs):
// the service and MCP server as plain JavaScript, the Remotion render bundle,
// and Remotion's pinned headless browser. Run after `vite build`, before
// electron-builder (`npm run dist`).
import { build } from "esbuild";
import { bundle } from "@remotion/bundler";
import { ensureBrowser } from "@remotion/renderer";
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "desktop-build");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Everything else is bundled, so the app ships only "dependencies" from
// node_modules. The Remotion renderer stays there because it locates its
// native compositor package; the rest is development-only (the webpack
// bundler) or replaced by the copies below (ffmpeg, ffprobe).
await build({
  entryPoints: {
    service: path.join(root, "server/index.ts"),
    mcp: path.join(root, "server/mcp-server.ts"),
  },
  outdir: out,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: [
    "@remotion/renderer",
    "@remotion/bundler",
    "ffmpeg-static",
    "ffprobe-static",
  ],
  // Bundled CommonJS packages require Node built-ins.
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
console.log("Built desktop-build/service.mjs and desktop-build/mcp.mjs");

// Compositions use no static files, so skip copying public/ into the bundle.
const emptyPublic = await mkdtemp(path.join(tmpdir(), "kamikami-public-"));
await bundle({
  entryPoint: path.join(root, "src/render.tsx"),
  outDir: path.join(out, "remotion"),
  publicDir: emptyPublic,
});
await rm(emptyPublic, { recursive: true, force: true });
console.log("Built desktop-build/remotion");

// Ship the browser Remotion pins, so exports work offline and nothing is
// downloaded into the signed app at run time.
const status = await ensureBrowser();
if (
  status.type !== "local-puppeteer-browser" &&
  status.type !== "user-defined-path"
)
  throw new Error(`Remotion's browser is unavailable (${status.type}).`);
const browserDir = path.dirname(status.path);
const target = path.join(out, "browser", path.basename(browserDir));
await cp(browserDir, target, { recursive: true, verbatimSymlinks: true });
console.log(
  `Copied the headless browser for ${process.platform}-${process.arch}`,
);

// ffprobe-static carries every platform's binary; ship only this one's.
const require = createRequire(import.meta.url);
await mkdir(path.join(out, "bin"));
const exe = process.platform === "win32" ? ".exe" : "";
await copyFile(require("ffmpeg-static"), path.join(out, "bin", "ffmpeg" + exe));
await copyFile(
  require("ffprobe-static").path,
  path.join(out, "bin", "ffprobe" + exe),
);
for (const tool of ["ffmpeg", "ffprobe"])
  await chmod(path.join(out, "bin", tool + exe), 0o755);
console.log("Copied ffmpeg and ffprobe");

await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      browser: path.relative(
        out,
        path.join(target, path.basename(status.path)),
      ),
      ffmpeg: path.join("bin", "ffmpeg" + exe),
      ffprobe: path.join("bin", "ffprobe" + exe),
      platform: process.platform,
      arch: process.arch,
    },
    null,
    2,
  ) + "\n",
);
