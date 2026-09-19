/**
 * خط تولید «زیرنویس واقعی سایت».
 *
 * مسیر کامل، از پیدا کردن فایل زیرنویس تا کیوی ترجمه‌شدهٔ آمادهٔ نمایش:
 *
 *   کشف  →  پارس  →  جمله‌سازی  →  حافظهٔ ترجمه  →  ترجمهٔ باقیمانده  →  ذخیره
 *
 * سه لایهٔ کشف امتحان می‌شود و اولین لایه‌ای که جواب بدهد برنده است. اگر هیچ‌کدام
 * زیرنویسی پیدا نکردند، `null` برمی‌گردد و افزونه به همان مسیر همیشگی خودش —
 * دوبلهٔ زندهٔ صدا — تکیه می‌کند.
 *
 * زبان مبدأ پرسیده نمی‌شود: تشخیصش کار مدل است. کاربر فقط زبان مقصد را
 * انتخاب می‌کند و اگر خواست، لحن ترجمه را می‌نویسد.
 *
 * صرفه‌جویی: کیوهای هم‌معنی یک بار ترجمه می‌شوند و هر خط ترجمه‌شده در حافظهٔ
 * ترجمه می‌ماند. بازتماشای همان ویدئو صفر درخواست شبکه دارد.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { groupIntoSentences, normalizeCues, parseCaptionFile } from "./track-parse.js";
import { readCaptionTrack, setCaptionsEnabled, sourceKey } from "./track-source.js";
import { findLanguage } from "./languages.js";
import { TrackTranslator } from "./translate-client.js";
import { forDisplay } from "./bidi.js";
import { recallLines, recallTrack, rememberLines, rememberTrack } from "./memory.js";

/** کمترین تعداد کیو که ارزش دارد مسیر زیرنویس را جای دوبله بنشانیم */
const MIN_USEFUL_CUES = 4;

/**
 * فاصلهٔ تلاش‌های کشف، بر حسب میلی‌ثانیه.
 *
 * پخش‌کننده‌ها فهرست زیرنویس را با تأخیر می‌سازند، و تا پیش از این یک تلاش
 * ناموفق یعنی «این ویدئو زیرنویس ندارد» — حتی وقتی داشت. این تلاش‌ها هیچ
 * هزینهٔ API ندارند، فقط خواندن از خودِ صفحه‌اند.
 */
const DISCOVERY_DELAYS_MS = [0, 600, 1200, 2000, 3000];

/**
 * لایهٔ ۱ و ۲: خواندن از دنیای صفحه (فهرست پخش‌کننده، سپس ردِ شبکه).
 */
async function discoverInPage(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readCaptionTrack,
      args: ["auto"]
    });
    const payload = result?.result;
    if (!payload?.ok || !payload.text) return null;
    const cues = parseCaptionFile(payload.text, payload.format);
    if (cues.length < MIN_USEFUL_CUES) return null;
    return {
      cues,
      lang: payload.lang ?? "",
      label: payload.label ?? "",
      method: payload.method ?? "player",
      videoId: payload.videoId ?? "",
      duration: payload.duration ?? 0
    };
  } catch {
    return null;
  }
}

/**
 * لایهٔ ۳: `video.textTracks` — پارسر WebVTT خودِ مرورگر.
 */
async function discoverInTrackList(tabId) {
  try {
    const payload = await chrome.tabs.sendMessage(tabId, {
      type: "dp-stage-collect",
      sourceLang: "auto"
    });
    if (!payload?.ok || !payload.cues?.length) return null;
    const cues = normalizeCues(payload.cues);
    if (cues.length < MIN_USEFUL_CUES) return null;
    return {
      cues,
      lang: payload.lang ?? "",
      label: payload.label ?? "",
      method: "texttrack",
      videoId: "",
      duration: payload.duration ?? 0
    };
  } catch {
    return null;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * کشف با چند تلاش.
 *
 * هر بار سه لایه امتحان می‌شود. اگر صفحه بگوید «هنوز آماده نیستم»، صبر
 * می‌کنیم و دوباره می‌پرسیم؛ اگر بگوید «فهرست خالی است»، یکی دو بار دیگر
 * امتحان می‌کنیم و بعد می‌پذیریم که این ویدئو زیرنویس ندارد.
 */
async function discover(tabId, onSearching) {
  for (const [index, delay] of DISCOVERY_DELAYS_MS.entries()) {
    if (delay) await wait(delay);
    onSearching?.(index + 1, DISCOVERY_DELAYS_MS.length);
    const found = (await discoverInPage(tabId)) ?? (await discoverInTrackList(tabId));
    if (found) return found;
  }
  return null;
}

/**
 * دکمهٔ CC خودِ پخش‌کننده را عوض می‌کند و نتیجه را برمی‌گرداند.
 */
async function switchPlayerCaptions(tabId, on) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: setCaptionsEnabled,
      args: [on]
    });
    return result?.result ?? null;
  } catch {
    return null;
  }
}

/**
 * کشف، با روشن‌کردن موقت زیرنویس خودِ پخش‌کننده.
 *
 * یوتیوب فهرست زیرنویس را تا وقتی CC روشن نشود نمی‌سازد؛ این همان دلیل واقعی
 * «زیرنویس پیدا نشد» بود. پس CC روشن می‌شود، فایل زیرنویس گرفته می‌شود و
 * **بلافاصله پیش از ترجمه** به حالت قبل برمی‌گردد — یعنی زیرنویس خودِ یوتیوب
 * فقط یک لحظه دیده می‌شود، نه در تمام مدت ترجمه.
 *
 * اگر کاربر خودش CC را روشن گذاشته بود، دست نمی‌زنیم و روشن می‌ماند.
 */
async function discoverWithPlayerCaptions(tabId, settings, onSearching) {
  if (settings.toggleCaptions === false) return discover(tabId, onSearching);

  const turned = await switchPlayerCaptions(tabId, true);
  try {
    return await discover(tabId, onSearching);
  } finally {
    // فقط چیزی که ما عوض کردیم برمی‌گردد
    if (turned?.changed) await switchPlayerCaptions(tabId, false);
  }
}

/**
 * کیو را برای نمایش آماده می‌کند.
 *
 * `text` تمیز می‌ماند چون همان به فایل زیرنویس و به حافظه می‌رود؛ `display` و
 * `dir` نسخهٔ بومی‌شده‌اند: فارسی راست‌چین، و تکه‌های لاتین داخلش با جداساز
 * یونیکد جدا می‌شوند تا جمله به‌هم نریزد.
 */
function decorate(cues) {
  return cues.map((cue) => {
    const shown = forDisplay(cue.text);
    // متن مبدأ هم آماده می‌شود، وگرنه سوییچ «زبان اصلی» باید در لحظه
    // محاسبه‌اش کند و آن هم داخل اسکریپت محتوا شدنی نیست.
    const original = cue.source ? forDisplay(cue.source) : null;
    return {
      ...cue,
      display: shown.text,
      dir: shown.dir,
      ...(original ? { sourceDisplay: original.text, sourceDir: original.dir } : {})
    };
  });
}

/**
 * زیرنویس سایت را پیدا، ترجمه و آمادهٔ نمایش می‌کند.
 *
 * @param {object} options
 * @param {number} options.tabId
 * @param {object} options.settings
 * @param {string} options.sourceUrl
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @returns {Promise<null | {cues: Array, lang: string, method: string, origin: string,
 *   fromMemory: number, translated: number, model: string}>}
 */
export async function buildTranslatedTrack({
  tabId, settings, sourceUrl, onProgress, onUsage, onQuota, onSearching
}) {
  const found = await discoverWithPlayerCaptions(tabId, settings, onSearching);
  if (!found) return null;

  const sentences = groupIntoSentences(found.cues);
  if (sentences.length < MIN_USEFUL_CUES) return null;

  const target = settings.targetLang ?? "fa";
  const tone = String(settings.tonePrompt ?? "").trim();
  // کلید کش روی *خواستهٔ* کاربر بسته می‌شود، نه مدلی که عملاً پیدا شد، وگرنه
  // عوض‌شدن نام مدل در سرویس کل حافظه را بی‌اعتبار می‌کند. لحن هم در کلید
  // هست، چون ترجمهٔ محاوره‌ای با ترجمهٔ رسمی یکی نیست.
  const cacheModel = `${String(settings.textModel ?? "auto").trim() || "auto"}${tone ? `|${tone}` : ""}`;
  const key = sourceKey(sourceUrl, found.videoId);
  const identity = { key, lang: found.lang || "auto", target, model: cacheModel };
  const useMemory = settings.translationMemory !== false;

  // ── مسیر سریع: همین ویدئو قبلاً ترجمه شده است ──────────────────
  if (useMemory) {
    const remembered = await recallTrack(identity);
    if (remembered?.complete && remembered.cues?.length === sentences.length) {
      return {
        cues: decorate(remembered.cues),
        lang: found.lang,
        method: found.method,
        origin: "memory",
        fromMemory: remembered.cues.length,
        translated: 0,
        model: ""
      };
    }
  }

  // ── زبان مبدأ همان زبان مقصد است: ترجمه بی‌معنی است ─────────────
  const baseLang = String(found.lang || "").toLowerCase().split("-")[0];
  if (baseLang && baseLang === String(target).toLowerCase().split("-")[0]) {
    const cues = sentences.map((cue) => ({ ...cue, source: "" }));
    if (useMemory) await rememberTrack(identity, { cues, complete: true });
    return {
      cues: decorate(cues),
      lang: found.lang,
      method: found.method,
      origin: "same-language",
      fromMemory: 0,
      translated: 0,
      model: ""
    };
  }

  // ── حافظهٔ ترجمه: خطوطی که قبلاً دیده‌ایم ────────────────────────
  const texts = sentences.map((cue) => cue.text);
  const known = useMemory ? await recallLines({ target, model: cacheModel, texts }) : new Map();

  // خطوط تکراری داخل همین ویدئو هم فقط یک بار فرستاده می‌شوند
  const missing = [...new Set(texts.filter((text) => !known.has(text)))];
  let translatedCount = 0;
  let usedModel = "";
  let quotaHit = false;
  let quotaMessage = "";
  let requests = 0;

  if (missing.length) {
    const translator = new TrackTranslator({
      apiKey: settings.apiKey,
      model: settings.textModel,
      targetLanguage: findLanguage(target).english,
      tone,
      onProgress: (done) => onProgress?.(known.size + done, texts.length),
      onModel: (model) => { usedModel = model; },
      onUsage,
      onQuota
    });
    // خطای ترجمه عمداً بالا می‌رود: زیرنویس انگلیسیِ ترجمه‌نشده نباید
    // به‌عنوان نتیجهٔ موفق تحویل داده شود.
    const results = await translator.translate(missing);
    quotaHit = translator.quotaHits > 0;
    quotaMessage = translator.quotaMessage;
    requests = translator.stats.requests;
    const pairs = [];
    missing.forEach((text, index) => {
      const translation = String(results[index] ?? "").trim();
      if (!translation) return;
      known.set(text, translation);
      if (translation !== text) pairs.push({ source: text, text: translation });
    });
    translatedCount = pairs.length;
    if (useMemory && pairs.length) await rememberLines({ target, model: cacheModel, pairs });
  }

  const cues = sentences.map((cue) => ({
    start: cue.start,
    end: cue.end,
    text: known.get(cue.text) ?? cue.text,
    source: cue.text
  }));

  // چند خط عملاً ترجمه نشده باقی ماند؟ اگر سهمیه وسط کار تمام شود، همان
  // بخشِ ترجمه‌شده تحویل داده می‌شود، ولی صادقانه علامت می‌خورد.
  const untranslated = cues.filter((cue) => cue.text === cue.source).length;

  // نتیجهٔ نیمه‌کاره **به‌عنوان کل زیرنویس کش نمی‌شود**. وگرنه بار بعد مسیر
  // سریعِ حافظه همان نیمه‌کاره را برمی‌گرداند و خطوط جامانده هرگز کامل
  // نمی‌شوند. خطوطی که موفق شدند در حافظهٔ تک‌خطی هستند، پس تلاش بعدی فقط
  // هزینهٔ همان خطوط باقی‌مانده را دارد.
  if (useMemory && untranslated === 0) await rememberTrack(identity, { cues, complete: true });

  return {
    cues: decorate(cues),
    lang: found.lang,
    method: found.method,
    origin: translatedCount ? "translated" : "memory",
    fromMemory: texts.length - missing.length,
    translated: translatedCount,
    model: usedModel,
    requests,
    untranslated,
    partial: quotaHit && untranslated > 0,
    quotaMessage
  };
}
