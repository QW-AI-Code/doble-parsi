import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { LRE, PDF, RLE, RLM, forFile, rtlLineForFile, stripBidiControls } from "../src/bidi.js";
import { subtitleFile, toSrt, toVtt } from "../src/captions.js";
import { isFresh, keyTag, MODEL_CACHE_TTL_MS, pickModel } from "../src/model-cache.js";
import { TrackTranslator } from "../src/translate-client.js";

const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), "utf8");

/* ── 4) RTL subtitles in external players ─────────────────────────────── */

test("a Persian line is wrapped in RTL embedding for external players", () => {
  const out = rtlLineForFile("این یک جمله است.");
  assert.ok(out.startsWith(`${RLM}${RLE}`));
  assert.ok(out.endsWith(`${PDF}${RLM}`));
  assert.equal(stripBidiControls(out), "این یک جمله است.");
});

test("Latin runs inside Persian get their own LTR embedding, punctuation stays outside", () => {
  const out = rtlLineForFile("از Node.js.");
  assert.ok(out.includes(`${LRE}Node.js${PDF}.`), JSON.stringify(out));
  const two = rtlLineForFile("روی Windows 11 و GitHub Actions");
  assert.ok(two.includes(`${LRE}Windows 11${PDF}`));
  assert.ok(two.includes(`${LRE}GitHub Actions${PDF}`));
});

test("Latin-only lines and empty lines are left alone", () => {
  assert.equal(rtlLineForFile("hello world."), "hello world.");
  assert.equal(forFile("hello\n\nworld"), "hello\nworld");
});

test("old isolates are replaced, never stacked", () => {
  const once = rtlLineForFile("روی \u2066Windows\u2069 نصب کن");
  assert.equal(once.includes("\u2066"), false);
  assert.equal(rtlLineForFile(once), once);
});

test("SRT and VTT files carry a BOM and RTL-fixed text", () => {
  const cues = [{ start: 0, end: 1500, text: "سلام دنیا." }];
  const srt = subtitleFile("srt", cues);
  const vtt = subtitleFile("vtt", cues);
  assert.ok(srt.startsWith("\uFEFF1\n00:00:00,000 --> 00:00:01,500\n"));
  assert.ok(vtt.startsWith("\uFEFFWEBVTT\n\n"));
  assert.ok(srt.includes(`${RLM}${RLE}سلام دنیا.${PDF}${RLM}`));
  assert.ok(vtt.includes(RLE));
  // the plain converters stay usable without the fix
  assert.ok(toSrt(cues, { rtl: false }).includes("\nسلام دنیا.\n"));
  assert.ok(toVtt(cues, { rtl: false }).includes("\nسلام دنیا.\n"));
});

test("a cue never produces a blank line that would end the SRT block early", () => {
  const srt = toSrt([{ start: 0, end: 1000, text: "یک\n\nدو" }]);
  const block = srt.split("\n").slice(2, 4);
  assert.equal(block.every((line) => line.trim().length > 0), true);
});

/* ── 2) automatic model discovery ─────────────────────────────────────── */

test("the key fingerprint is short, stable and never the key itself", async () => {
  const a = await keyTag("AIzaSyExample");
  const b = await keyTag("AIzaSyExample");
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.equal(a.includes("AIza"), false);
  assert.equal(await keyTag(""), "");
  assert.notEqual(await keyTag("another"), a);
});

test("the cache is only trusted for the same key and while fresh", async () => {
  const tag = await keyTag("k1");
  const entry = { tag, at: Date.now(), models: [{ id: "gemini-flash-lite-latest" }] };
  assert.equal(isFresh(entry, tag), true);
  assert.equal(isFresh(entry, await keyTag("k2")), false);
  assert.equal(isFresh({ ...entry, at: Date.now() - MODEL_CACHE_TTL_MS - 1 }, tag), false);
  assert.equal(isFresh({ ...entry, models: [] }, tag), false);
  assert.equal(isFresh(null, tag), false);
});

test("automatic mode picks the thriftiest working model, a manual pick is respected", () => {
  const models = [{ id: "lite" }, { id: "flash" }];
  assert.deepEqual(pickModel(models, ""), { model: "lite", fallbacks: ["flash"] });
  assert.deepEqual(pickModel(models, "flash"), { model: "flash", fallbacks: ["lite"] });
  assert.deepEqual(pickModel(models, "custom"), { model: "custom", fallbacks: ["lite", "flash"] });
  assert.deepEqual(pickModel([], ""), { model: "", fallbacks: [] });
});

test("a model with a zero free-tier quota is skipped for the next verified model", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? "";
    seen.push(model);
    if (model === "no-free-tier") {
      const body = JSON.stringify({ error: {
        code: 429, status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: no-free-tier"
      } });
      return { ok: false, status: 429, text: async () => body, json: async () => JSON.parse(body) };
    }
    const rows = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    return {
      ok: true, status: 200, text: async () => "",
      json: async () => ({ candidates: [{
        content: { parts: [{ text: JSON.stringify(rows.map((row) => ({ i: row.i, t: `ت${row.i}` }))) }] },
        finishReason: "STOP"
      }] })
    };
  };
  try {
    const translator = new TrackTranslator({
      apiKey: "k", targetLanguage: "Persian", model: "no-free-tier", fallbacks: ["works-here"]
    });
    const out = await translator.translate(["one", "two", "three"]);
    assert.deepEqual(out, ["ت0", "ت1", "ت2"]);
    assert.equal(seen[0], "no-free-tier");
    assert.equal(seen.at(-1), "works-here");
    assert.equal(translator.model, "works-here");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the subtitle pipeline asks for a working model before translating", async () => {
  const pipeline = await read("src/track-pipeline.js");
  assert.ok(pipeline.includes("resolveModel"));
  const worker = await read("src/service-worker.js");
  assert.ok(worker.includes("resolveTextModel"));
  assert.ok(worker.includes("probeModels("));
  assert.ok(worker.includes("writeModelCache("));
});

/* ── 1) model list lives in the "API key and language" section ─────────── */

test("the model picker sits inside the API key section", async () => {
  const html = await read("src/popup.html");
  const start = html.indexOf('data-section="keys"');
  const end = html.indexOf("</details>", start);
  const keys = html.slice(start, end);
  for (const id of ['id="textModel"', 'id="modelProbe"', 'id="modelStatus"']) {
    assert.ok(keys.includes(id), `${id} must be in the API key section`);
    assert.equal(html.split(id).length - 1, 1, `${id} must exist exactly once`);
  }
});

/* ── 3) export survives a closed popup / sleeping worker ──────────────── */

test("the stage track survives a service-worker restart", async () => {
  const worker = await read("src/service-worker.js");
  assert.ok(worker.includes("TRACK_KEY"));
  assert.ok(worker.includes("setTrackCues("));
  assert.ok(worker.includes("const restoring ="));
  assert.ok(/chrome\.storage\.session\?\.get\(\[STATE_KEY, TRACK_KEY\]\)/.test(worker));
  // no direct reset of the cues bypasses persistence any more
  assert.equal((worker.match(/^\s+trackCues = \[\]/gm) ?? []).length, 0);
});

test("subtitles can be saved from the YouTube quick panel", async () => {
  const panel = await read("src/overlay/yt-controls.js");
  assert.ok(panel.includes("dp-mini-save"));
  const worker = await read("src/service-worker.js");
  assert.ok(worker.includes('"dp-mini-save"'));
});
