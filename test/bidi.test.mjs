import assert from "node:assert/strict";
import { test } from "node:test";
import { LRI, PDI, baseDirection, forDisplay, isolateLatin, stripIsolates } from "../src/bidi.js";

test("the base direction comes from the first strong character", () => {
  assert.equal(baseDirection("سلام دنیا"), "rtl");
  assert.equal(baseDirection("hello world"), "ltr");
  assert.equal(baseDirection("«سلام»"), "rtl");          // punctuation is not strong
  assert.equal(baseDirection("123 سلام"), "rtl");        // digits are not strong either
  assert.equal(baseDirection("123"), "ltr");
  assert.equal(baseDirection(""), "ltr");
});

test("a Latin run inside Persian is isolated", () => {
  const out = isolateLatin("روی Windows 11 نصب کن");
  assert.equal(out, `روی ${LRI}Windows 11${PDI} نصب کن`);
});

test("several runs are isolated separately", () => {
  const out = isolateLatin("از GitHub Actions و Node.js استفاده می‌کند");
  assert.equal(out.split(LRI).length - 1, 2);
  assert.equal(out.split(PDI).length - 1, 2);
  assert.ok(out.includes(`${LRI}GitHub Actions${PDI}`));
  assert.ok(out.includes(`${LRI}Node.js${PDI}`));
});

test("left-to-right text is left completely alone", () => {
  const text = "install it on Windows 11";
  assert.equal(isolateLatin(text), text);
  assert.equal(isolateLatin("سلام", "ltr"), "سلام");
});

test("already isolated text is not wrapped twice", () => {
  const once = isolateLatin("روی Windows نصب کن");
  assert.equal(isolateLatin(once), once);
});

test("pure Persian text gains nothing", () => {
  assert.equal(isolateLatin("این یک جملهٔ کامل فارسی است"), "این یک جملهٔ کامل فارسی است");
});

test("isolates can be stripped again for file output", () => {
  const shown = isolateLatin("روی Windows 11 نصب کن");
  assert.notEqual(shown, "روی Windows 11 نصب کن");
  assert.equal(stripIsolates(shown), "روی Windows 11 نصب کن");
  assert.equal(stripIsolates("a\u200eb\u200fc"), "abc");
});

test("forDisplay returns both the text and the direction", () => {
  const rtl = forDisplay("مدل Gemini را انتخاب کن");
  assert.equal(rtl.dir, "rtl");
  assert.ok(rtl.text.includes(LRI));

  const ltr = forDisplay("pick the Gemini model");
  assert.equal(ltr.dir, "ltr");
  assert.equal(ltr.text, "pick the Gemini model");

  assert.deepEqual(forDisplay(""), { text: "", dir: "ltr" });
  assert.deepEqual(forDisplay(null), { text: "", dir: "ltr" });
});
