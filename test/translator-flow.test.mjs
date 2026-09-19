import assert from "node:assert/strict";
import { test } from "node:test";
import { TrackTranslator } from "../src/translate-client.js";

/**
 * Ablauftests mit gefälschtem `fetch`: Wie verhält sich der Übersetzer bei
 * abgeschnittener Antwort, bei 429 und bei einem fehlenden Modell?
 */

const realFetch = globalThis.fetch;

/** Antwort im Format, das die Gemini-REST-API liefert */
function reply(rows, { finishReason = "STOP", usage = null } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(rows) }] }, finishReason }],
      ...(usage ? { usageMetadata: usage } : {})
    }),
    text: async () => ""
  };
}

function failure(status, message, extra = {}) {
  const body = JSON.stringify({ error: { code: status, message, ...extra } });
  return { ok: false, status, text: async () => body, json: async () => JSON.parse(body) };
}

/** Der Aufrufzähler nimmt jede Anfrage samt Modell und Zeilenzahl auf */
function install(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? "";
    const body = JSON.parse(options.body);
    const lines = JSON.parse(body.contents[0].parts[0].text);
    calls.push({ model, count: lines.length });
    return handler({ model, lines, calls });
  };
  return calls;
}

const make = (options = {}) => new TrackTranslator({
  apiKey: "test-key",
  targetLanguage: "Persian (Farsi)",
  ...options
});

const lines = (n) => Array.from({ length: n }, (_, i) => `sentence number ${i} on screen`);
const translate = (rows) => rows.map((row) => ({ i: row.i, t: `ترجمهٔ ${row.i}` }));

test("the happy path returns one translation per line", async () => {
  const calls = install(({ lines: rows }) => reply(translate(rows)));
  try {
    const out = await make().translate(lines(10));
    assert.equal(out.length, 10);
    assert.equal(out[0], "ترجمهٔ 0");
    assert.equal(calls.length, 1, "ten lines must not cost more than one request");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a truncated answer halves the batch instead of falling back to English", async () => {
  // Alles mit mehr als 20 Zeilen wird abgeschnitten, kleinere Pakete gehen durch
  const calls = install(({ lines: rows }) => (
    rows.length > 20
      ? reply(translate(rows).slice(0, 3), { finishReason: "MAX_TOKENS" })
      : reply(translate(rows))
  ));
  try {
    const source = lines(40);
    const out = await make().translate(source);
    assert.equal(out.length, 40);
    // Keine einzige Zeile darf als unübersetzter Quelltext durchkommen
    assert.equal(out.filter((text, i) => text === source[i]).length, 0);
    assert.ok(calls.length >= 3, "the oversized batch must have been split");
    assert.ok(calls.some((call) => call.count <= 20), "a smaller sub-batch must exist");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a hopeless batch is given up on, not split forever", async () => {
  // Jede Antwort ist abgeschnitten, auch die kleinste: Teilen kann nichts retten
  const calls = install(({ lines: rows }) => reply(translate(rows), { finishReason: "MAX_TOKENS" }));
  try {
    const translator = make();
    // Kein Paket kam durch, also muss ein Fehler kommen und nicht stiller Quelltext
    await assert.rejects(() => translator.translate(lines(60)));
    assert.ok(calls.length <= 8, `too many attempts on a hopeless batch: ${calls.length}`);
    assert.ok(translator.hopelessAt > 0, "the useless batch size must be remembered");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a missing model moves on to the next candidate", async () => {
  const calls = install(({ model, lines: rows }) => (
    model === "does-not-exist"
      ? failure(404, "models/does-not-exist is not found")
      : reply(translate(rows))
  ));
  try {
    let used = "";
    const out = await make({ model: "does-not-exist", onModel: (m) => { used = m; } }).translate(lines(5));
    assert.equal(out[0], "ترجمهٔ 0");
    assert.notEqual(used, "does-not-exist");
    assert.equal(calls[0].model, "does-not-exist", "the configured model is tried first");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a quota refusal is reported with its retry delay and stops the grind", async () => {
  const seen = [];
  install(() => failure(429, "You exceeded your current quota, please retry in 21s", {
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "21s" }]
  }));
  try {
    const translator = make({ onQuota: (message, retryMs) => seen.push({ message, retryMs }) });
    translator.paceUntil = 0;
    await assert.rejects(() => translator.translate(lines(30)), (error) => error.code === "err.quota");
    assert.ok(seen.length >= 1, "the quota callback must fire");
    assert.equal(seen[0].retryMs, 21000, "the delay the service asked for is used");
    assert.equal(translator.concurrency, 1, "concurrency must drop to a single request");
    assert.ok(translator.quotaHits >= 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("what was translated survives when the quota runs out mid-way", async () => {
  let served = 0;
  install(({ lines: rows }) => {
    served += 1;
    // Das erste Paket geht durch, danach ist die Quote erschöpft
    return served === 1
      ? reply(translate(rows))
      : failure(429, "quota exhausted", { status: "RESOURCE_EXHAUSTED" });
  });
  try {
    const source = lines(200);
    const translator = make();
    translator.paceUntil = 0;
    const out = await translator.translate(source);
    const done = out.filter((text, i) => text !== source[i]).length;
    assert.ok(done > 0, "the finished part must be kept");
    assert.ok(done < source.length, "and the rest must stay recognisable as source text");
    assert.ok(translator.quotaHits > 0);
    assert.ok(translator.stats.ok >= 1 && translator.stats.failed >= 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a rejected key fails immediately and is not retried", async () => {
  const calls = install(() => failure(403, "API key not valid"));
  try {
    await assert.rejects(() => make().translate(lines(5)), (error) => error.code === "err.badKey");
    assert.equal(calls.length, 1, "a bad key must not be retried");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("token usage is reported from the answer", async () => {
  const samples = [];
  install(({ lines: rows }) => reply(translate(rows), {
    usage: { promptTokenCount: 800, candidatesTokenCount: 250, totalTokenCount: 1050 }
  }));
  try {
    await make({ onUsage: (sample) => samples.push(sample) }).translate(lines(6));
    assert.equal(samples.length, 1);
    assert.equal(samples[0].promptTokens, 800);
    assert.equal(samples[0].totalTokens, 1050);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("an empty key never reaches the network", async () => {
  const calls = install(() => reply([]));
  try {
    await assert.rejects(
      () => new TrackTranslator({ apiKey: "", targetLanguage: "Persian" }).translate(lines(3)),
      (error) => error.code === "err.noKey"
    );
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
