import assert from "node:assert/strict";
import { test } from "node:test";
import { Int16StreamReader, floatToInt16, softLimitInPlace } from "../src/pcm.js";

test("float samples become clamped 16-bit samples", () => {
  const out = floatToInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
  assert.deepEqual([...out], [0, 32767, -32767, 32767, -32768, 16384]);
});

test("non-finite samples become silence instead of noise", () => {
  const out = floatToInt16(new Float32Array([NaN, Infinity, -Infinity]));
  assert.deepEqual([...out], [0, 0, 0]);
});

test("the limiter leaves anything below -1 dBFS untouched", () => {
  const quiet = new Float32Array([0.1, -0.4, 0.8]);
  assert.deepEqual([...softLimitInPlace(Float32Array.from(quiet))], [...quiet]);
});

test("the limiter keeps hot signals inside range", () => {
  const loud = softLimitInPlace(new Float32Array([1.6, -1.6]));
  assert.ok(loud[0] < 1 && loud[0] > 0.89);
  assert.ok(loud[1] > -1 && loud[1] < -0.89);
});

test("an odd-length chunk carries its last byte into the next chunk", () => {
  const reader = new Int16StreamReader();
  const whole = new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0x00, 0x20]);
  const inOne = reader.push(whole);
  const split = new Int16StreamReader();
  const a = split.push(whole.subarray(0, 3));
  const b = split.push(whole.subarray(3));
  assert.deepEqual([...inOne], [...a, ...b]);
  assert.equal(inOne.length, 3);
});

test("little-endian signed decoding is correct", () => {
  const reader = new Int16StreamReader();
  const samples = reader.push(new Uint8Array([0x00, 0x80, 0xff, 0x7f]));
  assert.equal(samples[0], -1);
  assert.ok(Math.abs(samples[1] - 0.999969) < 1e-4);
});

test("reset drops a pending carry byte", () => {
  const reader = new Int16StreamReader();
  reader.push(new Uint8Array([0x11]));
  reader.reset();
  assert.deepEqual([...reader.push(new Uint8Array([0x00, 0x40]))], [0.5]);
});
