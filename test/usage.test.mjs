import assert from "node:assert/strict";
import { test } from "node:test";
import {
  durationToMs, isQuotaError, nextPacificResetMs, pacificDayKey, parseRetryDelay, parseUsage
} from "../src/usage.js";

test("usageMetadata is read in both camelCase and snake_case", () => {
  const camel = parseUsage({ promptTokenCount: 120, responseTokenCount: 30, totalTokenCount: 150 });
  assert.equal(camel.promptTokens, 120);
  assert.equal(camel.responseTokens, 30);
  assert.equal(camel.totalTokens, 150);

  const snake = parseUsage({ prompt_token_count: 5, candidates_token_count: 7 });
  assert.equal(snake.promptTokens, 5);
  assert.equal(snake.responseTokens, 7);
  assert.equal(snake.totalTokens, 12, "a missing total is derived from the parts");
});

test("candidatesTokenCount stands in for responseTokenCount", () => {
  const sample = parseUsage({ promptTokenCount: 10, candidatesTokenCount: 4 });
  assert.equal(sample.responseTokens, 4);
});

test("the per-modality breakdown is split into audio and text", () => {
  const sample = parseUsage({
    promptTokenCount: 900,
    responseTokenCount: 400,
    totalTokenCount: 1300,
    promptTokensDetails: [{ modality: "AUDIO", tokenCount: 850 }, { modality: "TEXT", tokenCount: 50 }],
    responseTokensDetails: [{ modality: "AUDIO", tokenCount: 380 }, { modality: "TEXT", tokenCount: 20 }]
  });
  assert.equal(sample.audioInTokens, 850);
  assert.equal(sample.audioOutTokens, 380);
  assert.equal(sample.textTokens, 70, "text tokens from both directions add up");
});

test("an empty or absent block yields null instead of a zero row", () => {
  assert.equal(parseUsage(null), null);
  assert.equal(parseUsage({}), null);
  assert.equal(parseUsage({ promptTokenCount: 0, responseTokenCount: 0 }), null);
  assert.equal(parseUsage("nonsense"), null);
});

test("a duration string turns into milliseconds", () => {
  assert.equal(durationToMs("21s"), 21000);
  assert.equal(durationToMs("1.5s"), 1500);
  assert.equal(durationToMs("21"), null);
  assert.equal(durationToMs(""), null);
});

test("the retry delay is taken from details first, then from the message", () => {
  const structured = parseRetryDelay({ details: [{ "@type": "RetryInfo", retryDelay: "34s" }] }, "");
  assert.equal(structured, 34000);

  const snake = parseRetryDelay({ details: [{ retry_delay: "2.5s" }] }, "");
  assert.equal(snake, 2500);

  const fromText = parseRetryDelay({}, "Quota exceeded, please retry in 12.5s");
  assert.equal(fromText, 12500);

  assert.equal(parseRetryDelay(null, "no hint here"), 0);
});

test("a quota failure is recognised by status, code or wording", () => {
  assert.equal(isQuotaError({ status: 429 }), true);
  assert.equal(isQuotaError({ code: "RESOURCE_EXHAUSTED" }), true);
  assert.equal(isQuotaError({ message: "You exceeded your current quota" }), true);
  assert.equal(isQuotaError({ status: 500, message: "internal" }), false);
  assert.equal(isQuotaError({ status: 404, message: "model not found" }), false);
});

test("days are bucketed by Pacific time, not by UTC", () => {
  // 05:00 UTC is 22:00 of the previous day in Los Angeles (PDT = UTC-7)
  assert.equal(pacificDayKey(Date.parse("2026-09-18T05:00:00Z")), "2026-09-17");
  // 08:30 UTC is already 01:30 of the same day there, so the date must not shift
  assert.equal(pacificDayKey(Date.parse("2026-09-18T08:30:00Z")), "2026-09-18");
  // and in January, standard time (UTC-8) moves the boundary by another hour
  assert.equal(pacificDayKey(Date.parse("2026-01-15T07:30:00Z")), "2026-01-14");
  assert.match(pacificDayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("the reset lands on the next Pacific midnight", () => {
  const now = Date.parse("2026-09-18T20:00:00Z");
  const reset = nextPacificResetMs(now);
  assert.ok(reset > now);
  assert.ok(reset - now <= 86400000);
  // the moment of reset must be the start of a new Pacific day
  assert.notEqual(pacificDayKey(reset + 60000), pacificDayKey(now));
});
