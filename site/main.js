// The download links already point at the latest release; this only adds
// its version and size, and degrades to the static text if the API fails.
const repo = "shawnzhesun/kamikami";
const asset = "KamiKami-mac-arm64.dmg";

fetch(`https://api.github.com/repos/${repo}/releases/latest`)
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
  .then((release) => {
    const dmg = release.assets?.find((a) => a.name === asset);
    if (!dmg) return;
    const size = `${Math.round(dmg.size / 1024 ** 2)} MB`;
    for (const link of document.querySelectorAll("[data-download]"))
      link.href = dmg.browser_download_url;
    const info = document.querySelector("[data-release]");
    if (info)
      info.textContent = `${release.tag_name} · ${size} · Apple Silicon · macOS 12 or later · Free and MIT licensed`;
  })
  .catch(() => {});

for (const button of document.querySelectorAll("[data-copy]"))
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy)?.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy";
    }
    setTimeout(() => (button.textContent = "Copy"), 1600);
  });

// Respect reduced motion: show the poster until the visitor plays the video.
if (matchMedia("(prefers-reduced-motion: reduce)").matches)
  for (const video of document.querySelectorAll("video[autoplay]")) {
    video.removeAttribute("autoplay");
    video.pause();
    video.controls = true;
  }
