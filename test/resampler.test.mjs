import assert from "node:assert/strict";
import { test } from "node:test";
import { SincResampler } from "../src/resampler.js";

const sine = (frames, rate, hz) =>
  Float32Array.from({ length: frames }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));

test("equal rates are a pass-through", () => {
  const r = new SincResampler(48000, 48000);
  assert.equal(r.isPassthrough, true);
  assert.deepEqual([...r.process(new Float32Array([1, 2, 3]))], [1, 2, 3]);
});

test("48k -> 16k yields about a third of the samples", () => {
  const r = new SincResampler(48000, 16000);
  const out = r.process(sine(4800, 48000, 440));
  assert.ok(Math.abs(out.length - 1600) < 40, `got ${out.length}`);
});

test("24k -> 48k roughly doubles the samples", () => {
  const r = new SincResampler(24000, 48000);
  const out = r.process(sine(2400, 24000, 440));
  assert.ok(Math.abs(out.length - 4800) < 80, `got ${out.length}`);
});

test("amplitude is preserved and nothing goes non-finite", () => {
  const r = new SincResampler(24000, 48000);
  const out = r.process(sine(4800, 24000, 300));
  let peak = 0;
  for (const value of out) {
    assert.ok(Number.isFinite(value));
    peak = Math.max(peak, Math.abs(value));
  }
  assert.ok(peak > 0.42 && peak < 0.58, `peak ${peak}`);
});

test("chunk boundaries stay continuous", () => {
  const whole = sine(2400, 24000, 200);
  const one = new SincResampler(24000, 48000).process(whole);
  const split = new SincResampler(24000, 48000);
  const parts = [...split.process(whole.subarray(0, 999)), ...split.process(whole.subarray(999))];
  const compare = Math.min(one.length, parts.length) - 4;
  for (let i = 0; i < compare; i += 1) assert.ok(Math.abs(one[i] - parts[i]) < 1e-5);
});

test("flush drains the filter tail", () => {
  const r = new SincResampler(24000, 48000);
  r.process(sine(480, 24000, 440));
  assert.ok(r.flush().length > 0);
});
