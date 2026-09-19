import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TEXT_MODEL, MODEL_FALLBACKS, alignTranslations, buildInstructions, planBatches, sanitizeTone
} from "../src/translate-client.js";
import { canonical, hashText, lineId, trackId } from "../src/memory.js";

test("batches are big, because fewer requests is what beats a rate limit", () => {
  const many = Array.from({ length: 240 }, (_, i) => `line number ${i}`);
  const batches = planBatches(many);
  // 240 kurze Zeilen duerfen nicht in Dutzende Anfragen zerfallen
  assert.ok(batches.length <= 4, `expected at most 4 requests, got ${batches.length}`);
  for (const batch of batches) assert.ok(batch.length <= 80);
  assert.equal(batches.flat().length, 240);

  const long = ["x".repeat(5000), "y".repeat(5000)];
  assert.equal(planBatches(long, { maxChars: 6000 }).length, 2);
});

test("a single oversized line still ships in its own batch", () => {
  const batches = planBatches(["z".repeat(9000)], { maxChars: 100 });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 1);
});

test("batch entries keep their position in the original list", () => {
  const batches = planBatches(["a", "b", "c"], { maxLines: 2 });
  assert.deepEqual(batches[0].map((item) => item.index), [0, 1]);
  assert.deepEqual(batches[1].map((item) => item.index), [2]);
});

test("the model answer is realigned by index, not by order", () => {
  const batch = [{ index: 0, text: "one" }, { index: 1, text: "two" }];
  const rows = [{ i: 1, t: "دو" }, { i: 0, t: "یک" }];
  assert.deepEqual(alignTranslations(batch, rows), ["یک", "دو"]);
});

test("a missing or empty line falls back to the source text", () => {
  const batch = [{ index: 0, text: "keep me" }, { index: 1, text: "and me" }];
  assert.deepEqual(alignTranslations(batch, [{ i: 0, t: "" }]), ["keep me", "and me"]);
  assert.deepEqual(alignTranslations(batch, null), ["keep me", "and me"]);
  assert.deepEqual(alignTranslations(batch, "garbage"), ["keep me", "and me"]);
});

test("a one-based answer is tolerated", () => {
  const batch = [{ index: 0, text: "one" }, { index: 1, text: "two" }];
  assert.deepEqual(alignTranslations(batch, [{ i: 1, t: "یک" }, { i: 2, t: "دو" }]), ["یک", "دو"]);
});

test("the default model is a dateless alias, so it cannot rot", () => {
  assert.match(DEFAULT_TEXT_MODEL, /^[\w.-]+$/);
  assert.match(DEFAULT_TEXT_MODEL, /latest$/);
  assert.ok(MODEL_FALLBACKS.includes(DEFAULT_TEXT_MODEL));
  assert.ok(MODEL_FALLBACKS.length >= 2, "a single candidate leaves no way out of a 404");
});

test("the tone the user typed is trimmed, flattened and capped", () => {
  assert.equal(sanitizeTone("  محاوره‌ای   و  خودی \n"), "محاوره‌ای و خودی");
  assert.equal(sanitizeTone("a\u0000b"), "a b");
  assert.equal(sanitizeTone("x".repeat(900)).length, 400);
  assert.equal(sanitizeTone(null), "");
});

test("the instructions never name a source language and carry the tone", () => {
  const plain = buildInstructions("Persian (Farsi)");
  assert.match(plain, /Detect the source language yourself/);
  assert.match(plain, /into Persian \(Farsi\)/);
  assert.equal(plain.includes("Tone and register"), false);

  const toned = buildInstructions("Persian (Farsi)", "  very casual  ");
  assert.match(toned, /Tone and register requested by the user/);
  assert.match(toned, /very casual/);
});

test("cache keys ignore noise that does not change meaning", () => {
  assert.equal(canonical("  Hello   World "), canonical("hello world"));
  assert.equal(canonical("“quoted”"), canonical('"quoted"'));
  assert.equal(canonical("با\u200cهم"), canonical("باهم"));
  assert.notEqual(canonical("hello"), canonical("hallo"));
});

test("a line key is stable and separates language and model", () => {
  const base = { target: "fa", model: "m1", text: "Hello" };
  assert.equal(lineId(base), lineId({ ...base, text: "  hello  " }));
  assert.notEqual(lineId(base), lineId({ ...base, target: "de" }));
  assert.notEqual(lineId(base), lineId({ ...base, model: "m2" }));
});

test("the hash is deterministic and reasonably spread", () => {
  assert.equal(hashText("subtitle"), hashText("subtitle"));
  const seen = new Set(Array.from({ length: 2000 }, (_, i) => hashText(`line number ${i}`)));
  assert.equal(seen.size, 2000);
});

test("a track key covers video, source language, target and model", () => {
  const identity = { key: "youtube.com:abc", lang: "en", target: "fa", model: "m1" };
  assert.equal(trackId(identity), "youtube.com:abc|en|fa|m1");
  assert.notEqual(trackId(identity), trackId({ ...identity, lang: "de" }));
  assert.equal(trackId({ ...identity, lang: "" }), "youtube.com:abc|auto|fa|m1");
});
