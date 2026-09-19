/**
 * مانیتور مصرف توکن و سهمیهٔ Gemini API.
 *
 * روش کار — پورت شدهٔ همان متد نسخهٔ اندروید (`core/TokenUsage.kt`):
 *
 *  • هر پاسخ سرویس می‌تواند بلوک `usageMetadata` داشته باشد، با
 *    `promptTokenCount` / `responseTokenCount` (یا `candidatesTokenCount`) /
 *    `totalTokenCount`، و تفکیک به‌تفکیک مودالیتی در
 *    `promptTokensDetails` و `responseTokensDetails`. این در هر دو مسیر هست:
 *    پیام‌های سوکت Live API و پاسخ `generateContent` مسیر زیرنویس.
 *
 *  • **گوگل هیچ API رسمی برای «مقدار باقی‌ماندهٔ سهمیه» ندارد.** سقف‌ها
 *    (RPM/TPM/RPD/TPD) پروژه‌ای‌اند و فقط در AI Studio دیده می‌شوند. پس
 *    شمارش را خودمان انجام می‌دهیم، روزبه‌روز، و با سقفی که کاربر از
 *    AI Studio وارد کرده مقایسه می‌کنیم.
 *
 *  • شمارندهٔ روزانه **نیمه‌شب به وقت پسیفیک** صفر می‌شود، همان قاعدهٔ RPD
 *    خودِ Gemini API. اینجا برخلاف نسخهٔ اندروید از `Intl` استفاده می‌شود،
 *    پس ساعت تابستانی هم درست حساب می‌شود، نه با آفست ثابت.
 *
 *  • `429 / RESOURCE_EXHAUSTED` تنها سیگنال قطعیِ «سهمیه تمام شد» روی سیم
 *    است؛ پیام و `retryDelay` آن ذخیره می‌شود.
 *
 * چون Live API کانتکست هر نوبت را دوباره حساب می‌کند، این عدد **تقریبی** است
 * و مرجع نهایی همان داشبورد گوگل است.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

const STORE_KEY = "dubleParsiUsage";
const MAX_DAYS = 14;

/** داشبورد رسمی مصرف — مرجع نهایی سهمیهٔ پروژه */
export const DASHBOARD_URL = "https://ai.dev/usage?tab=rate-limit";

/** شمارندهٔ درخواست‌در‌روز نیمه‌شب پسیفیک صفر می‌شود */
const PACIFIC = "America/Los_Angeles";

const EMPTY_DAY = {
  day: "",
  input: 0,
  output: 0,
  total: 0,
  thoughts: 0,
  cached: 0,
  audioIn: 0,
  audioOut: 0,
  text: 0,
  peakContext: 0,   // بزرگ‌ترین کانتکست دیده‌شده در آن روز
  updates: 0,       // تعداد نوبت‌های محاسبه‌شده
  sessions: 0,
  lastAt: 0
};

const EMPTY_QUOTA = { hit: false, message: "", retryAtMs: 0, at: 0 };

const num = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed !== 0) return Math.round(parsed);
  }
  return 0;
};

/** «۱۲.۵s» ⇒ ۱۲۵۰۰ */
export function durationToMs(value) {
  const hit = /^(\d+(?:\.\d+)?)s$/.exec(String(value ?? "").trim());
  return hit ? Math.round(Number(hit[1]) * 1000) : null;
}

/**
 * بلوک `usageMetadata` سرویس ⇒ یک نمونهٔ مصرف.
 * هر دو نگارش camelCase و snake_case پشتیبانی می‌شود، چون Live API و
 * REST همیشه یکسان جواب نمی‌دهند.
 */
export function parseUsage(usage) {
  if (!usage || typeof usage !== "object") return null;

  const prompt = num(usage.promptTokenCount, usage.prompt_token_count);
  const response = Math.max(
    num(usage.responseTokenCount, usage.response_token_count),
    num(usage.candidatesTokenCount, usage.candidates_token_count)
  );
  const total = num(usage.totalTokenCount, usage.total_token_count);
  const thoughts = num(usage.thoughtsTokenCount, usage.thoughts_token_count);
  const cached = num(usage.cachedContentTokenCount, usage.cached_content_token_count);

  let audioIn = 0;
  let audioOut = 0;
  let text = 0;

  const walk = (list, onAudio) => {
    for (const item of Array.isArray(list) ? list : []) {
      const count = num(item?.tokenCount, item?.token_count);
      const modality = String(item?.modality ?? "").toUpperCase();
      if (modality === "AUDIO") onAudio(count);
      else if (modality === "TEXT") text += count;
    }
  };
  walk(usage.promptTokensDetails ?? usage.prompt_tokens_details, (count) => { audioIn += count; });
  walk(
    usage.responseTokensDetails ?? usage.response_tokens_details
      ?? usage.candidatesTokensDetails ?? usage.candidates_tokens_details,
    (count) => { audioOut += count; }
  );

  const sample = {
    promptTokens: prompt,
    responseTokens: response,
    totalTokens: total > 0 ? total : prompt + response,
    thoughtTokens: thoughts,
    cachedTokens: cached,
    audioInTokens: audioIn,
    audioOutTokens: audioOut,
    textTokens: text
  };
  const isEmpty = !prompt && !response && !total && !thoughts && !audioIn && !audioOut && !text;
  return isEmpty ? null : sample;
}

/**
 * زمان تلاش مجدد از خطای سهمیه.
 * اول `details[].retryDelay` استاندارد، بعد متن پیام («retry in 21.5s»).
 */
export function parseRetryDelay(error, detail) {
  for (const item of Array.isArray(error?.details) ? error.details : []) {
    const found = durationToMs(item?.retryDelay ?? item?.retry_delay);
    if (found) return found;
  }
  const hit = /retry in (\d+(?:\.\d+)?)s/i.exec(String(detail ?? ""));
  return hit ? Math.round(Number(hit[1]) * 1000) : 0;
}

/** آیا این خطا همان «سهمیه تمام شد» است؟ */
export function isQuotaError({ status, code, message }) {
  const text = String(message ?? "");
  return Number(status) === 429
    || Number(code) === 429
    || String(code ?? "") === "RESOURCE_EXHAUSTED"
    || /RESOURCE_EXHAUSTED/i.test(text)
    || /quota|rate limit/i.test(text);
}

/** کلید روز به وقت پسیفیک: «2026-09-18» */
export function pacificDayKey(atMs = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(atMs));
}

/**
 * لحظهٔ بازنشانی بعدی، یعنی نیمه‌شب پسیفیک.
 * ساعت فعلی پسیفیک را می‌خوانیم و باقی‌ماندهٔ روز را جلو می‌بریم، پس ساعت
 * تابستانی خودش لحاظ می‌شود.
 */
export function nextPacificResetMs(atMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PACIFIC, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(new Date(atMs));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const elapsed = ((get("hour") % 24) * 3600 + get("minute") * 60 + get("second")) * 1000;
  return atMs + (86400000 - elapsed);
}

/* ══════════════════════ انبار مصرف ══════════════════════ */

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    const stored = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY];
    cache = {
      days: stored?.days && typeof stored.days === "object" ? stored.days : {},
      quota: { ...EMPTY_QUOTA, ...(stored?.quota ?? {}) },
      dailyLimit: Number(stored?.dailyLimit) || 0
    };
  } catch {
    cache = { days: {}, quota: { ...EMPTY_QUOTA }, dailyLimit: 0 };
  }
  return cache;
}

async function save() {
  if (!cache) return;
  // فقط چند روز آخر نگه داشته می‌شود
  const keys = Object.keys(cache.days).sort().reverse().slice(0, MAX_DAYS);
  cache.days = Object.fromEntries(keys.map((key) => [key, cache.days[key]]));
  try {
    await chrome.storage.local.set({ [STORE_KEY]: cache });
  } catch {}
}

/** یک نمونهٔ مصرف را روی روز جاری می‌نشاند */
export async function record(sample) {
  if (!sample) return;
  const store = await load();
  const key = pacificDayKey();
  const day = store.days[key] ?? { ...EMPTY_DAY, day: key };
  store.days[key] = {
    ...day,
    input: day.input + sample.promptTokens,
    output: day.output + sample.responseTokens,
    total: day.total + (sample.totalTokens || sample.promptTokens + sample.responseTokens),
    thoughts: day.thoughts + sample.thoughtTokens,
    cached: day.cached + sample.cachedTokens,
    audioIn: day.audioIn + sample.audioInTokens,
    audioOut: day.audioOut + sample.audioOutTokens,
    text: day.text + sample.textTokens,
    peakContext: Math.max(day.peakContext, sample.promptTokens),
    updates: day.updates + 1,
    lastAt: Date.now()
  };
  await save();
}

export async function startSession() {
  const store = await load();
  const key = pacificDayKey();
  const day = store.days[key] ?? { ...EMPTY_DAY, day: key };
  store.days[key] = { ...day, sessions: day.sessions + 1, lastAt: Date.now() };
  // اگر زمان تلاش مجدد گذشته، پرچم سهمیه برداشته می‌شود
  if (store.quota.hit && store.quota.retryAtMs > 0 && store.quota.retryAtMs <= Date.now()) {
    store.quota = { ...EMPTY_QUOTA };
  }
  await save();
}

export async function noteQuota(message, retryMs) {
  const store = await load();
  store.quota = {
    hit: true,
    message: String(message ?? "").slice(0, 400),
    retryAtMs: retryMs > 0 ? Date.now() + retryMs : 0,
    at: Date.now()
  };
  await save();
}

export async function clearQuota() {
  const store = await load();
  if (!store.quota.hit) return;
  store.quota = { ...EMPTY_QUOTA };
  await save();
}

export async function setDailyLimit(limit) {
  const store = await load();
  store.dailyLimit = Math.max(0, Math.round(Number(limit) || 0));
  await save();
}

export async function clearAll() {
  cache = { days: {}, quota: { ...EMPTY_QUOTA }, dailyLimit: (await load()).dailyLimit };
  await save();
}

/** وضعیت کامل برای نمایش در پاپ‌آپ */
export async function snapshot() {
  const store = await load();
  const key = pacificDayKey();
  const today = store.days[key] ?? { ...EMPTY_DAY, day: key };
  const limit = store.dailyLimit;
  return {
    today,
    history: Object.values(store.days).sort((a, b) => b.day.localeCompare(a.day)).slice(0, MAX_DAYS),
    quota: store.quota,
    dailyLimit: limit,
    resetAtMs: nextPacificResetMs(),
    usedFraction: limit > 0 ? Math.min(1, Math.max(0, today.total / limit)) : null,
    remaining: limit > 0 ? Math.max(0, limit - today.total) : null,
    dashboard: DASHBOARD_URL
  };
}
