// Builds what the installed app runs instead of sources (see electron/service.cjs):
// the service and MCP server as plain JavaScript, the Remotion render bundle,
// Remotion's pinned headless browser, and LGPL ffmpeg/ffprobe for media
// analysis (scripts/build-ffmpeg.mjs). Run after `vite build`, before
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
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFfmpeg, ensureFfmpeg } from "./build-ffmpeg.mjs";

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

// Media analysis runs its own ffmpeg and ffprobe: LGPL builds from pinned
// sources, never the GPL/nonfree ffmpeg-static used in development. Other
// platforms can pass prebuilt LGPL binaries and their license folder.
const exe = process.platform === "win32" ? ".exe" : "";
const ffmpeg =
  process.env.KAMIKAMI_FFMPEG && process.env.KAMIKAMI_FFPROBE
    ? {
        ffmpeg: process.env.KAMIKAMI_FFMPEG,
        ffprobe: process.env.KAMIKAMI_FFPROBE,
        licenses: process.env.KAMIKAMI_FFMPEG_LICENSES,
      }
    : await ensureFfmpeg();
if (!ffmpeg.licenses)
  throw new Error(
    "Set KAMIKAMI_FFMPEG_LICENSES to the license folder of the ffmpeg build.",
  );
checkFfmpeg(ffmpeg.ffmpeg, ffmpeg.ffprobe);
await mkdir(path.join(out, "bin"));
for (const tool of ["ffmpeg", "ffprobe"]) {
  await copyFile(ffmpeg[tool], path.join(out, "bin", tool + exe));
  await chmod(path.join(out, "bin", tool + exe), 0o755);
}
await cp(ffmpeg.licenses, path.join(out, "licenses", "ffmpeg"), {
  recursive: true,
});
console.log("Copied LGPL ffmpeg and ffprobe");

// Remotion's compositor package (shipped in node_modules) carries its own
// GPLv2+ ffmpeg for exports; record its license, source and configuration.
const require = createRequire(import.meta.url);
const compositor = path.dirname(
  require.resolve(
    `@remotion/compositor-${process.platform}-${process.arch}/package.json`,
  ),
);
const buildconf = execFileSync(
  path.join(compositor, "ffmpeg" + exe),
  ["-hide_banner", "-buildconf"],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      DYLD_LIBRARY_PATH: compositor,
      LD_LIBRARY_PATH: compositor,
    },
  },
);
const { name, version } = require(path.join(compositor, "package.json"));
await writeFile(
  path.join(out, "licenses", "remotion-ffmpeg.md"),
  [
    "# Remotion's ffmpeg",
    "",
    `The video renderer (${name} ${version}, in node_modules) includes FFmpeg and its`,
    "libraries, compiled by Remotion and licensed under the GNU General Public License,",
    "version 2 or later (GPL-2.0.txt in this folder). It includes x264, x265 and fdk-aac-free.",
    "",
    "Source code and build scripts: https://github.com/remotion-dev/rust-ffmpeg-splitter",
    "License details: https://www.remotion.dev/docs/miscellaneous/ffmpeg-license",
    "",
    "Build configuration:",
    "",
    "```",
    buildconf.trim(),
    "```",
    "",
  ].join("\n"),
);
await copyFile(
  path.join(root, "scripts", "licenses", "GPL-2.0.txt"),
  path.join(out, "licenses", "GPL-2.0.txt"),
);
console.log("Wrote third-party license notices");

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
