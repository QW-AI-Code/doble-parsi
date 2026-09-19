/**
 * سرویس‌ورکر: هماهنگ‌کننده بین پاپ‌آپ، تب فعال، صحنهٔ روی ویدئو و سند offscreen.
 *
 * نام و مسیر فایل خروجی:
 * کروم برای دانلودهایی که از blob: شروع می‌شوند، اگر نام پیشنهادی را
 * نپسندد یا پسوند را با نوع MIME جور نبیند، خودش یک نام تصادفی (UUID)
 * می‌سازد و پسوند را عوض می‌کند. برای همین دو کار انجام می‌دهیم:
 *   ۱) نام دلخواه را قبل از دانلود ثبت می‌کنیم،
 *   ۲) در رویداد onDeterminingFilename همان نام را به کروم تحمیل می‌کنیم.
 *
 * مسیر یک مسیر نسبی چندبخشی است و همان‌طور دست‌نخورده به کروم می‌رسد:
 *   Doble Parsi/<نام ویدئو>/<نام ویدئو>.mp3
 * پس خروجی‌های هر جلسه در پوشهٔ خودشان می‌مانند و پوشهٔ دانلود شلوغ نمی‌شود.
 *
 * صحنهٔ روی ویدئو:
 * هیچ `content_scripts` در مانیفست ثبت نشده. اسکریپت صحنه فقط وقتی تزریق
 * می‌شود که کاربر خودش دکمه را زده باشد، و از راه `activeTab` — یعنی دسترسی
 * موقت به همان یک تب، نه دسترسی دائم به هیچ سایتی.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { loadSettings, saveSettings, stageConfig } from "./defaults.js";
import { buildTranslatedTrack } from "./track-pipeline.js";
import { toSrt, toVtt } from "./captions.js";
import { buildOutputPath, timestampTag } from "./filenames.js";
import { clear as clearMemory, stats as memoryStats } from "./memory.js";
import { forDisplay } from "./bidi.js";
import { probeModels, testKey } from "./api-check.js";
import * as usage from "./usage.js";
import { setLang, digits, t } from "./i18n.js";

const OFFSCREEN_PATH = "src/offscreen.html";
const STATE_KEY = "dubleParsiState";
const STAGE_FILES = ["src/overlay/stage-css.js", "src/overlay/stage.js"];

const state = {
  phase: "idle", // idle | starting | live | stopping
  tabId: null,
  tabTitle: "",
  sourceUrl: "",
  startedAt: 0,
  elapsedMs: 0,
  audioMs: 0,
  cueCount: 0,
  dubText: "",
  sourceText: "",
  error: null,     // { code, vars } | null
  notices: [],     // [{ code, vars }]
  files: [],
  transcript: "",

  // ── صحنهٔ زیرنویس روی ویدئو ───────────────────────────────────
  stagePhase: "idle",  // idle | working | track | live
  stageTabId: null,
  stageSearch: null,   // { attempt, total } هنگام گشتن برای زیرنویس
  textModelInUse: "",  // مدلی که عملاً جواب داد، برای نمایش در پاپ‌آپ
  stageError: null,
  stageProgress: 0,
  track: null          // { count, lang, method, origin, fromMemory, translated }
};

/** نام فایل‌های در انتظار دانلود: url ⇒ filename */
const pendingNames = new Map();

/** تب‌هایی که اسکریپت صحنه در آن‌ها زنده است */
const stagedTabs = new Set();

/** کیوهای ترجمه‌شدهٔ جلسهٔ فعلی صحنه، برای خروجی گرفتن */
let trackCues = [];

/**
 * متن غلتان صحنه در حالت دوبلهٔ زنده.
 *
 * مدل متن را تکه‌تکه می‌فرستد («خیلی» ، « خوب» ، « است.»). نشان دادن هر تکه
 * روی ویدئو خواندنی نیست، پس تکه‌ها تا مرز جمله به هم می‌چسبند و بعد از هر
 * جمله از نو شروع می‌شوند. طول هم سقف دارد تا زیرنویس بلندتر از دو خط نشود.
 */
const stageLive = { dub: "", source: "" };
const SENTENCE_END = /[.!?؟…۔。！？]["'”»)\]]?\s*$/u;
const MAX_LIVE_CHARS = 170;

function rollCaption(previous, chunk) {
  const piece = String(chunk ?? "").trim();
  if (!piece) return previous;
  let text = SENTENCE_END.test(previous) ? piece : `${previous} ${piece}`.trim();
  if (text.length > MAX_LIVE_CHARS) {
    const cut = text.slice(text.length - MAX_LIVE_CHARS);
    text = cut.slice(Math.max(0, cut.search(/\s/) + 1));
  }
  return text.replace(/\s+/g, " ");
}

class CodedError extends Error {
  constructor(code, vars) {
    super(code);
    this.code = code;
    this.vars = vars;
  }
  get payload() {
    return { code: this.code, vars: this.vars };
  }
}

function toPayload(error) {
  if (error instanceof CodedError) return error.payload;
  if (error && typeof error === "object" && error.code) return { code: error.code, vars: error.vars };
  return { code: "err.unknown" };
}

function snapshot() {
  return { ...state, notices: [...state.notices], files: [...state.files] };
}

async function publish() {
  const payload = snapshot();
  chrome.storage.session?.set({ [STATE_KEY]: payload }).catch(() => {});
  chrome.runtime.sendMessage({ type: "dp-state", state: payload }).catch(() => {});
}

async function setBadge(live) {
  try {
    await chrome.action.setBadgeText({ text: live ? "REC" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#3b6dff" });
  } catch {}
}

async function hasOffscreen() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    return contexts.length > 0;
  }
  return false;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
    justification: "Capture tab audio, play the dub and build MP3/subtitle output"
  });
}

async function closeOffscreen() {
  if (await hasOffscreen()) {
    try {
      await chrome.offscreen.closeDocument();
    } catch {}
  }
}

/**
 * نام واقعی ویدئوی صفحه.
 *
 * عنوان تب همیشه نام ویدئو نیست (مثلاً «(۳) عنوان - YouTube» یا عنوان کلی سایت
 * پیش از بارگذاری ویدئو). پس داخل صفحه به ترتیب اعتبار دنبال نام می‌گردیم:
 * mediaSession → og:title → تیتر صفحهٔ ویدئو → title خودِ عنصر video → عنوان تب.
 */
function extractVideoTitle() {
  const pick = (value) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > 1 ? text : "";
  };

  // ۱) متادیتای مدیا: دقیق‌ترین منبع در یوتیوب، آپارات، اسپاتیفای و …
  const media = pick(navigator.mediaSession?.metadata?.title);
  if (media) return media;

  // ۲) متاتگ‌های اشتراک‌گذاری
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
    const meta = pick(document.querySelector(selector)?.getAttribute("content"));
    if (meta) return meta;
  }

  // ۳) تیتر صفحهٔ پخش
  for (const selector of [
    "h1.ytd-watch-metadata", "#title h1", "h1.video-title", "h1.title", "h1"
  ]) {
    const heading = pick(document.querySelector(selector)?.textContent);
    if (heading) return heading;
  }

  // ۴) خود عنصر ویدئو
  const video = document.querySelector("video");
  const label = pick(video?.title || video?.getAttribute("aria-label"));
  if (label) return label;

  return pick(document.title);
}

/** خواندن نام ویدئو از تب؛ اگر نشد، به عنوان تب برمی‌گردیم */
async function readSourceMeta(tabId, fallbackTitle, fallbackUrl) {
  const meta = { title: String(fallbackTitle ?? "").trim(), url: fallbackUrl ?? "" };
  if (typeof tabId !== "number" || !chrome.scripting?.executeScript) return meta;

  // دنیای MAIN را اول امتحان می‌کنیم چون mediaSession را همان‌جا می‌بینیم؛
  // اگر اجازه نداد، به دنیای جداشده برمی‌گردیم (DOM در هر دو یکی است).
  for (const world of ["MAIN", "ISOLATED"]) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        world,
        func: extractVideoTitle
      });
      const title = String(result?.result ?? "").trim();
      if (title) {
        meta.title = title;
        return meta;
      }
    } catch {}
  }
  return meta;
}

function tabIsCapturable(url) {
  return !(!url || /^(chrome|edge|about|devtools|chrome-extension|view-source|moz-extension):/i.test(url));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new CodedError("err.noTab");
  if (!tabIsCapturable(tab.url)) throw new CodedError("err.badTab");
  return tab;
}

/* ══════════════════════ صحنهٔ زیرنویس روی ویدئو ══════════════════════ */

/**
 * اسکریپت صحنه را در تب می‌گذارد.
 * تزریق بی‌خطر است: اسکریپت خودش می‌فهمد از قبل بوده و فقط تازه می‌شود.
 *
 * `allFrames` روشن است چون در پخش‌کنندهٔ توکار (یوتیوب داخل یک سایت دیگر،
 * ویمیو، کورسرا) عنصر ویدئو در یک iframe است، نه در فریم بالا. فریم‌های
 * بی‌ویدئو هیچ چیزی رندر نمی‌کنند و به پیام‌های کشف هم جواب نمی‌دهند.
 */
async function ensureStage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: STAGE_FILES
    });
    stagedTabs.add(tabId);
    return results.length;
  } catch {
    // بعضی صفحه‌ها فقط فریم بالا را می‌پذیرند؛ همان هم کافی است
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: STAGE_FILES });
      stagedTabs.add(tabId);
      return 1;
    } catch {
      throw new CodedError("err.stageInject");
    }
  }
}

async function tellStage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

/** تنظیمات ظاهری را زنده به صحنه می‌رساند، پس تغییر قالب فوری دیده می‌شود */
/**
 * تنظیمات ظاهری را زنده به صحنه می‌رساند.
 *
 * تبِ فعال **همیشه** هدف است، نه فقط تب‌هایی که در حافظه به یاد داریم:
 * سرویس‌ورکر MV3 بعد از بی‌کاری کشته می‌شود و با آن `stagedTabs` و
 * `state.stageTabId` خالی می‌شوند. تا پیش از این، عوض کردن قالب در آن حالت
 * هیچ هدفی نداشت و کاربر مجبور بود دکمه را دوباره بزند و از نو ترجمه کند.
 */
async function pushStageConfig(settings) {
  const targets = new Set(stagedTabs);
  if (state.stageTabId) targets.add(state.stageTabId);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tabIsCapturable(tab.url)) targets.add(tab.id);
  } catch {}

  const config = stageConfig(settings);
  for (const tabId of targets) await tellStage(tabId, { type: "dp-stage-config", config });
  return targets.size;
}

function badgeFor(origin, count) {
  const n = digits(count);
  if (origin === "memory") return { kind: "memory", text: t("stage.badge.memory", { n }) };
  if (origin === "live") return { kind: "live", text: t("stage.badge.live") };
  if (origin === "same-language") return { kind: "track", text: t("stage.badge.original", { n }) };
  return { kind: "track", text: t("stage.badge.site", { n }) };
}

/**
 * جلسهٔ نمایش زیرنویس روی ویدئو را شروع می‌کند.
 * اگر سایت زیرنویس واقعی داشته باشد، همان با زمان‌بندی خودش نمایش داده
 * می‌شود — بدون گرفتن صدا، بدون دوبله و بدون هزینهٔ صوتی.
 */
async function startStage() {
  const settings = await loadSettings();
  setLang(settings.uiLang);
  const tab = await activeTab();

  state.stagePhase = "working";
  state.stageError = null;
  state.stageProgress = 0;
  state.stageSearch = null;
  state.stageTabId = tab.id;
  state.track = null;
  trackCues = [];
  stageLive.dub = "";
  stageLive.source = "";
  await publish();

  try {
    await ensureStage(tab.id);
    await tellStage(tab.id, { type: "dp-stage-config", config: stageConfig(settings) });

    if (settings.useSiteCaptions === false) {
      state.stagePhase = "live";
      await publish();
      return snapshot();
    }

    await usage.startSession();
    const built = await buildTranslatedTrack({
      tabId: tab.id,
      settings,
      sourceUrl: tab.url ?? "",
      onUsage: (sample) => usage.record(sample),
      onQuota: (message, retryMs) => usage.noteQuota(message, retryMs),
      onSearching: (attempt, total) => {
        state.stageSearch = { attempt, total };
        publish();
      },
      onProgress: (done, total) => {
        const next = total ? Math.round((done / total) * 100) : 0;
        if (next !== state.stageProgress) {
          state.stageProgress = next;
          publish();
        }
      }
    });

    if (!built) {
      // زیرنویسی در سایت نبود. اگر کاربر اجازه داده باشد، همان لحظه مسیر
      // زندهٔ ترجمه روشن می‌شود: صدای تب گرفته و متنش روی ویدئو نوشته
      // می‌شود. صدای دوبله عمداً خاموش است، چون خواستهٔ کاربر زیرنویس بود
      // نه دوبله.
      state.stageSearch = null;
      if (settings.liveFallback !== false) {
        const started = await startLiveSubtitles(settings, tab.id);
        if (started) return snapshot();
      }
      state.stagePhase = "live";
      state.stageError = { code: "err.noSiteTrack" };
      await publish();
      return snapshot();
    }
    state.stageSearch = null;
    if (built.model) state.textModelInUse = built.model;
    // ترجمهٔ نیمه‌کاره صادقانه علامت می‌خورد، نه اینکه موفق جا بزند
    state.stageError = built.partial
      ? { code: "err.quotaPartial", vars: { n: digits(built.untranslated) } }
      : null;

    trackCues = built.cues;
    state.track = {
      count: built.cues.length,
      lang: built.lang,
      method: built.method,
      origin: built.origin,
      fromMemory: built.fromMemory,
      translated: built.translated
    };
    state.stagePhase = "track";
    state.stageProgress = 100;
    await tellStage(tab.id, {
      type: "dp-stage-cues",
      cues: built.cues,
      badge: badgeFor(built.origin, built.cues.length)
    });
    await publish();
    return snapshot();
  } catch (error) {
    state.stagePhase = "idle";
    state.stageTabId = null;
    state.stageError = toPayload(error);
    await publish();
    return snapshot();
  }
}

async function stopStage() {
  const tabId = state.stageTabId;
  state.stagePhase = "idle";
  state.stageTabId = null;
  state.stageProgress = 0;
  state.track = null;
  trackCues = [];
  stageLive.dub = "";
  stageLive.source = "";
  if (typeof tabId === "number") await tellStage(tabId, { type: "dp-stage-clear" });
  await publish();
  return snapshot();
}

/**
 * زیرنویس زنده، وقتی ویدئو هیچ زیرنویسی ندارد.
 *
 * همان موتور دوبله را روشن می‌کند ولی با **صدای دوبله خاموش** و بدون فایل
 * صوتی: صدای تب گرفته می‌شود، مدل متنش را برمی‌گرداند و همان روی ویدئو
 * نوشته می‌شود. یعنی زیرنویس زنده، نه دوبله.
 */
async function startLiveSubtitles(settings, tabId) {
  if (state.phase !== "idle") return false;
  try {
    await startDubbing({
      ...settings,
      livePlayback: false,   // فقط متن، بدون صدای دوبله
      saveMp3: false,
      saveSubtitle: true     // حداقل یک خروجی لازم است
    });
    state.stagePhase = "live";
    state.stageTabId = tabId;
    state.stageError = { code: "err.liveFallback" };
    await publish();
    return true;
  } catch {
    return false;
  }
}

/**
 * صحنه خبر داده که ویدئو عوض شده است.
 *
 * زیرنویس کهنه همان‌جا در صفحه پاک شده؛ اینجا کیوهای ذخیره‌شده هم دور ریخته
 * می‌شوند تا «ذخیرهٔ این زیرنویس» فایل ویدئوی قبلی را ننویسد. اگر «ادامهٔ
 * خودکار» روشن باشد و جلسه‌ای در جریان بوده، ویدئوی تازه خودش گرفته می‌شود.
 *
 * یک مکث لازم است: پخش‌کننده تازه راه افتاده و فهرست زیرنویسش هنوز آماده
 * نیست. اگر بار اول چیزی پیدا نشد، یک بار دیگر با فاصلهٔ بیشتر امتحان می‌کنیم.
 */
const RESUME_DELAYS_MS = [1400, 3200];
let resumeTimer = null;

async function handleVideoChanged(tabId) {
  const wasRunning = state.stagePhase === "track" || state.stagePhase === "live";
  trackCues = [];
  state.track = null;
  state.stageProgress = 0;
  state.stageError = null;
  stageLive.dub = "";
  stageLive.source = "";
  if (state.stagePhase !== "idle") state.stagePhase = "idle";
  await publish();

  const settings = await loadSettings();
  if (settings.autoContinue === false || !wasRunning) return;
  if (settings.useSiteCaptions === false) return;

  clearTimeout(resumeTimer);
  let attempt = 0;
  const tryAgain = () => {
    resumeTimer = setTimeout(async () => {
      attempt += 1;
      // کاربر خودش جلسهٔ تازه‌ای شروع کرده؟ دست نگه دار
      if (state.stagePhase === "track" || state.stagePhase === "working") return;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== tabId) return;
      const data = await startStage().catch(() => null);
      if (data?.stagePhase !== "track" && attempt < RESUME_DELAYS_MS.length) tryAgain();
    }, RESUME_DELAYS_MS[attempt]);
  };
  tryAgain();
}

/** گزارش تشخیص از خودِ صفحه */
async function diagnoseStage() {
  const tab = await activeTab();
  await ensureStage(tab.id);
  const answer = await tellStage(tab.id, { type: "dp-stage-diagnose" });
  return answer ?? { ok: false, reason: "no-answer" };
}

/** زیرنویس ترجمه‌شدهٔ سایت را به‌صورت فایل ذخیره می‌کند */async function saveTrackFiles() {
  if (!trackCues.length) throw new CodedError("err.noTrackCues");
  const settings = await loadSettings();
  setLang(settings.uiLang);
  const meta = await readSourceMeta(state.stageTabId, "", "");
  const tab = state.stageTabId ? await chrome.tabs.get(state.stageTabId).catch(() => null) : null;
  const title = meta.title || tab?.title || "";
  const url = tab?.url ?? "";

  const tag = timestampTag();
  const formats = settings.subtitleFormat === "both"
    ? ["srt", "vtt"]
    : [settings.subtitleFormat === "vtt" ? "vtt" : "srt"];

  const files = [];
  const jobs = [
    { cues: trackCues, suffix: "" },
    ...(settings.bilingualSubtitle && trackCues.some((cue) => cue.source)
      ? [{ cues: trackCues.map((cue) => ({ ...cue, text: cue.source })), suffix: "original" }]
      : [])
  ];

  for (const job of jobs) {
    const cues = job.cues.filter((cue) => cue.text?.trim());
    if (!cues.length) continue;
    for (const format of formats) {
      const text = format === "vtt" ? toVtt(cues) : `\uFEFF${toSrt(cues)}`;
      const filename = buildOutputPath({
        title, url, extension: format, suffix: job.suffix, tag,
        useOriginalName: settings.useOriginalFilename !== false
      });
      files.push(await saveText(text, filename, format));
    }
  }
  if (!files.length) throw new CodedError("err.noTrackCues");

  state.files = files;
  state.notices = [];
  state.transcript = trackCues.map((cue) => cue.text).join("\n");
  await publish();
  return { files };
}

/* ══════════════════════ دوبلهٔ زنده ══════════════════════ */

async function startDubbing(settings) {
  if (state.phase !== "idle") throw new CodedError("err.busy");

  const tab = await activeTab();
  setLang(settings.uiLang);

  state.phase = "starting";
  state.error = null;
  state.notices = [];
  state.files = [];
  state.transcript = "";
  state.dubText = "";
  state.sourceText = "";
  state.cueCount = 0;
  state.audioMs = 0;
  state.elapsedMs = 0;
  state.tabId = tab.id;
  state.tabTitle = tab.title ?? "";
  state.sourceUrl = tab.url ?? "";
  await publish();

  try {
    await usage.startSession();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const meta = await readSourceMeta(tab.id, tab.title, tab.url);
    state.tabTitle = meta.title || state.tabTitle;
    await ensureOffscreen();
    const response = await chrome.runtime.sendMessage({
      type: "dp-off-start",
      streamId,
      settings,
      sourceTitle: meta.title,
      sourceUrl: meta.url
    });
    if (!response?.ok) throw new CodedError(response?.error?.code ?? "err.startFailed", response?.error?.vars);

    state.phase = "live";
    state.startedAt = Date.now();
    await setBadge(true);

    // صحنه هم روشن می‌شود تا متن دوبله روی خود ویدئو دیده شود
    if (settings.overlay !== false) {
      try {
        await ensureStage(tab.id);
        await tellStage(tab.id, { type: "dp-stage-config", config: stageConfig(settings) });
        if (state.stagePhase !== "track") {
          state.stagePhase = "live";
          state.stageTabId = tab.id;
          stageLive.dub = "";
          stageLive.source = "";
          await tellStage(tab.id, { type: "dp-stage-live", dub: "", badge: badgeFor("live", 0) });
        }
      } catch {
        state.stageError = { code: "err.stageInject" };
      }
    }

    await publish();
    return snapshot();
  } catch (error) {
    state.phase = "idle";
    state.error = toPayload(error);
    await closeOffscreen();
    await setBadge(false);
    await publish();
    throw error;
  }
}

async function stopDubbing() {
  if (state.phase === "idle") return snapshot();
  state.phase = "stopping";
  await publish();

  // نام ویدئو را دوباره می‌خوانیم: ممکن است هنگام شروع، صفحه هنوز کامل
  // بارگذاری نشده و عنوان درست در دسترس نبوده باشد.
  const meta = await readSourceMeta(state.tabId, state.tabTitle, state.sourceUrl);
  state.tabTitle = meta.title || state.tabTitle;

  let result = { files: [], errors: [], transcript: "" };
  try {
    const response = await chrome.runtime.sendMessage({
      type: "dp-off-stop",
      sourceTitle: meta.title,
      sourceUrl: meta.url
    });
    if (response?.ok) result = response.data ?? result;
    else if (response?.error) result.errors = [response.error];
  } catch {
    result.errors = [{ code: "err.stopFailed" }];
  }

  await closeOffscreen();
  await setBadge(false);

  if (state.stagePhase === "live" && typeof state.tabId === "number") {
    await tellStage(state.tabId, { type: "dp-stage-clear" });
    state.stagePhase = "idle";
    state.stageTabId = null;
  }

  state.phase = "idle";
  state.files = result.files ?? [];
  state.notices = result.errors ?? [];
  state.transcript = result.transcript ?? "";
  state.startedAt = 0;
  await publish();
  return snapshot();
}

/* ══════════════════════ ذخیرهٔ فایل ══════════════════════ */

/** پاک‌سازی یک بخش از مسیر (نام پوشه یا نام فایل) */
function safeSegment(value) {
  return String(value ?? "")
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
}

/**
 * پاک‌سازی نهایی مسیر خروجی در سمت سرویس‌ورکر (خط دفاعی دوم).
 * جداکننده‌ی پوشه‌ها حفظ می‌شود تا ساختار پوشه‌بندی از بین نرود،
 * ولی «..» و بخش‌های خالی حذف می‌شوند (مسیر باید نسبی و بی‌خطر بماند).
 */
function safeFilename(name, fallbackExt) {
  const segments = String(name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map(safeSegment)
    .filter((part) => part && part !== "." && part !== "..");

  let file = segments.pop() ?? "";
  if (!file) file = `dobleparsi.${fallbackExt ?? "bin"}`;
  if (fallbackExt && !file.toLowerCase().endsWith(`.${fallbackExt.toLowerCase()}`)) {
    file = `${file}.${fallbackExt}`;
  }
  return [...segments, file].join("/");
}

/**
 * متن را بدون سند offscreen ذخیره می‌کند.
 * در سرویس‌ورکر MV3 نه `URL.createObjectURL` هست و نه `Blob` قابل دانلود،
 * پس زیرنویس با یک data URL پایه‌۶۴ به `chrome.downloads` می‌رود. برای فایل
 * متنی چند ده کیلوبایتی این کم‌هزینه‌ترین راه است.
 */
function toDataUrl(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:application/octet-stream;base64,${btoa(binary)}`;
}

async function saveText(text, filename, extension) {
  const url = toDataUrl(text);
  const result = await saveFile({ blobUrl: url, filename, extension });
  if (!result.ok) throw new CodedError(result.error?.code ?? "err.download");
  return { filename: result.filename, bytes: new TextEncoder().encode(text).length };
}

async function saveFile({ blobUrl, filename, extension }) {
  const wanted = safeFilename(filename, extension);
  pendingNames.set(blobUrl, wanted);
  try {
    const id = await chrome.downloads.download({
      url: blobUrl,
      filename: wanted,
      conflictAction: "uniquify",
      saveAs: false
    });
    return { ok: true, id, filename: wanted };
  } catch (error) {
    pendingNames.delete(blobUrl);
    return { ok: false, error: { code: "err.download" }, detail: String(error?.message ?? error) };
  }
}

// کروم اجازه می‌دهد نام نهایی را همین‌جا بازنویسی کنیم؛ این تنها راه
// قطعی برای جلوگیری از نام‌های تصادفی و پسوند عوض‌شده است.
chrome.downloads.onDeterminingFilename?.addListener((item, suggest) => {
  const wanted = pendingNames.get(item.url) ?? pendingNames.get(item.finalUrl);
  if (!wanted) {
    suggest();
    return;
  }
  pendingNames.delete(item.url);
  pendingNames.delete(item.finalUrl);
  suggest({ filename: wanted, conflictAction: "uniquify" });
});

/* ══════════════════════ پیام‌ها ══════════════════════ */

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const type = message?.type;

  if (type === "dp-start") {
    startDubbing(message.settings)
      .then((data) => respond({ ok: true, state: data }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stop") {
    stopDubbing()
      .then((data) => respond({ ok: true, state: data }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stage-start") {
    startStage()
      .then((data) => respond({ ok: !data.stageError, state: data, error: data.stageError }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stage-stop") {
    stopStage()
      .then((data) => respond({ ok: true, state: data }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stage-save") {
    saveTrackFiles()
      .then((data) => respond({ ok: true, ...data }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stage-diagnose-request") {
    diagnoseStage()
      .then((data) => respond({ ok: Boolean(data?.ok), report: data }))
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-stage-refresh") {
    // تغییر قالب، رنگ یا اندازه در پاپ‌آپ، همان لحظه روی ویدئو دیده می‌شود
    pushStageConfig(message.settings ?? {})
      .then((reached) => respond({ ok: true, reached }))
      .catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-stage-video-changed") {
    handleVideoChanged(sender?.tab?.id).catch(() => {});
    return false;
  }

  if (type === "dp-stage-position") {
    // کاربر زیرنویس را با دستگیره جابه‌جا کرده؛ موقعیت را ماندگار می‌کنیم
    loadSettings()
      .then((settings) => saveSettings({
        ...settings,
        overlayX: Number(message.position?.x ?? settings.overlayX),
        overlayY: Number(message.position?.y ?? settings.overlayY)
      }))
      .catch(() => {});
    return false;
  }

  if (type === "dp-api-test") {
    loadSettings()
      .then((settings) => testKey(message.apiKey ?? settings.apiKey, settings.textModel))
      .then((result) => {
        if (result.usage) usage.record(result.usage);
        if (result.kind === "quota") usage.noteQuota(result.message, result.retryMs);
        respond({ ok: result.ok, result });
      })
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-api-models") {
    loadSettings()
      .then((settings) => probeModels(message.apiKey ?? settings.apiKey, {
        onUsage: (sample) => usage.record(sample)
      }))
      .then((result) => {
        if (result.quota) usage.noteQuota(result.quota.message, result.quota.retryMs);
        respond({ ok: result.models.length > 0, ...result });
      })
      .catch((error) => respond({ ok: false, error: toPayload(error) }));
    return true;
  }

  if (type === "dp-usage-get") {
    usage.snapshot().then((data) => respond({ ok: true, usage: data })).catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-usage-limit") {
    usage.setDailyLimit(message.limit)
      .then(() => usage.snapshot())
      .then((data) => respond({ ok: true, usage: data }))
      .catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-usage-clear") {
    (message.quotaOnly ? usage.clearQuota() : usage.clearAll())
      .then(() => usage.snapshot())
      .then((data) => respond({ ok: true, usage: data }))
      .catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-memory-stats") {
    memoryStats().then((data) => respond({ ok: true, ...data })).catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-memory-clear") {
    clearMemory().then((ok) => respond({ ok })).catch(() => respond({ ok: false }));
    return true;
  }

  if (type === "dp-get-state") {
    respond({ ok: true, state: snapshot() });
    return false;
  }

  if (type === "dp-download") {
    saveFile(message)
      .then((result) => respond(result))
      .catch(() => respond({ ok: false, error: { code: "err.download" } }));
    return true;
  }

  if (type === "dp-event") {
    const event = message.event ?? {};
    if (event.kind === "tick") {
      state.elapsedMs = event.elapsedMs ?? state.elapsedMs;
      state.cueCount = event.cueCount ?? state.cueCount;
      state.audioMs = event.audioMs ?? state.audioMs;
      publish();
    } else if (event.kind === "caption") {
      if (event.channel === "dub") state.dubText = event.text || state.dubText;
      else state.sourceText = event.text || state.sourceText;
      // متن زنده روی خود ویدئو هم می‌رود، مگر آنکه زیرنویس واقعی سایت فعال باشد
      if (state.stagePhase === "live" && typeof state.stageTabId === "number") {
        if (event.channel === "dub") stageLive.dub = rollCaption(stageLive.dub, event.text);
        else stageLive.source = rollCaption(stageLive.source, event.text);
        const shown = forDisplay(stageLive.dub);
        tellStage(state.stageTabId, {
          type: "dp-stage-live",
          dub: shown.text,
          dir: shown.dir
        });
      }
      publish();
    } else if (event.kind === "usage") {
      usage.record(event.sample);
    } else if (event.kind === "quota") {
      usage.noteQuota(event.message, event.retryMs);
      publish();
    } else if (event.kind === "error") {
      state.error = event.error ?? null;
      publish();
    } else if (event.kind === "ready") {
      state.error = null;
      publish();
    } else if (event.kind === "source-ended") {
      stopDubbing();
    }
    return false;
  }

  return false;
});

/* ══════════════════════ چرخهٔ عمر تب ══════════════════════ */

// اگر تب در حال دوبله بسته شد، جلسه را ببند و خروجی‌ها را ذخیره کن
chrome.tabs.onRemoved.addListener((tabId) => {
  stagedTabs.delete(tabId);
  if (state.stageTabId === tabId) {
    state.stagePhase = "idle";
    state.stageTabId = null;
    state.track = null;
    trackCues = [];
    publish();
  }
  if (state.phase !== "idle" && state.tabId === tabId) stopDubbing();
});

// رفتن به ویدئوی دیگر، کیوهای قبلی را بی‌اعتبار می‌کند
// نشانی تب عوض شد: زیرنویس کهنه هم در صفحه و هم اینجا باید برود.
// اسکریپت محتوا خودش هم تشخیص می‌دهد؛ این خط دفاعی دوم است، برای حالتی که
// صفحه کامل بارگذاری شده و اسکریپت تازه از بین رفته باشد.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  stagedTabs.delete(tabId);
  tellStage(tabId, { type: "dp-stage-clear" });
  if (state.stageTabId === tabId && state.stagePhase !== "idle") {
    handleVideoChanged(tabId).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  setBadge(false);
  chrome.storage.session?.remove(STATE_KEY).catch(() => {});
});
