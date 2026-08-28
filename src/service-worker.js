/**
 * سرویس‌ورکر: هماهنگ‌کننده بین پاپ‌آپ، تب فعال و سند offscreen.
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
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
const OFFSCREEN_PATH = "src/offscreen.html";
const STATE_KEY = "dubleParsiState";

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
  transcript: ""
};

/** نام فایل‌های در انتظار دانلود: blobUrl ⇒ filename */
const pendingNames = new Map();

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

async function startDubbing(settings) {
  if (state.phase !== "idle") throw new CodedError("err.busy");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new CodedError("err.noTab");
  if (!tabIsCapturable(tab.url)) throw new CodedError("err.badTab");

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

  state.phase = "idle";
  state.files = result.files ?? [];
  state.notices = result.errors ?? [];
  state.transcript = result.transcript ?? "";
  state.startedAt = 0;
  await publish();
  return snapshot();
}

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

// اگر تب در حال دوبله بسته شد، جلسه را ببند و خروجی‌ها را ذخیره کن
chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.phase !== "idle" && state.tabId === tabId) stopDubbing();
});

chrome.runtime.onStartup.addListener(() => {
  setBadge(false);
  chrome.storage.session?.remove(STATE_KEY).catch(() => {});
});
