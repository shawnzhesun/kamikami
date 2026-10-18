// Builds the ffmpeg and ffprobe the installed app ships: LGPL only (no GPL or
// nonfree parts), statically linked against nothing outside the OS, with just
// the extras KamiKami uses (LAME for MP3, FreeType and HarfBuzz for drawtext,
// dav1d for AV1, which the native decoder only handles on hardware that has it).
// Video export doesn't use these; Remotion encodes with its own ffmpeg.
//
// Sources are pinned by SHA-256. The result is cached in .cache/ffmpeg/, keyed
// by this file, so a change here rebuilds. Run directly to build or check it:
//   node scripts/build-ffmpeg.mjs
// macOS needs the Xcode command line tools and Python 3.10+ (for meson, which
// dav1d builds with); Linux also needs make and the zlib headers.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = {
  ffmpeg: {
    version: "9.0.2",
    url: "https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz",
    sha256: "8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e",
    license: "LGPL-2.1-or-later",
    licenseFiles: ["COPYING.LGPLv2.1", "LICENSE.md"],
  },
  lame: {
    version: "3.100",
    url: "https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz",
    sha256: "ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e",
    license: "LGPL-2.0-or-later",
    licenseFiles: ["COPYING"],
  },
  freetype: {
    version: "2.15.0",
    url: "https://download.savannah.gnu.org/releases/freetype/freetype-2.15.0.tar.xz",
    sha256: "93cd47eb719c325107f2d3cf087d06299e944c3b48a40b55537302304dea1dd5",
    license: "FTL",
    licenseFiles: ["LICENSE.TXT", "docs/FTL.TXT"],
  },
  harfbuzz: {
    version: "14.6.0",
    url: "https://github.com/harfbuzz/harfbuzz/releases/download/14.6.0/harfbuzz-14.6.0.tar.xz",
    sha256: "d07a007327277708a2a73ae437887cdbaf282937f6d03ca5467723e9099af586",
    license: "MIT",
    licenseFiles: ["COPYING"],
  },
  dav1d: {
    version: "1.5.4",
    url: "https://downloads.videolan.org/pub/videolan/dav1d/1.5.4/dav1d-1.5.4.tar.xz",
    sha256: "686616b7c69eb88d44459391ab25cac13b6647a3b288835c5784e71c1514a5c5",
    license: "BSD-2-Clause",
    licenseFiles: ["COPYING"],
  },
};
/** Build tools for dav1d, installed into the cache with pip. */
const python = ["meson==1.12.1", "ninja==1.13.2"];

const mac = process.platform === "darwin";
const minMac = "12.0";
const ffmpegFlags = [
  "--disable-autodetect",
  "--disable-debug",
  "--disable-doc",
  "--disable-ffplay",
  "--disable-network",
  "--disable-shared",
  "--enable-static",
  "--pkg-config-flags=--static",
  "--enable-zlib",
  "--enable-libmp3lame",
  "--enable-libfreetype",
  "--enable-libharfbuzz",
  "--enable-libdav1d",
  ...(mac ? ["--enable-videotoolbox", "--enable-audiotoolbox"] : []),
];
// What the service asks of ffmpeg (server/analysis/*); checked after a build.
const required = {
  decoders: ["libdav1d"],
  encoders: ["aac", "libmp3lame", "png", "mjpeg", "pcm_f32le"],
  filters: [
    "aformat",
    "blackdetect",
    "drawtext",
    "ebur128",
    "freezedetect",
    "loudnorm",
    "null",
    "pad",
    "scale",
    "select",
    "showinfo",
    "showwavespic",
    "silencedetect",
    "split",
    "vstack",
    "xstack",
  ],
  muxers: ["adts", "f32le", "image2", "ipod", "mp3", "mp4", "null"],
};

const cache = path.join(root, ".cache", "ffmpeg");
const exe = process.platform === "win32" ? ".exe" : "";
const jobs = String(availableParallelism());

function sh(cmd, args, options = {}) {
  execFileSync(cmd, args, {
    stdio: ["ignore", "ignore", "inherit"],
    ...options,
  });
}
function out(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function download(name, { url, sha256 }) {
  const file = path.join(cache, "src", path.basename(url));
  if (!existsSync(file)) {
    await mkdir(path.dirname(file), { recursive: true });
    console.log(`Downloading ${name}`);
    sh("curl", ["-fsSL", "--retry", "3", "-o", file + ".part", url]);
    sh("mv", [file + ".part", file]);
  }
  const actual = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  if (actual !== sha256) {
    await rm(file);
    throw new Error(`${name}: checksum mismatch (got ${actual}).`);
  }
  return file;
}

/** Fails if the binaries are GPL, nonfree, link non-OS libraries or lack a feature KamiKami uses. */
export function checkFfmpeg(ffmpeg, ffprobe) {
  for (const tool of [ffmpeg, ffprobe]) {
    const license = out(tool, ["-hide_banner", "-L"]);
    if (!/GNU Lesser General Public\s+License/.test(license))
      throw new Error(`${tool} is not an LGPL build.`);
    const config = out(tool, ["-hide_banner", "-buildconf"]);
    for (const flag of [
      "--enable-gpl",
      "--enable-nonfree",
      "--enable-version3",
    ])
      if (config.includes(flag))
        throw new Error(`${tool} was built with ${flag}.`);
    if (mac) {
      const libs = out("otool", ["-L", tool])
        .split("\n")
        .slice(1)
        .map((l) => l.trim().split(" ")[0])
        .filter(Boolean);
      const foreign = libs.filter(
        (l) => !l.startsWith("/usr/lib/") && !l.startsWith("/System/"),
      );
      if (foreign.length)
        throw new Error(
          `${tool} links libraries users don't have: ${foreign.join(", ")}`,
        );
    }
  }
  for (const [kind, names] of Object.entries(required)) {
    const list = out(ffmpeg, ["-hide_banner", `-${kind}`]);
    const missing = names.filter(
      (n) => !new RegExp(`^\\s*\\S+\\s+${n}(\\s|,|$)`, "m").test(list),
    );
    if (missing.length)
      throw new Error(`ffmpeg lacks ${kind}: ${missing.join(", ")}`);
  }
}

/** Builds (or reuses) the LGPL binaries; returns their paths and the notice folder. */
export async function ensureFfmpeg() {
  const key = createHash("sha256")
    .update(await readFile(fileURLToPath(import.meta.url)))
    .update(`${process.platform}-${process.arch}`)
    .digest("hex")
    .slice(0, 12);
  const dir = path.join(cache, `${process.platform}-${process.arch}-${key}`);
  const result = {
    ffmpeg: path.join(dir, "bin", "ffmpeg" + exe),
    ffprobe: path.join(dir, "bin", "ffprobe" + exe),
    licenses: path.join(dir, "licenses"),
  };
  if (existsSync(path.join(dir, "done"))) return result;
  if (process.platform === "win32")
    throw new Error(
      "Building ffmpeg on Windows isn't supported; set KAMIKAMI_FFMPEG and KAMIKAMI_FFPROBE to LGPL builds.",
    );

  await rm(dir, { recursive: true, force: true });
  const work = path.join(dir, "work"),
    prefix = path.join(dir, "prefix");
  await mkdir(work, { recursive: true });
  await mkdir(path.join(prefix, "lib", "pkgconfig"), { recursive: true });
  const unpacked = {};
  for (const [name, source] of Object.entries(sources)) {
    const file = await download(name, source);
    sh("tar", ["-xf", file, "-C", work]);
    unpacked[name] = path.join(work, `${name}-${source.version}`);
  }

  const cflags = `-O2${mac ? ` -mmacosx-version-min=${minMac}` : ""} -I${prefix}/include`;
  const env = {
    ...process.env,
    CFLAGS: cflags,
    CXXFLAGS: cflags,
    LDFLAGS: `${mac ? `-mmacosx-version-min=${minMac} ` : ""}-L${prefix}/lib`,
    // Only the libraries built here; never Homebrew's or the system's .pc files.
    PKG_CONFIG_LIBDIR: path.join(prefix, "lib", "pkgconfig"),
    PKG_CONFIG_PATH: "",
    ...(mac ? { MACOSX_DEPLOYMENT_TARGET: minMac } : {}),
  };
  const build = (cwd, configure) => {
    sh("./configure", [`--prefix=${prefix}`, ...configure], { cwd, env });
    sh("make", [`-j${jobs}`], { cwd, env });
    sh("make", ["install"], { cwd, env });
  };

  console.log(`Building LAME ${sources.lame.version}`);
  // Exported but not defined in 3.100; breaks linking with clang.
  const sym = path.join(unpacked.lame, "include", "libmp3lame.sym");
  await writeFile(
    sym,
    (await readFile(sym, "utf8")).replace("lame_init_old\n", ""),
  );
  build(unpacked.lame, [
    "--disable-shared",
    "--enable-static",
    "--disable-frontend",
    "--disable-gtktest",
  ]);

  console.log(`Building FreeType ${sources.freetype.version}`);
  build(unpacked.freetype, [
    "--disable-shared",
    "--enable-static",
    "--with-zlib=no",
    "--with-bzip2=no",
    "--with-png=no",
    "--with-harfbuzz=no",
    "--with-brotli=no",
  ]);

  // HarfBuzz builds with meson; its single-file amalgamation needs only a
  // C++ compiler, so the generated header and .pc file are written here.
  console.log(`Building HarfBuzz ${sources.harfbuzz.version}`);
  const hb = path.join(unpacked.harfbuzz, "src");
  const features = (
    await readFile(path.join(hb, "hb-features.h.in"), "utf8")
  ).replace(/#mesondefine (\w+)/g, (_, name) =>
    name === "HB_HAS_FREETYPE" ? `#define ${name} 1` : `/* #undef ${name} */`,
  );
  await writeFile(path.join(hb, "hb-features.h"), features);
  sh(
    "c++",
    [
      "-std=c++17",
      ...cflags.split(" "),
      `-I${prefix}/include/freetype2`,
      "-DHAVE_FREETYPE=1",
      "-fno-exceptions",
      "-fno-rtti",
      "-c",
      "harfbuzz.cc",
      "-o",
      path.join(work, "harfbuzz.o"),
    ],
    { cwd: hb, env },
  );
  sh("ar", [
    "rcs",
    path.join(prefix, "lib", "libharfbuzz.a"),
    path.join(work, "harfbuzz.o"),
  ]);
  await mkdir(path.join(prefix, "include", "harfbuzz"), { recursive: true });
  for (const name of await readdir(hb))
    if (/^hb.*\.h$/.test(name))
      await copyFile(
        path.join(hb, name),
        path.join(prefix, "include", "harfbuzz", name),
      );
  await writeFile(
    path.join(prefix, "lib", "pkgconfig", "harfbuzz.pc"),
    [
      `prefix=${prefix}`,
      "Name: harfbuzz",
      "Description: HarfBuzz text shaping library",
      `Version: ${sources.harfbuzz.version}`,
      "Requires.private: freetype2",
      `Libs: -L\${prefix}/lib -lharfbuzz ${mac ? "-lc++" : "-lstdc++ -lm"}`,
      "Cflags: -I${prefix}/include/harfbuzz",
      "",
    ].join("\n"),
  );

  console.log(`Building dav1d ${sources.dav1d.version}`);
  const tools = path.join(cache, "tools");
  if (!existsSync(path.join(tools, "bin", "meson"))) {
    sh("python3", ["-m", "venv", tools]);
    // Ignore the machine's pip configuration (private indexes, proxies).
    sh(path.join(tools, "bin", "pip"), [
      "install",
      "--isolated",
      "--quiet",
      "--index-url",
      "https://pypi.org/simple",
      ...python,
    ]);
  }
  const toolEnv = { ...env, PATH: `${path.join(tools, "bin")}:${env.PATH}` };
  sh(
    "meson",
    [
      "setup",
      "build",
      `--prefix=${prefix}`,
      "--libdir=lib",
      "--buildtype=release",
      "--default-library=static",
      "-Denable_tools=false",
      "-Denable_tests=false",
    ],
    { cwd: unpacked.dav1d, env: toolEnv },
  );
  sh("ninja", ["-C", "build", "install"], {
    cwd: unpacked.dav1d,
    env: toolEnv,
  });

  console.log(
    `Building FFmpeg ${sources.ffmpeg.version} (LGPL); this takes a few minutes`,
  );
  build(unpacked.ffmpeg, [
    ...ffmpegFlags,
    `--extra-cflags=${cflags}`,
    `--extra-ldflags=${env.LDFLAGS}`,
  ]);

  await mkdir(path.join(dir, "bin"));
  for (const tool of ["ffmpeg", "ffprobe"]) {
    const target = path.join(dir, "bin", tool + exe);
    await copyFile(path.join(prefix, "bin", tool + exe), target);
    sh("strip", [target]);
  }
  checkFfmpeg(result.ffmpeg, result.ffprobe);

  // LGPL: ship the license texts and say where the exact source comes from.
  await mkdir(result.licenses);
  const lines = [
    "# ffmpeg and ffprobe",
    "",
    "KamiKami ships ffmpeg and ffprobe built from unmodified upstream sources by",
    "`scripts/build-ffmpeg.mjs` in the KamiKami repository",
    "(https://github.com/shawnzhesun/kamikami), which pins every source below by SHA-256.",
    "Running that script rebuilds these exact binaries; the sources are available at the URLs below.",
    "",
    `FFmpeg configuration: ${ffmpegFlags.join(" ")}`,
    "",
    "| Component | Version | License | Source | SHA-256 |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [name, source] of Object.entries(sources)) {
    lines.push(
      `| ${name} | ${source.version} | ${source.license} | ${source.url} | ${source.sha256} |`,
    );
    for (const file of source.licenseFiles) {
      const from = path.join(unpacked[name], file);
      if (existsSync(from) && (await stat(from)).isFile())
        await copyFile(
          from,
          path.join(result.licenses, `${name}-${path.basename(file)}`),
        );
    }
  }
  lines.push(
    "",
    "Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved.",
    "",
  );
  await writeFile(path.join(result.licenses, "README.md"), lines.join("\n"));

  await rm(work, { recursive: true, force: true });
  await rm(prefix, { recursive: true, force: true });
  await writeFile(path.join(dir, "done"), "");
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await ensureFfmpeg();
  checkFfmpeg(result.ffmpeg, result.ffprobe);
  console.log(
    `LGPL ffmpeg and ffprobe ready:\n  ${result.ffmpeg}\n  ${result.ffprobe}`,
  );
}
