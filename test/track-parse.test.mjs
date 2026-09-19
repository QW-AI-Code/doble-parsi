import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeCaptionText,
  detectFormat,
  groupIntoSentences,
  normalizeCues,
  parseCaptionFile,
  parseTimestamp
} from "../src/track-parse.js";
import { sourceKey } from "../src/track-source.js";

test("timestamps parse in every shape a player emits", () => {
  assert.equal(parseTimestamp("00:00:01,500"), 1500);
  assert.equal(parseTimestamp("00:01:02.250"), 62250);
  assert.equal(parseTimestamp("1:02.5"), 62500);
  assert.equal(parseTimestamp("7.25"), 7250);
  assert.equal(parseTimestamp(""), null);
  assert.equal(parseTimestamp("nonsense"), null);
});

test("caption markup and entities are unwrapped", () => {
  assert.equal(decodeCaptionText("<c.colorE5E5E5>Hi</c> &amp; bye"), "Hi & bye");
  assert.equal(decodeCaptionText("a&nbsp;b"), "a\u00a0b");
  assert.equal(decodeCaptionText("&#39;quoted&#39;"), "'quoted'");
});

test("the format is detected from the content, not the file name", () => {
  assert.equal(detectFormat('{"events":[]}'), "json3");
  assert.equal(detectFormat("WEBVTT\n\n00:00.000 --> 00:01.000\nhi"), "vtt");
  assert.equal(detectFormat('<?xml version="1.0"?><tt><body/></tt>'), "ttml");
  assert.equal(detectFormat("1\n00:00:00,000 --> 00:00:01,000\nhi"), "srt");
  assert.equal(detectFormat(""), "unknown");
});

test("json3 segments join into one cue", () => {
  const payload = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 1200, segs: [{ utf8: "Hello" }, { utf8: " there" }] },
      { tStartMs: 1400, dDurationMs: 900, segs: [{ utf8: "friend." }] }
    ]
  });
  const cues = parseCaptionFile(payload, "json3");
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "Hello there");
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 1200);
});

test("SRT and VTT go through the same shape", () => {
  const srt = "1\n00:00:01,000 --> 00:00:02,500\nfirst line\n\n2\n00:00:03,000 --> 00:00:04,000\nsecond line\n";
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nfirst line\n\n00:00:03.000 --> 00:00:04.000\nsecond line\n";
  assert.deepEqual(parseCaptionFile(srt), parseCaptionFile(vtt));
  assert.equal(parseCaptionFile(srt)[0].start, 1000);
});

test("TTML paragraphs with begin/end are read", () => {
  const ttml = '<tt><body><div><p begin="00:00:02.000" end="00:00:03.500">salam</p></div></body></tt>';
  const cues = parseCaptionFile(ttml);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 2000);
  assert.equal(cues[0].end, 3500);
});

test("a rolling caption track does not repeat the previous line", () => {
  const cues = normalizeCues([
    { start: 0, end: 1000, text: "we are" },
    { start: 900, end: 2000, text: "we are going" },
    { start: 1900, end: 3000, text: "we are going home" }
  ]);
  assert.deepEqual(cues.map((cue) => cue.text), ["we are", "going", "home"]);
});

test("identical neighbouring cues merge instead of stuttering", () => {
  const cues = normalizeCues([
    { start: 0, end: 1000, text: "same" },
    { start: 1100, end: 2000, text: "same" }
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].end, 2000);
});

test("cues never overlap after normalising", () => {
  const cues = normalizeCues([
    { start: 0, end: 4000, text: "one" },
    { start: 1000, end: 5000, text: "two" }
  ]);
  assert.ok(cues[0].end <= cues[1].start);
});

test("empty and broken input yields nothing rather than throwing", () => {
  assert.deepEqual(parseCaptionFile(""), []);
  assert.deepEqual(parseCaptionFile("{ not json"), []);
  assert.deepEqual(normalizeCues(undefined), []);
  assert.deepEqual(normalizeCues([{ text: "   " }]), []);
});

test("auto-caption fragments group into readable sentences", () => {
  const cues = groupIntoSentences([
    { start: 0, end: 500, text: "so today" },
    { start: 500, end: 1000, text: "we are going" },
    { start: 1000, end: 1500, text: "to build a thing." },
    { start: 1600, end: 2100, text: "let's start." }
  ]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "so today we are going to build a thing.");
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 1500);
});

test("grouping respects the character budget and long gaps", () => {
  const short = groupIntoSentences(
    [{ start: 0, end: 100, text: "aaaa" }, { start: 100, end: 200, text: "bbbb" }],
    { maxChars: 5 }
  );
  assert.equal(short.length, 2);

  const gapped = groupIntoSentences([
    { start: 0, end: 500, text: "before the pause" },
    { start: 9000, end: 9500, text: "after the pause" }
  ]);
  assert.equal(gapped.length, 2);
});

test("one video keeps one memory key across differing URLs", () => {
  const a = sourceKey("https://www.youtube.com/watch?v=abc123&t=42s", "abc123");
  const b = sourceKey("https://youtube.com/watch?v=abc123", "abc123");
  assert.equal(a, b);
  assert.equal(a, "youtube.com:abc123");
  assert.equal(sourceKey("https://vimeo.com/76543/", ""), "vimeo.com/76543");
  assert.equal(sourceKey("not a url", "xyz"), "local:xyz");
});
