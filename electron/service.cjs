const { app, utilityProcess } = require("electron");
const { createWriteStream, readFileSync } = require("node:fs");
const { mkdir, rename } = require("node:fs/promises");
const path = require("node:path");
const { appRoot, serviceOrigin } = require("./runtime.cjs");

async function healthy() {
  try {
    const response = await fetch(serviceOrigin + "/api/health", {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Run the built local service (scripts/build-desktop.mjs) as a child of the
 * app, so an installed KamiKami needs no Node, sources or terminal. It lives
 * and dies with the app; MCP clients reach it on the usual port.
 */
module.exports = async function startService() {
  const build = path.join(appRoot, "desktop-build");
  const logs = path.join(app.getPath("userData"), "logs");
  const log = path.join(logs, "service.log");
  if (await healthy())
    throw new Error(
      `Another KamiKami service is already running on ${serviceOrigin}. Quit it (for example a development copy) and open KamiKami again.`,
    );
  await mkdir(logs, { recursive: true });
  await rename(log, path.join(logs, "service.previous.log")).catch(() => {});
  const output = createWriteStream(log);
  const manifest = JSON.parse(
    readFileSync(path.join(build, "manifest.json"), "utf8"),
  );
  const child = utilityProcess.fork(path.join(build, "service.mjs"), [], {
    serviceName: "KamiKami service",
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      KAMIKAMI_DATA:
        process.env.KAMIKAMI_DATA ||
        path.join(app.getPath("userData"), "workspace"),
      KAMIKAMI_EDITOR_DIST: path.join(appRoot, "dist"),
      KAMIKAMI_RENDER_BUNDLE: path.join(build, "remotion"),
      KAMIKAMI_BROWSER: path.join(build, manifest.browser),
      KAMIKAMI_FFMPEG: path.join(build, manifest.ffmpeg),
      KAMIKAMI_FFPROBE: path.join(build, manifest.ffprobe),
      KAMIKAMI_MCP_COMMAND: app.isPackaged
        ? path.join(
            process.resourcesPath,
            "bin",
            process.platform === "win32" ? "kamikami-mcp.cmd" : "kamikami-mcp",
          )
        : "",
    },
  });
  child.stdout?.pipe(output);
  child.stderr?.pipe(output);
  let exited = false;
  child.once("exit", (code) => {
    exited = true;
    output.end(`\nService exited (${code}).\n`);
  });
  app.once("will-quit", () => child.kill());
  // Startup loads the effect library, fonts and the analysis queue.
  for (let i = 0; i < 120 && !exited; i++) {
    if (await healthy()) return { log };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`The KamiKami service did not start. See ${log}.`);
};
