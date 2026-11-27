import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * The service worker is loaded against a fake `chrome.*` whose session storage
 * still holds what a previous worker life left behind (popup closed, worker put to
 * sleep). The subtitle state, the cues and the save path must all come back.
 */
const session = new Map();
const local = new Map();
const listeners = { message: [] };
const downloads = [];
const store = (map) => ({
  async get(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    const out = {};
    for (const k of list) if (map.has(k)) out[k] = structuredClone(map.get(k));
    return out;
  },
  async set(obj) { for (const [k, v] of Object.entries(obj)) map.set(k, structuredClone(v)); },
  async remove(k) { map.delete(k); }
});
const ev = () => ({ addListener() {} });
globalThis.chrome = {
  storage: { session: store(session), local: store(local), onChanged: ev() },
  runtime: {
    onMessage: { addListener: (fn) => listeners.message.push(fn) },
    onStartup: ev(),
    sendMessage: async () => undefined,
    getContexts: async () => []
  },
  tabs: {
    get: async (id) => (id === 7 ? { id: 7, title: "Video - YouTube", url: "https://www.youtube.com/watch?v=x" } : Promise.reject(new Error("no tab"))),
    query: async () => [{ id: 7, url: "https://www.youtube.com/watch?v=x" }],
    sendMessage: async () => null,
    onRemoved: ev(), onUpdated: ev()
  },
  scripting: { executeScript: async () => [{ result: "My Video" }] },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  downloads: {
    download: async (o) => { downloads.push(o); return downloads.length; },
    onDeterminingFilename: ev(),
    showDefaultFolder() {}
  },
  offscreen: {}
};

// pretend a previous worker life left this behind
session.set("dubleParsiState", {
  phase: "idle", stagePhase: "track", stageTabId: 7, files: [], notices: [], transcript: "",
  track: { count: 2, lang: "en", method: "player", origin: "translated", fromMemory: 0, translated: 2 }
});
session.set("dubleParsiTrack", {
  tabId: 7,
  cues: [
    { start: 0, end: 1000, text: "سلام از Node.js.", source: "hello from Node.js." },
    { start: 1000, end: 2000, text: "خداحافظ", source: "bye" }
  ]
});

await import("../src/service-worker.js");
const listener = listeners.message.at(-1);
const call = (message) => new Promise((resolve) => {
  const keep = listener(message, {}, resolve);
  if (keep !== true) setTimeout(() => resolve("(sync)"), 0);
});

test("a sleeping worker brings the on-video subtitle back and can still save it", async () => {
  const got = await call({ type: "dp-get-state" });
  assert.equal(got?.state?.stagePhase, "track");
  assert.equal(got?.state?.stageTabId, 7);

  const saved = await call({ type: "dp-stage-save" });
  assert.equal(saved?.ok, true);
  assert.deepEqual(saved.files.map((file) => file.filename), ["Doble Parsi/My Video/My Video.srt"]);

  const text = Buffer.from(String(downloads[0]?.url ?? "").split(",")[1] ?? "", "base64").toString("utf8");
  assert.equal(text.charCodeAt(0), 0xfeff, "BOM");
  assert.ok(text.includes("\u202b"), "RTL embedding");
  assert.ok(text.includes("\u202aNode.js\u202c."), "Latin run embedded, full stop outside");

  const mini = await call({ type: "dp-mini-get" });
  assert.equal(mini?.stagePhase, "track");

  const panelSave = await call({ type: "dp-mini-save" });
  assert.equal(panelSave?.ok, true);
  assert.equal(panelSave?.saved, 1);
});

test("messages that are not for the worker are not held open", () => {
  assert.equal(listener({ type: "something-else" }, {}, () => {}), false);
  assert.equal(listener({ type: "dp-off-ping" }, {}, () => {}), false);
});
