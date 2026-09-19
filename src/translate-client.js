/**
 * ترجمهٔ متنیِ زیرنویس واقعی سایت.
 *
 * مسیر دوبلهٔ زنده صدا را به مدل Live می‌فرستد. اما وقتی خودِ سایت زیرنویس
 * زمان‌بندی‌شده دارد، فرستادن صدا بی‌جهت است: متن و زمان درست همان‌جاست و فقط
 * ترجمه لازم است.
 *
 * چهار چیز اینجا جدی گرفته می‌شود:
 *
 *   • **خروجی ساختارمند** — به‌جای خواندن متن آزاد مدل، `responseSchema`
 *     تعریف می‌شود و پاسخ آرایه‌ای از `{i, t}` است. پس شماره‌گذاری به‌هم
 *     نمی‌ریزد و پارسر شکننده لازم نیست.
 *
 *   • **نام مدل نمی‌پوسد** — نام مدل‌های متنی جِمینای مدام عوض می‌شود. پس
 *     پیش‌فرض یک نام مستعار بی‌تاریخ است، و اگر مدلی پیدا نشد (۴۰۴) خودِ
 *     کلاینت فهرست مدل‌های همان کلید را از سرویس می‌گیرد و اولین مدل مناسب
 *     را برمی‌دارد. کاربر لازم نیست نام مدل بداند.
 *
 *   • **شکست بی‌صدا ممنوع** — نسخهٔ قبلی هر بستهٔ شکست‌خورده را با متن مبدأ پر
 *     می‌کرد و هیچ خطایی نشان نمی‌داد، یعنی کاربر زیرنویس *انگلیسی* می‌دید و
 *     فکر می‌کرد ترجمه شده. حالا شکست‌ها شمرده می‌شوند و اگر هیچ بسته‌ای موفق
 *     نشود، خطا بالا می‌رود تا در پاپ‌آپ دیده شود.
 *
 *   • **لحن دلخواه کاربر** — متنی که کاربر می‌نویسد به دستور سیستمی اضافه
 *     می‌شود، پس می‌شود گفت «محاوره‌ای»، «رسمی»، «مثل زیرنویس فیلم» و مانند آن.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

import { isQuotaError, parseRetryDelay, parseUsage } from "./usage.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * نام مستعار پایدار. گوگل نسخه‌های شماره‌دار را می‌آید و می‌برد، ولی این
 * نام همیشه به تازه‌ترین مدل سریع اشاره می‌کند.
 */
export const DEFAULT_TEXT_MODEL = "gemini-flash-latest";

/** اگر پیش‌فرض هم نبود، به ترتیب این‌ها امتحان می‌شوند */
export const MODEL_FALLBACKS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-2.5-flash"
];

/**
 * بسته‌های بزرگ‌تر، نه موازی‌سازی بیشتر.
 *
 * خطای ۴۲۹ سقف *نرخ* است، پس بالا بردن تعداد درخواست همزمان آن را بدتر می‌کند.
 * راه درست، کم کردن تعداد کل درخواست‌هاست: بسته‌ها از ۴۰ خط به ۸۰ خط رسیدند،
 * یعنی نیمِ درخواست برای همان زیرنویس. سقف کاراکتر هم بالا رفته ولی زیر
 * `maxOutputTokens` نگه داشته شده تا پاسخ وسط جمله بریده نشود.
 */
const MAX_LINES_PER_BATCH = 80;
const MAX_CHARS_PER_BATCH = 7000;

/** موازی‌سازی سازگارشونده: از این عدد شروع می‌کنیم و روی ۴۲۹ می‌آییم روی ۱ */
const START_CONCURRENCY = 2;
const MIN_CONCURRENCY = 1;

const BACKOFF_MS = [1200, 2800, 6000];
const REQUEST_TIMEOUT_MS = 60000;
const MAX_TONE_CHARS = 400;

/** پس از این تعداد برخورد سهمیه، ادامه دادن بی‌فایده است */
const MAX_QUOTA_HITS = 2;

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { i: { type: "INTEGER" }, t: { type: "STRING" } },
    required: ["i", "t"]
  }
};

export class TranslateError extends Error {
  constructor(code, vars) {
    super(code);
    this.code = code;
    this.vars = vars;
  }
  get payload() {
    return { code: this.code, vars: this.vars };
  }
}

/**
 * خطوط را به بسته‌هایی می‌شکند که هم کوتاه‌اند و هم مرز جمله را نمی‌شکنند.
 * @param {string[]} texts
 */
export function planBatches(texts, { maxLines = MAX_LINES_PER_BATCH, maxChars = MAX_CHARS_PER_BATCH } = {}) {
  const batches = [];
  let current = [];
  let chars = 0;

  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
    chars = 0;
  };

  texts.forEach((text, index) => {
    const length = String(text ?? "").length + 8;
    if (current.length >= maxLines || (current.length && chars + length > maxChars)) flush();
    current.push({ index, text: String(text ?? "") });
    chars += length;
  });
  flush();
  return batches;
}

/**
 * پاسخ مدل را دوباره به ترتیب ورودی می‌چیند.
 *
 * پایهٔ شماره‌گذاری با شمردن برخوردها انتخاب می‌شود، نه با اولین برخورد: یک
 * پاسخ یک‌مبنا روی خانه‌های صفرمبنا هم برخورد اتفاقی دارد. خطی که از قلم
 * افتاده باشد، متن مبدأ را نگه می‌دارد تا زیرنویس سوراخ نشود.
 */
export function alignTranslations(batch, rows) {
  const byIndex = new Map();
  for (const row of rows ?? []) {
    const position = Number(row?.i);
    const text = String(row?.t ?? "").trim();
    if (Number.isInteger(position) && text) byIndex.set(position, text);
  }

  const hits = (base) => batch.reduce((total, _item, offset) => total + (byIndex.has(offset + base) ? 1 : 0), 0);
  const base = hits(1) > hits(0) ? 1 : 0;

  return batch.map((item, offset) => byIndex.get(offset + base) ?? item.text);
}

/** متن لحن را کوتاه و بی‌خطر می‌کند */
export function sanitizeTone(tone) {
  return String(tone ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TONE_CHARS);
}

/**
 * دستور سیستمی.
 * زبان مبدأ اعلام نمی‌شود: تشخیصش کار خودِ مدل است، پس کاربر لازم نیست
 * زبان ویدئو را بداند یا انتخاب کند.
 */
export function buildInstructions(targetLanguage, tone) {
  const lines = [
    `You are a professional subtitle translator. Detect the source language yourself, then translate each numbered subtitle line into ${targetLanguage}.`,
    "Rules:",
    "1. Return one entry per input line, with the same `i` value. Never merge, split, drop or reorder lines.",
    "2. Translate for spoken delivery: natural, short, the way a subtitle reads on screen.",
    "3. Keep names, brands, code identifiers, numbers and units as they are.",
    "4. Never add commentary, notes, quotes, transliteration or the original text.",
    `5. Always answer in ${targetLanguage}, even if the line is a single word or an interjection.`,
    "6. If a line is only a sound effect, or already in the target language, return it unchanged."
  ];
  const wanted = sanitizeTone(tone);
  if (wanted) {
    lines.push(`7. Tone and register requested by the user — follow it closely: ${wanted}`);
  }
  return lines.join("\n");
}

export class TrackTranslator {
  /**
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} [options.model] خالی یا نامعتبر ⇒ خودکار انتخاب می‌شود
   * @param {string} options.targetLanguage نام انگلیسی زبان مقصد
   * @param {string} [options.tone] لحن دلخواه کاربر
   * @param {(done: number, total: number) => void} [options.onProgress]
   * @param {(model: string) => void} [options.onModel] مدلی که عملاً کار کرد
   */
  constructor({ apiKey, model, targetLanguage, tone, onProgress, onModel, onUsage, onQuota }) {
    this.apiKey = String(apiKey ?? "").trim();
    this.targetLanguage = targetLanguage;
    this.tone = sanitizeTone(tone);
    this.onProgress = onProgress ?? (() => {});
    this.onModel = onModel ?? (() => {});
    this.onUsage = onUsage ?? (() => {});
    this.onQuota = onQuota ?? (() => {});
    this.aborted = false;

    /** دروازهٔ نرخ: وقتی سرویس ۴۲۹ داد، همهٔ کارگرها تا این لحظه صبر می‌کنند */
    this.paceUntil = 0;
    this.concurrency = START_CONCURRENCY;
    this.quotaHits = 0;
    this.quotaMessage = "";

    /**
     * اندازه‌ای که تقسیم‌شدن تا انتها هم نجاتش نداد.
     * وقتی یک بسته در عمیق‌ترین تقسیم هم بریده شود، بسته‌های هم‌اندازه یا
     * کوچک‌تر دیگر تقسیم نمی‌شوند؛ وگرنه برای یک زیرنویس بی‌امید ده‌ها درخواست
     * می‌رفت و روی کلیدِ محدود همان سهمیهٔ باقی‌مانده را می‌سوزاند.
     */
    this.hopelessAt = 0;

    const wanted = String(model ?? "").trim();
    this.candidates = [...new Set([wanted, ...MODEL_FALLBACKS].filter(Boolean))];
    this.model = this.candidates[0];
    this.discovered = false;

    /** شمارش نتیجه‌ها، تا شکست بی‌صدا ممکن نباشد */
    this.stats = { batches: 0, ok: 0, failed: 0, requests: 0 };
    this.lastError = null;
  }

  abort() {
    this.aborted = true;
  }

  /**
   * @param {string[]} texts
   * @returns {Promise<string[]>} ترجمه‌ها، هم‌ترتیب با ورودی
   */
  async translate(texts) {
    if (!this.apiKey) throw new TranslateError("err.noKey");
    const batches = planBatches(texts);
    this.stats = { batches: batches.length, ok: 0, failed: 0, requests: 0 };
    const output = new Array(texts.length).fill("");
    let done = 0;

    const run = async (batch) => {
      const translated = await this.#sendBatch(batch);
      batch.forEach((item, offset) => { output[item.index] = translated[offset]; });
      done += batch.length;
      this.onProgress(done, texts.length);
    };

    // بستهٔ اول تنها می‌رود تا مدل درست یک بار پیدا شود و بقیهٔ بسته‌ها
    // بی‌جهت روی مدل غلط تلاش نکنند
    const [first, ...rest] = batches;
    if (first) await run(first);

    const queue = rest[Symbol.iterator]();
    const worker = async () => {
      for (const batch of queue) {
        if (this.aborted || this.quotaHits >= MAX_QUOTA_HITS) return;
        await run(batch);
      }
    };
    // تعداد کارگرها از روی وضعیت سهمیه انتخاب می‌شود، نه ثابت
    const workers = Math.max(MIN_CONCURRENCY, Math.min(this.concurrency, rest.length));
    await Promise.all(Array.from({ length: workers }, worker));

    // هیچ بسته‌ای موفق نشد ⇒ متن انگلیسی را به‌عنوان «ترجمه» تحویل نمی‌دهیم
    if (this.stats.ok === 0 && this.stats.failed > 0) {
      throw this.lastError ?? new TranslateError("err.translateFailed");
    }
    return output.map((text, index) => text || String(texts[index] ?? ""));
  }

  /**
   * فهرست مدل‌های همین کلید را می‌گیرد و اولین مدل سریعِ متنی را برمی‌دارد.
   * یک بار در هر جلسه.
   */
  async #discoverModel() {
    if (this.discovered) return null;
    this.discovered = true;
    try {
      const answer = await fetch(`${API_BASE}/models?pageSize=200`, {
        headers: { "x-goog-api-key": this.apiKey },
        signal: AbortSignal.timeout(20000)
      });
      if (!answer.ok) return null;
      const models = (await answer.json())?.models ?? [];
      const usable = models
        .filter((entry) => (entry.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((entry) => String(entry.name ?? "").replace(/^models\//, ""))
        .filter((name) => name && !/image|tts|audio|embedding|vision|live|robotics/i.test(name));
      const preferred = usable.find((name) => /flash-latest/.test(name))
        ?? usable.find((name) => /flash/.test(name) && !/lite/.test(name))
        ?? usable.find((name) => /flash/.test(name))
        ?? usable[0];
      return preferred ?? null;
    } catch {
      return null;
    }
  }

  /**
   * بستهٔ بریده‌شده را نصف می‌کند و هر نیمه را جدا می‌فرستد.
   *
   * بسته‌های بزرگ درخواست کمتری می‌برند، ولی اگر ترجمه بلندتر از سقف توکن
   * خروجی دربیاید پاسخ وسط JSON بریده می‌شود. به‌جای بازگشت به متن مبدأ،
   * همان‌جا بسته نصف می‌شود: بزرگ تا وقتی جواب می‌دهد، کوچک همان‌وقت که لازم شد.
   */
  async #splitBatch(batch, depth) {
    const middle = Math.ceil(batch.length / 2);
    const halves = [batch.slice(0, middle), batch.slice(middle)];
    const out = [];
    for (const half of halves) out.push(...(await this.#sendBatch(half, depth + 1)));
    return out;
  }

  async #sendBatch(batch, depth = 0) {
    const body = {
      systemInstruction: { parts: [{ text: buildInstructions(this.targetLanguage, this.tone) }] },
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify(batch.map((item, offset) => ({ i: offset, t: item.text }))) }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 8192
      }
    };

    let lastError = new TranslateError("err.translateFailed");
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
      if (this.aborted) return batch.map((item) => item.text);
      await this.#waitForPace();
      try {
        const rows = await this.#request(body);
        this.stats.ok += 1;
        this.onModel(this.model);
        return alignTranslations(batch, rows);
      } catch (error) {
        lastError = error;

        // سهمیه: صبر به همان اندازه‌ای که سرویس گفته، و تک‌خطی شدن
        if (error?.quota) {
          this.quotaHits += 1;
          this.quotaMessage = error.vars?.message ?? "";
          this.concurrency = MIN_CONCURRENCY;
          this.onQuota(this.quotaMessage, error.retryMs ?? 0);
          if (this.quotaHits >= MAX_QUOTA_HITS) break;
          this.paceUntil = Date.now() + Math.max(error.retryMs ?? 0, BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
          continue;
        }

        // پاسخ بریده شد: بسته را نصف کن، نه اینکه متن مبدأ را تحویل بدهی.
        //
        // ولی تقسیم فقط وقتی معنی دارد که *مدرکی* داشته باشیم کوچک‌تر جواب
        // می‌دهد. اگر یک بسته تا عمیق‌ترین تقسیم هم بریده شد و تا این لحظه
        // هیچ بسته‌ای موفق نشده، مشکل اندازه نیست و ادامهٔ تقسیم فقط سهمیه
        // می‌سوزاند — همان چیزی که با ۱۵ درخواست برای یک زیرنویس بی‌امید
        // اتفاق می‌افتاد.
        if (error?.truncated) {
          const smallerIsKnownToWork = this.stats.ok > 0;
          const worthSplitting = batch.length > 4
            && depth < 3
            && (this.hopelessAt === 0 || smallerIsKnownToWork);
          if (worthSplitting) return this.#splitBatch(batch, depth);
          this.hopelessAt = Math.max(this.hopelessAt, batch.length);
          break;
        }

        // مدل وجود ندارد: نامزد بعدی، و اگر نامزدی نماند، از سرویس بپرس
        if (error?.missingModel) {
          const next = this.candidates[this.candidates.indexOf(this.model) + 1]
            ?? (await this.#discoverModel());
          if (next && next !== this.model) {
            this.model = next;
            if (!this.candidates.includes(next)) this.candidates.push(next);
            attempt -= 1;                       // این تلاش را نسوزان
            continue;
          }
        }
        if (!error?.retryable || attempt === BACKOFF_MS.length) break;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]));
      }
    }

    this.stats.failed += 1;
    this.lastError = lastError;
    if (lastError instanceof TranslateError && lastError.code === "err.noKey") throw lastError;
    // شکست یک بسته کل زیرنویس را از بین نمی‌برد: متن مبدأ باقی می‌ماند
    return batch.map((item) => item.text);
  }

  /** همهٔ کارگرها روی دروازهٔ نرخ صبر می‌کنند، نه هر کدام جدا */
  async #waitForPace() {
    const wait = this.paceUntil - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 60000)));
  }

  async #request(body) {
    const url = `${API_BASE}/models/${encodeURIComponent(this.model)}:generateContent`;
    this.stats.requests += 1;
    let answer;
    try {
      answer = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (error) {
      const failure = new TranslateError("err.socket");
      failure.retryable = true;
      failure.detail = String(error?.message ?? error);
      throw failure;
    }

    if (!answer.ok) {
      const detail = await answer.text().catch(() => "");
      let message = `HTTP ${answer.status}`;
      try {
        message = JSON.parse(detail)?.error?.message ?? message;
      } catch {}
      let parsed = null;
      try {
        parsed = JSON.parse(detail)?.error ?? null;
      } catch {}

      const quota = isQuotaError({ status: answer.status, code: parsed?.status, message });
      const failure = new TranslateError(quota ? "err.quota" : "err.api", {
        message: String(message).slice(0, 180)
      });
      failure.retryable = answer.status === 429 || answer.status >= 500;
      failure.missingModel = answer.status === 404 || /not found|not supported/i.test(String(message));
      failure.quota = quota;
      failure.retryMs = quota ? parseRetryDelay(parsed, message) : 0;
      if (answer.status === 400 && /api key/i.test(String(message))) failure.code = "err.badKey";
      if (answer.status === 403 && !quota) failure.code = "err.badKey";
      throw failure;
    }

    const payload = await answer.json();
    // شمارش توکن از همان بلوکی که سرویس می‌دهد
    const sample = parseUsage(payload?.usageMetadata ?? payload?.usage_metadata);
    if (sample) this.onUsage(sample);

    const candidate = payload?.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((part) => part?.text ?? "").join("");
    // سقف توکن خروجی خورده: پاسخ وسط JSON بریده شده است
    const cut = String(candidate?.finishReason ?? "").toUpperCase() === "MAX_TOKENS";

    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("not an array");
      if (cut) {
        const failure = new TranslateError("err.translateFailed");
        failure.truncated = true;
        throw failure;
      }
      return rows;
    } catch (error) {
      if (error?.truncated) throw error;
      const failure = new TranslateError("err.translateFailed");
      // JSON ناقص هم همان نشانهٔ بریده‌شدن است
      failure.truncated = cut || /^\s*\[/.test(text);
      failure.retryable = !failure.truncated;
      throw failure;
    }
  }
}
