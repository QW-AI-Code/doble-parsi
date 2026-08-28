import assert from "node:assert/strict";
import { test } from "node:test";
import { DICT, UI_LANGS, digits, dirOf, message, setLang, t } from "../src/i18n.js";
import { LANGUAGES, findLanguage, languageLabel } from "../src/languages.js";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, migrate } from "../src/defaults.js";

test("both interface languages carry the same keys", () => {
  assert.deepEqual(Object.keys(DICT.fa).sort(), Object.keys(DICT.en).sort());
});

test("every placeholder exists in both languages", () => {
  for (const key of Object.keys(DICT.fa)) {
    const tokens = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(tokens(DICT.fa[key]), tokens(DICT.en[key]), `placeholders differ for ${key}`);
  }
});

test("Persian is right to left, English is left to right", () => {
  assert.equal(dirOf("fa"), "rtl");
  assert.equal(dirOf("en"), "ltr");
  assert.equal(UI_LANGS.length, 2);
});

test("interpolation and error codes resolve", () => {
  setLang("en");
  assert.equal(t("meter.cues", { n: 3 }), "3 subtitle lines");
  assert.equal(message({ code: "err.noKey" }), "Enter your Gemini API key first.");
  setLang("fa");
  assert.equal(digits("2026"), "۲۰۲۶");
});

test("an unknown key falls back to itself instead of crashing", () => {
  assert.equal(t("nope.missing"), "nope.missing");
});

test("every dubbing language has both labels", () => {
  for (const language of LANGUAGES) {
    assert.ok(language.code && language.fa && language.en, `incomplete ${language.code}`);
  }
  assert.equal(findLanguage("zz").code, "fa");
  assert.equal(languageLabel("tr", "en"), "Turkish");
});

test("old settings migrate without losing the model choice", () => {
  const migrated = migrate({ version: 1, model: "old-live-model", voiceName: "Kore", targetLang: "en" });
  assert.equal(migrated.translateModel, "old-live-model");
  assert.equal(migrated.targetLang, "en");
  assert.equal(migrated.version, SETTINGS_VERSION);
  assert.equal("voiceName" in migrated, false);
});

test("broken storage falls back to defaults", () => {
  assert.deepEqual(migrate(null), DEFAULT_SETTINGS);
  assert.equal(migrate({}).targetLang, "fa");
});
