import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, clampVolume, migrate } from "../src/defaults.js";
import { DICT } from "../src/i18n.js";

test("volume defaults leave the original audible and the dub at full level", () => {
  assert.equal(DEFAULT_SETTINGS.originalVolume, 1);
  assert.equal(DEFAULT_SETTINGS.dubVolume, 1);
});

test("clampVolume keeps zero as a true zero and bounds the rest", () => {
  assert.equal(clampVolume(0, 1, 1), 0);
  assert.equal(clampVolume(-3, 1, 1), 0);
  assert.equal(clampVolume(7, 1, 1), 1);
  assert.equal(clampVolume(2, 1.5, 1), 1.5);
  assert.equal(clampVolume("0.4", 1, 1), 0.4);
  assert.equal(clampVolume("abc", 1.5, 1), 1);
  assert.equal(clampVolume(undefined, 1, 0.5), 0.5);
});

test("older settings migrate with default volumes and keep a saved mute", () => {
  const old = migrate({ version: 9, apiKey: "k" });
  assert.equal(old.originalVolume, 1);
  assert.equal(old.dubVolume, 1);
  assert.equal(old.version, SETTINGS_VERSION);
  const muted = migrate({ version: SETTINGS_VERSION, originalVolume: 0, dubVolume: 1.2 });
  assert.equal(muted.originalVolume, 0);
  assert.equal(muted.dubVolume, 1.2);
  assert.equal(migrate({ version: SETTINGS_VERSION, originalVolume: 9 }).originalVolume, 1);
});

test("volume strings exist in both languages", () => {
  for (const key of ["vol.title", "vol.original", "vol.dub", "vol.mute", "vol.unmute", "err.needInvoke"]) {
    assert.ok(DICT.fa[key] && DICT.en[key], key);
  }
});

test("the YouTube quick panel is a classic script that talks to the worker", async () => {
  const source = await readFile(new URL("../src/overlay/yt-controls.js", import.meta.url), "utf8");
  assert.equal(/^\s*(import|export)\s/m.test(source), false);
  for (const type of ["dp-mini-get", "dp-mini-start", "dp-mini-stop", "dp-mini-stage", "dp-mini-volume"]) {
    assert.ok(source.includes(type), type);
  }
  assert.ok(source.includes(".ytp-settings-button"));
  assert.ok(source.includes("data:image/png;base64,"));
  const worker = await readFile(new URL("../src/service-worker.js", import.meta.url), "utf8");
  for (const type of ["dp-mini-get", "dp-mini-start", "dp-mini-volume", "dp-volume-set"]) {
    assert.ok(worker.includes(`"${type}"`), type);
  }
});

test("only the two volume sliders remain; ducking settings are gone", async () => {
  assert.equal("duckOriginal" in DEFAULT_SETTINGS, false);
  assert.equal("duckLevel" in DEFAULT_SETTINGS, false);
  const html = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");
  assert.equal(/duck/i.test(html), false);
  assert.equal((html.match(/id="(originalVolume|dubVolume)"/g) ?? []).length, 2);
  const panel = await readFile(new URL("../src/overlay/yt-controls.js", import.meta.url), "utf8");
  assert.equal((panel.match(/type: "range"/g) ?? []).length, 2);
});
