import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOT_FOLDER, buildOutputName, buildOutputPath, cleanTitle, safeFolder } from "../src/filenames.js";

test("strips the notification counter and the site brand", () => {
  assert.equal(cleanTitle("(3) Interstellar Docking Scene - YouTube", "https://www.youtube.com/watch?v=1"),
    "Interstellar Docking Scene");
  assert.equal(cleanTitle("سخنرانی تد - آپارات", "https://www.aparat.com/v/abc"), "سخنرانی تد");
});

test("derives unknown brands from the host name", () => {
  assert.equal(cleanTitle("Lecture 4 - Coolvideos", "https://coolvideos.com/watch"), "Lecture 4");
});

test("keeps a dash that belongs to the title", () => {
  assert.equal(cleanTitle("Part 1 - The Beginning", "https://example.org/x"), "Part 1 - The Beginning");
});

test("removes characters no file system accepts", () => {
  assert.equal(cleanTitle('a/b\\c:d*e?f"g<h>i|j', "https://x.test"), "a b c d e f g h i j");
});

test("never returns a name that ends in a dot or space", () => {
  assert.equal(cleanTitle("Trailing dots...   ", "https://x.test").endsWith("."), false);
  assert.equal(safeFolder(" .hidden. "), "hidden");
});

test("clamps very long titles but keeps the extension", () => {
  const name = buildOutputName({ title: "x".repeat(400), url: "https://x.test", extension: "mp3" });
  assert.ok(name.endsWith(".mp3"));
  assert.ok(name.length <= 95);
});

test("builds the tidy download path", () => {
  const path = buildOutputPath({ title: "My Clip - YouTube", url: "https://youtube.com/w", extension: "srt" });
  assert.equal(path, `${ROOT_FOLDER}/My Clip/My Clip.srt`);
});

test("source-language subtitles get their own suffix", () => {
  const path = buildOutputPath({ title: "My Clip", url: "https://x.test", extension: "srt", suffix: "original" });
  assert.equal(path, `${ROOT_FOLDER}/My Clip/My Clip.original.srt`);
});

test("falls back to a timestamped name when the title is empty", () => {
  const path = buildOutputPath({ title: "", url: "https://x.test", extension: "mp3", tag: "20260101-101010" });
  assert.equal(path, `${ROOT_FOLDER}/dobleparsi-20260101-101010/dobleparsi-20260101-101010.mp3`);
});

test("path traversal cannot escape the download folder", () => {
  const path = buildOutputPath({ title: "../../etc/passwd", url: "https://x.test", extension: "mp3" });
  assert.equal(path.includes(".."), false);
});
