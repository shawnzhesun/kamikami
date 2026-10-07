const { ipcMain, safeStorage, app } = require("electron");
const {
  readFile,
  writeFile,
  rename,
  unlink,
  mkdir,
} = require("node:fs/promises");
const path = require("node:path");

module.exports = async function installAssistantCredentials() {
  const filename = path.join(
    app.getPath("userData"),
    "assistant-connection.enc",
  );
  let connection = null;
  let updating = false;
  const encryptedStorage = () =>
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text");
  async function api(method, body) {
    const response = await fetch(
      "http://127.0.0.1:4318/api/assistant/settings",
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-KamiKami": "desktop",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      const value = await response.json();
      throw new Error(
        value.error || "Could not update the assistant connection.",
      );
    }
  }
  function checkSender(event) {
    if (
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      new URL(event.senderFrame.url).origin !== "http://127.0.0.1:5173"
    ) {
      throw new Error("Only the editor can change the assistant connection.");
    }
  }
  try {
    if (encryptedStorage())
      connection = {
        name: "OpenAI",
        baseURL: "https://api.openai.com/v1",
        apiMode: "responses",
        ...JSON.parse(safeStorage.decryptString(await readFile(filename))),
      };
  } catch {
    /* An absent or inaccessible key leaves setup available in the panel. */
  }

  ipcMain.handle("assistant:save-settings", async (event, input) => {
    checkSender(event);
    if (updating)
      throw new Error(
        "The connection is being updated. Try again in a moment.",
      );
    if (
      !input ||
      typeof input.model !== "string" ||
      !/^[^\u0000-\u001f\u007f]{1,200}$/.test(input.model) ||
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 100 ||
      typeof input.baseURL !== "string" ||
      input.baseURL.length > 500 ||
      !["chat", "responses"].includes(input.apiMode) ||
      (input.apiKey !== undefined &&
        (typeof input.apiKey !== "string" ||
          input.apiKey.length < 1 ||
          input.apiKey.length > 1000))
    ) {
      throw new Error("Enter a model name and valid API key.");
    }
    const endpoint = new URL(input.baseURL);
    if (
      (endpoint.protocol !== "https:" &&
        !(
          endpoint.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
        )) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error(
        "Enter an HTTPS base URL (HTTP is supported for localhost).",
      );
    }
    const baseURL = endpoint.href.replace(/\/+$/, "");
    updating = true;
    try {
      const next = {
        model: input.model,
        name: input.name,
        baseURL,
        apiMode: input.apiMode,
        reuseKey: input.reuseKey === true,
        apiKey:
          input.apiKey ||
          (input.reuseKey === true ||
          (connection?.baseURL || "https://api.openai.com/v1") === baseURL
            ? connection?.apiKey
            : undefined),
      };
      const secure = !!next.apiKey && encryptedStorage();
      await api("POST", { ...next, keyStorage: secure ? "secure" : "session" });
      if (secure) {
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(
          filename + ".tmp",
          safeStorage.encryptString(JSON.stringify(next)),
          { mode: 0o600 },
        );
        await rename(filename + ".tmp", filename);
        connection = next;
      } else {
        connection = null;
        await unlink(filename).catch(() => {});
      }
    } finally {
      updating = false;
    }
  });
  ipcMain.handle("assistant:clear-settings", async (event) => {
    checkSender(event);
    if (updating)
      throw new Error(
        "The connection is being updated. Try again in a moment.",
      );
    updating = true;
    try {
      await api("DELETE");
      connection = null;
      await unlink(filename).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    } finally {
      updating = false;
    }
  });
  async function reconnect() {
    if (!connection || updating) return;
    updating = true;
    try {
      const response = await fetch("http://127.0.0.1:4318/api/assistant", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok && !(await response.json()).configured)
        await api("POST", { ...connection, keyStorage: "secure" });
    } catch {
      /* The local server may be restarting. */
    } finally {
      updating = false;
    }
  }
  await reconnect();
  const timer = setInterval(() => void reconnect(), 5000);
  timer.unref();
  app.once("will-quit", () => clearInterval(timer));
};
