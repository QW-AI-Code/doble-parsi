/**
 * بررسی کلید API و پیدا کردن مدل‌هایی که واقعاً روی همان کلید جواب می‌دهند.
 *
 * چرا لازم است: فهرست `ListModels` همهٔ مدل‌های سرویس را می‌دهد، ولی اینکه یک
 * مدل روی *کلید تو* و روی *سطح رایگان* کار می‌کند چیز دیگری است. تنها راه
 * فهمیدنش، زدن یک درخواست کوچک و دیدن جواب است:
 *
 *   ۲۰۰            ⇒ کار می‌کند
 *   ۴۰۴            ⇒ این مدل روی این کلید وجود ندارد
 *   ۴۲۹            ⇒ مدل هست ولی سهمیهٔ سطح تو اجازه نمی‌دهد
 *   ۴۰۰/۴۰۳ کلید   ⇒ خودِ کلید مشکل دارد
 *
 * هر بررسی خودش چند توکن مصرف می‌کند، پس تعداد نامزدها سقف دارد و درخواست‌ها
 * تا جای ممکن کوچک‌اند (`maxOutputTokens: 1`).
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { MODEL_FALLBACKS } from "./translate-client.js";
import { isQuotaError, parseRetryDelay, parseUsage } from "./usage.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const PROBE_TIMEOUT_MS = 20000;

/** بیشتر از این تعداد مدل بررسی نمی‌شود، چون هر بررسی سهمیه می‌خورد */
const MAX_PROBES = 8;

/**
 * مدل‌های سبک برای مصرف کم.
 * `flash-lite` ارزان‌ترین گزینهٔ متنی است و برای ترجمهٔ زیرنویس کافی است.
 */
const THRIFTY = /flash-lite|flash-8b/i;

function classify(status, message) {
  if (status === 200) return "ok";
  if (isQuotaError({ status, message })) return "quota";
  if (status === 404 || /not found|not supported|does not exist/i.test(message)) return "missing";
  if (status === 400 && /api key/i.test(message)) return "badKey";
  if (status === 403) return "badKey";
  return "error";
}

async function ask(apiKey, model, body) {
  const started = Date.now();
  try {
    const answer = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    const raw = await answer.text();
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {}
    const message = String(payload?.error?.message ?? (answer.ok ? "" : `HTTP ${answer.status}`));
    return {
      status: answer.status,
      kind: classify(answer.status, message),
      message: message.slice(0, 200),
      retryMs: parseRetryDelay(payload?.error, message),
      usage: parseUsage(payload?.usageMetadata ?? payload?.usage_metadata),
      ms: Date.now() - started
    };
  } catch (error) {
    return {
      status: 0,
      kind: "offline",
      message: String(error?.message ?? error).slice(0, 200),
      retryMs: 0,
      usage: null,
      ms: Date.now() - started
    };
  }
}

/** کوچک‌ترین درخواست ممکن: یک کلمه در، یک توکن بیرون */
const PING = {
  contents: [{ role: "user", parts: [{ text: "ping" }] }],
  generationConfig: { maxOutputTokens: 1, temperature: 0 }
};

/**
 * تست سلامت کلید و اتصال.
 * @returns {Promise<{ok: boolean, kind: string, model: string, message: string,
 *   ms: number, retryMs: number, usage: object|null}>}
 */
export async function testKey(apiKey, model) {
  const key = String(apiKey ?? "").trim();
  if (!key) return { ok: false, kind: "noKey", model: "", message: "", ms: 0, retryMs: 0, usage: null };

  const candidates = [...new Set([String(model ?? "").trim(), ...MODEL_FALLBACKS].filter(Boolean))];
  let last = null;
  for (const candidate of candidates.slice(0, 3)) {
    const result = await ask(key, candidate, PING);
    last = { ...result, model: candidate, ok: result.kind === "ok" };
    // کلید خراب یا سهمیهٔ تمام‌شده را با مدل بعدی نمی‌توان درست کرد
    if (["ok", "badKey", "quota", "offline"].includes(result.kind)) return last;
  }
  return last ?? { ok: false, kind: "error", model: "", message: "", ms: 0, retryMs: 0, usage: null };
}

/** فهرست مدل‌های متنی که سرویس برای این کلید اعلام می‌کند */
export async function listTextModels(apiKey) {
  try {
    const answer = await fetch(`${API_BASE}/models?pageSize=200`, {
      headers: { "x-goog-api-key": String(apiKey ?? "").trim() },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    if (!answer.ok) return [];
    const models = (await answer.json())?.models ?? [];
    return models
      .filter((entry) => (entry.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((entry) => String(entry.name ?? "").replace(/^models\//, ""))
      .filter((name) => name && !/image|tts|audio|embedding|vision|live|robotics|gemma|deep-research|nano-banana|lyria|computer-use/i.test(name));
  } catch {
    return [];
  }
}

/**
 * فقط مدل‌هایی را برمی‌گرداند که **واقعاً روی همین کلید جواب دادند**.
 *
 * ترتیب بررسی از سبک به سنگین است تا اگر سهمیه وسط کار تمام شد، مدل‌های
 * کم‌مصرف قبلاً بررسی شده باشند.
 *
 * @returns {Promise<{models: Array, checked: number, quota: null|{message: string, retryMs: number}}>}
 */
export async function probeModels(apiKey, { onUsage } = {}) {
  const key = String(apiKey ?? "").trim();
  if (!key) return { models: [], checked: 0, quota: null };

  const announced = await listTextModels(key);
  const pool = [...new Set([...announced, ...MODEL_FALLBACKS])];

  // سبک‌ها اول، بعد نام‌های مستعار پایدار، بعد بقیه
  pool.sort((a, b) => {
    const weight = (name) => (THRIFTY.test(name) ? 0 : /latest/.test(name) ? 1 : 2);
    return weight(a) - weight(b) || a.localeCompare(b);
  });

  const models = [];
  let quota = null;
  let checked = 0;

  for (const model of pool.slice(0, MAX_PROBES)) {
    const result = await ask(key, model, PING);
    checked += 1;
    if (result.usage) onUsage?.(result.usage);

    if (result.kind === "ok") {
      models.push({ id: model, ms: result.ms, thrifty: THRIFTY.test(model) });
      continue;
    }
    if (result.kind === "quota") {
      // ادامهٔ بررسی فقط سهمیه را بیشتر می‌سوزاند
      quota = { message: result.message, retryMs: result.retryMs };
      break;
    }
    if (result.kind === "badKey" || result.kind === "offline") {
      quota = null;
      break;
    }
  }

  models.sort((a, b) => Number(b.thrifty) - Number(a.thrifty) || a.ms - b.ms);
  return { models, checked, quota };
}
