import assert from "node:assert/strict";
import { test } from "node:test";
import { CaptionTrack, toSrt, toVtt } from "../src/captions.js";

function track(chunks) {
  const t = new CaptionTrack();
  for (const [text, at] of chunks) t.push(text, at);
  return t;
}

test("closes a cue on sentence end", () => {
  const cues = track([["سلام دنیا، این یک آزمایش است.", 1000]]).finalize(0);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, "سلام دنیا، این یک آزمایش است.");
});

test("joins streamed fragments with sane spacing", () => {
  const cues = track([["Hello", 0], [" world", 100], [".", 200]]).finalize(0);
  assert.equal(cues[0].text, "Hello world.");
});

test("silence flushes an open cue", () => {
  const t = track([["no ending here", 0]]);
  t.tick(2000);
  assert.equal(t.cueCount, 1);
});

test("the delay offset shifts cues without going negative", () => {
  const cues = track([["short line here.", 500]]).finalize(1200);
  assert.equal(cues[0].start, 0);
});

test("cues never overlap after shifting", () => {
  const t = track([["first sentence here.", 1000], ["second sentence here.", 1500]]);
  const cues = t.finalize(0);
  for (let i = 0; i < cues.length - 1; i += 1) assert.ok(cues[i].end <= cues[i + 1].start);
});

test("SRT is numbered and comma-stamped", () => {
  const srt = toSrt([{ start: 0, end: 1500, text: "salam" }]);
  assert.equal(srt.startsWith("1\n00:00:00,000 --> 00:00:01,500\nsalam"), true);
});

test("VTT starts with the WEBVTT header and dot stamps", () => {
  const vtt = toVtt([{ start: 61000, end: 62000, text: "hi" }]);
  assert.ok(vtt.startsWith("WEBVTT\n\n"));
  assert.ok(vtt.includes("00:01:01.000 --> 00:01:02.000"));
});

test("an empty track produces nothing", () => {
  assert.equal(new CaptionTrack().isEmpty, true);
  assert.deepEqual(new CaptionTrack().finalize(0), []);
});
