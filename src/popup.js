/**
 * رابط کاربری افزونه دوبله پارسی
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { DEFAULT_SETTINGS, loadSettings, saveSettings, toRgba } from "./defaults.js";
import { LANGUAGES } from "./languages.js";
import { OVERLAY_THEMES, SCALE_RANGE } from "./themes.js";
import { applyDom, digits, dirOf, getLang, message, setLang, t, UI_LANGS } from "./i18n.js";
import { MODEL_FALLBACKS } from "./translate-client.js";

const el = (id) => document.getElementById(id);

const ui = {
  status: el("status"),
  statusText: el("statusText"),
  timer: el("timer"),
  alert: el("alert"),
  apiKey: el("apiKey"),
  toggleKey: el("toggleKey"),
  apiTest: el("apiTest"),
  apiStatus: el("apiStatus"),
  targetLang: el("targetLang"),
  tonePrompt: el("tonePrompt"),
  livePlayback: el("livePlayback"),
  duckOriginal: el("duckOriginal"),
  duckRow: el("duckRow"),
  saveMp3: el("saveMp3"),
  mp3Options: el("mp3Options"),
  mp3Source: el("mp3Source"),
  mp3Bitrate: el("mp3Bitrate"),
  saveSubtitle: el("saveSubtitle"),
  subtitleOptions: el("subtitleOptions"),
  subtitleFormat: el("subtitleFormat"),
  subtitleOffsetMs: el("subtitleOffsetMs"),
  bilingualSubtitle: el("bilingualSubtitle"),
  useOriginalFilename: el("useOriginalFilename"),
  translateModel: el("translateModel"),
  textModel: el("textModel"),
  modelProbe: el("modelProbe"),
  modelStatus: el("modelStatus"),
  quotaBox: el("quotaBox"),
  usageGrid: el("usageGrid"),
  dailyLimit: el("dailyLimit"),
  usageMeter: el("usageMeter"),
  usageFill: el("usageFill"),
  usageSummary: el("usageSummary"),
  usageReset: el("usageReset"),
  usageHistory: el("usageHistory"),
  usageRefresh: el("usageRefresh"),
  usageClear: el("usageClear"),
  duckLevel: el("duckLevel"),

  // صحنهٔ روی ویدئو
  overlay: el("overlay"),
  overlayOptions: el("overlayOptions"),
  themeChips: el("themeChips"),
  overlayScale: el("overlayScale"),
  overlayWidth: el("overlayWidth"),
  overlayKaraoke: el("overlayKaraoke"),
  overlayContrast: el("overlayContrast"),
  overlayOriginal: el("overlayOriginal"),
  overlayCustomColors: el("overlayCustomColors"),
  colorOptions: el("colorOptions"),
  overlayPlate: el("overlayPlate"),
  overlaySpoken: el("overlaySpoken"),
  overlayPlateOpacity: el("overlayPlateOpacity"),
  useSiteCaptions: el("useSiteCaptions"),
  autoContinue: el("autoContinue"),
  liveFallback: el("liveFallback"),
  toggleCaptions: el("toggleCaptions"),
  siteOptions: el("siteOptions"),
  stageAction: el("stageAction"),
  stageActionLabel: el("stageActionLabel"),
  stageStatus: el("stageStatus"),
  stageSave: el("stageSave"),
  translationMemory: el("translationMemory"),
  memoryOptions: el("memoryOptions"),
  memoryStat: el("memoryStat"),
  memoryClear: el("memoryClear"),

  livePanel: el("livePanel"),
  captionDub: el("captionDub"),
  captionSrc: el("captionSrc"),
  meterCues: el("meterCues"),
  meterAudio: el("meterAudio"),
  results: el("results"),
  fileList: el("fileList"),
  fileFolder: el("fileFolder"),
  copyTranscript: el("copyTranscript"),
  openDownloads: el("openDownloads"),
  action: el("action"),
  actionLabel: el("actionLabel"),
  langSwitch: el("langSwitch"),
  year: el("year")
};

let settings = { ...DEFAULT_SETTINGS };
let currentState = { phase: "idle", stagePhase: "idle" };
let transcript = "";
let keyVisible = false;
/** آخرین پیام تشخیص؛ تا وقتی جلسهٔ تازه‌ای شروع نشود پاک نمی‌شود */
let stageNote = "";

function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return digits(`${minutes}:${seconds}`);
}

/** پرکردن یک select با حفظ مقدار انتخاب‌شده */
function fillSelect(select, items, valueKey, labelKey) {
  const previous = select.value;
  select.replaceChildren(...items.map((item) => {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = item[labelKey] ?? item.fa;
    return option;
  }));
  if (previous && items.some((item) => item[valueKey] === previous)) select.value = previous;
}

/**
 * تراشه‌های انتخاب قالب.
 * هر تراشه با همان رنگ‌های واقعی قالب ساخته می‌شود، پس پیش‌نمایش است نه برچسب.
 */
function buildThemeChips(lang) {
  const active = settings.overlayTheme;
  ui.themeChips.replaceChildren(...OVERLAY_THEMES.map((theme) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.theme = theme.id;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(theme.id === active));
    chip.classList.toggle("is-active", theme.id === active);
    if (theme.swatch.outline) chip.dataset.outline = "1";
    if (theme.swatch.glow) chip.dataset.glow = "1";
    if (theme.swatch.bar) chip.dataset.bar = "1";

    // پیش‌نمایش با همان رنگ‌هایی که واقعاً روی ویدئو اعمال می‌شوند
    const custom = settings.overlayCustomColors === true;
    const demo = document.createElement("span");
    demo.className = "demo";
    demo.style.background = custom
      ? toRgba(settings.overlayPlate, settings.overlayPlateOpacity)
      : theme.swatch.plate;
    demo.style.color = theme.swatch.ink;
    const lit = document.createElement("span");
    lit.className = "lit";
    lit.style.color = custom ? settings.overlaySpoken : theme.swatch.accent;
    lit.textContent = lang === "fa" ? "سلام، این یک" : "Hello, this is a";
    const rest = document.createElement("span");
    rest.textContent = lang === "fa" ? "زیرنویس نمونه است" : "sample subtitle";
    demo.append(lit, rest);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = theme[lang] ?? theme.fa;

    chip.append(demo, name);
    return chip;
  }));
}

/**
 * فهرست مدل ترجمهٔ زیرنویس.
 * گزینهٔ اول همیشه «خودکار» است، بعد مدل‌هایی که بررسی‌شان جواب داده،
 * و در آخر نامزدهای پیش‌فرض تا فهرست هرگز خالی نباشد.
 */
let probedModels = [];

function fillModels() {
  const previous = settings.textModel ?? "";
  const rows = [{ value: "", label: t("opt.autoModel") }];
  for (const model of probedModels) {
    rows.push({
      value: model.id,
      label: model.thrifty ? `${model.id} — ${t("opt.thrifty")}` : model.id
    });
  }
  for (const id of MODEL_FALLBACKS) {
    if (!rows.some((row) => row.value === id)) rows.push({ value: id, label: id });
  }
  ui.textModel.replaceChildren(...rows.map((row) => {
    const option = document.createElement("option");
    option.value = row.value;
    option.textContent = row.label;
    return option;
  }));
  ui.textModel.value = rows.some((row) => row.value === previous) ? previous : "";
}

function readForm() {
  return {
    ...settings,
    openSections: [...(settings.openSections ?? [])],
    apiKey: ui.apiKey.value.trim(),
    uiLang: getLang(),
    translateModel: ui.translateModel.value.trim() || DEFAULT_SETTINGS.translateModel,
    textModel: ui.textModel.value.trim(),
    targetLang: ui.targetLang.value,
    tonePrompt: ui.tonePrompt.value.replace(/\s+/g, " ").trim().slice(0, 400),
    livePlayback: ui.livePlayback.checked,
    duckOriginal: ui.duckOriginal.checked,
    duckLevel: Number(ui.duckLevel.value),
    saveMp3: ui.saveMp3.checked,
    mp3Source: ui.mp3Source.value,
    mp3Bitrate: Number(ui.mp3Bitrate.value),
    saveSubtitle: ui.saveSubtitle.checked,
    subtitleFormat: ui.subtitleFormat.value,
    bilingualSubtitle: ui.bilingualSubtitle.checked,
    subtitleOffsetMs: Math.max(0, Number(ui.subtitleOffsetMs.value) || 0),
    useOriginalFilename: ui.useOriginalFilename.checked,
    overlay: ui.overlay.checked,
    overlayScale: Number(ui.overlayScale.value),
    overlayWidth: Number(ui.overlayWidth.value),
    overlayKaraoke: ui.overlayKaraoke.checked,
    overlayContrast: ui.overlayContrast.checked,
    overlayOriginal: ui.overlayOriginal.checked,
    overlayCustomColors: ui.overlayCustomColors.checked,
    overlayPlate: ui.overlayPlate.value,
    overlaySpoken: ui.overlaySpoken.value,
    overlayPlateOpacity: Number(ui.overlayPlateOpacity.value),
    useSiteCaptions: ui.useSiteCaptions.checked,
    autoContinue: ui.autoContinue.checked,
    liveFallback: ui.liveFallback.checked,
    toggleCaptions: ui.toggleCaptions.checked,
    translationMemory: ui.translationMemory.checked
  };
}

function writeForm() {
  ui.apiKey.value = settings.apiKey;
  ui.translateModel.value = settings.translateModel;
  ui.targetLang.value = settings.targetLang;
  ui.tonePrompt.value = settings.tonePrompt ?? "";
  ui.livePlayback.checked = settings.livePlayback;
  ui.duckOriginal.checked = settings.duckOriginal;
  ui.duckLevel.value = settings.duckLevel;
  ui.saveMp3.checked = settings.saveMp3;
  ui.mp3Source.value = settings.mp3Source;
  ui.mp3Bitrate.value = String(settings.mp3Bitrate);
  ui.saveSubtitle.checked = settings.saveSubtitle;
  ui.subtitleFormat.value = settings.subtitleFormat;
  ui.bilingualSubtitle.checked = settings.bilingualSubtitle;
  ui.subtitleOffsetMs.value = settings.subtitleOffsetMs;
  ui.useOriginalFilename.checked = settings.useOriginalFilename !== false;

  ui.overlay.checked = settings.overlay !== false;
  ui.overlayScale.min = String(SCALE_RANGE.min);
  ui.overlayScale.max = String(SCALE_RANGE.max);
  ui.overlayScale.step = String(SCALE_RANGE.step);
  ui.overlayScale.value = String(settings.overlayScale);
  ui.overlayWidth.value = String(settings.overlayWidth);
  ui.overlayKaraoke.checked = settings.overlayKaraoke !== false;
  ui.overlayContrast.checked = settings.overlayContrast !== false;
  ui.overlayOriginal.checked = settings.overlayOriginal === true;
  ui.overlayCustomColors.checked = settings.overlayCustomColors === true;
  ui.overlayPlate.value = settings.overlayPlate;
  ui.overlaySpoken.value = settings.overlaySpoken;
  ui.overlayPlateOpacity.value = String(settings.overlayPlateOpacity);
  ui.useSiteCaptions.checked = settings.useSiteCaptions !== false;
  ui.autoContinue.checked = settings.autoContinue !== false;
  ui.liveFallback.checked = settings.liveFallback !== false;
  ui.toggleCaptions.checked = settings.toggleCaptions !== false;
  ui.translationMemory.checked = settings.translationMemory !== false;
  syncSubPanels();
}

function syncSubPanels() {
  ui.mp3Options.hidden = !ui.saveMp3.checked;
  ui.subtitleOptions.hidden = !ui.saveSubtitle.checked;
  ui.duckRow.classList.toggle("locked", !ui.livePlayback.checked);
  ui.overlayOptions.hidden = !ui.overlay.checked;
  ui.siteOptions.hidden = !ui.useSiteCaptions.checked;
  ui.memoryOptions.hidden = !ui.translationMemory.checked;
  ui.colorOptions.hidden = !ui.overlayCustomColors.checked;
}

let saveTimer = null;
function persist({ redrawChips = false } = {}) {
  settings = readForm();
  syncSubPanels();
  if (redrawChips) buildThemeChips(getLang());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveSettings(settings).catch(() => {});
    // ظاهر زیرنویس همان لحظه روی ویدئو به‌روز می‌شود، بدون شروع دوباره
    chrome.runtime.sendMessage({ type: "dp-stage-refresh", settings }).catch(() => {});
  }, 200);
}

function showAlert(text) {
  ui.alert.hidden = !text;
  ui.alert.textContent = text ?? "";
}

/** برچسب‌های روشن/خاموش کلیدها را به CSS می‌دهیم تا خودکار جابه‌جا شوند */
function applyToggleLabels() {
  const root = document.documentElement.style;
  root.setProperty("--label-on", `"${t("state.on")}"`);
  root.setProperty("--label-off", `"${t("state.off")}"`);
}

function applyLanguage(lang, { rerender = true } = {}) {
  const active = setLang(lang);
  document.documentElement.lang = active;
  document.documentElement.dir = dirOf(active);

  applyDom(document);
  applyToggleLabels();

  for (const button of ui.langSwitch.querySelectorAll(".langbtn")) {
    button.classList.toggle("is-active", button.dataset.lang === active);
  }

  fillSelect(ui.targetLang, LANGUAGES, "code", active);
  ui.targetLang.value = settings.targetLang;
  buildThemeChips(active);
  fillModels();

  ui.year.textContent = digits(new Date().getFullYear());
  ui.toggleKey.textContent = keyVisible ? t("btn.hide") : t("btn.show");
  ui.copyTranscript.textContent = t("btn.copy");
  ui.captionDub.dataset.placeholder = t("caption.waiting");
  syncSubPanels();
  refreshMemoryStat();
  if (rerender) render(currentState);
}


/* ── تست کلید و یافتن مدل‌های کارکننده ───────────────────────────── */

function setNote(node, text, tone) {
  node.textContent = text;
  node.classList.remove("is-ok", "is-warn");
  if (tone) node.classList.add(tone);
}

/** کد نتیجهٔ بررسی ⇒ پیام خوانا */
function apiMessage(result) {
  if (!result) return { text: t("api.noAnswer"), tone: "is-warn" };
  switch (result.kind) {
    case "ok":
      return { text: t("api.ok", { model: result.model, ms: digits(result.ms) }), tone: "is-ok" };
    case "noKey":
      return { text: t("err.noKey"), tone: "is-warn" };
    case "badKey":
      return { text: t("api.badKey"), tone: "is-warn" };
    case "quota":
      return {
        text: result.retryMs
          ? t("api.quotaRetry", { s: digits(Math.ceil(result.retryMs / 1000)) })
          : t("api.quota"),
        tone: "is-warn"
      };
    case "missing":
      return { text: t("api.missing", { model: result.model }), tone: "is-warn" };
    case "offline":
      return { text: t("api.offline"), tone: "is-warn" };
    default:
      return { text: result.message || t("err.unknown"), tone: "is-warn" };
  }
}

ui.apiTest.addEventListener("click", async () => {
  const key = ui.apiKey.value.trim();
  if (!key) {
    setNote(ui.apiStatus, t("err.noKey"), "is-warn");
    return;
  }
  ui.apiTest.disabled = true;
  setNote(ui.apiStatus, t("api.testing"), "");
  const answer = await chrome.runtime.sendMessage({ type: "dp-api-test", apiKey: key }).catch(() => null);
  ui.apiTest.disabled = false;
  const note = apiMessage(answer?.result);
  setNote(ui.apiStatus, note.text, note.tone);
  refreshUsage();
});

ui.modelProbe.addEventListener("click", async () => {
  const key = ui.apiKey.value.trim();
  if (!key) {
    setNote(ui.modelStatus, t("err.noKey"), "is-warn");
    return;
  }
  ui.modelProbe.disabled = true;
  setNote(ui.modelStatus, t("api.probing"), "");
  const answer = await chrome.runtime.sendMessage({ type: "dp-api-models", apiKey: key }).catch(() => null);
  ui.modelProbe.disabled = false;

  probedModels = answer?.models ?? [];
  fillModels();
  if (probedModels.length) {
    setNote(ui.modelStatus, t("api.modelsFound", {
      n: digits(probedModels.length), checked: digits(answer.checked ?? 0)
    }), "is-ok");
    // ارزان‌ترین مدلِ کارکننده پیشنهاد می‌شود
    if (!settings.textModel) {
      ui.textModel.value = probedModels[0].id;
      persist();
    }
  } else if (answer?.quota) {
    setNote(ui.modelStatus, t("api.quota"), "is-warn");
  } else {
    setNote(ui.modelStatus, t("api.noModels"), "is-warn");
  }
  refreshUsage();
});

/* ── مصرف توکن و سهمیه ──────────────────────────────────────────── */

const nf = (value) => digits(Number(value || 0).toLocaleString("en-US"));

function renderUsage(data) {
  if (!data) return;
  const today = data.today ?? {};

  const rows = [
    ["usage.total", today.total],
    ["usage.input", today.input],
    ["usage.output", today.output],
    ["usage.audioIn", today.audioIn],
    ["usage.audioOut", today.audioOut],
    ["usage.text", today.text],
    ["usage.turns", today.updates],
    ["usage.sessions", today.sessions],
    ["usage.peak", today.peakContext]
  ];
  ui.usageGrid.replaceChildren(...rows.flatMap(([key, value]) => {
    const label = document.createElement("span");
    label.className = "usage-key";
    label.textContent = t(key);
    const cell = document.createElement("span");
    cell.className = "usage-value";
    cell.textContent = nf(value);
    return [label, cell];
  }));

  if (document.activeElement !== ui.dailyLimit) {
    ui.dailyLimit.value = data.dailyLimit ? String(data.dailyLimit) : "";
  }

  const fraction = data.usedFraction;
  ui.usageMeter.hidden = fraction === null || fraction === undefined;
  if (!ui.usageMeter.hidden) {
    ui.usageFill.style.width = `${Math.round(fraction * 100)}%`;
    ui.usageFill.classList.toggle("is-hot", fraction > 0.85);
    ui.usageSummary.textContent = t("usage.summary", {
      used: nf(today.total), limit: nf(data.dailyLimit),
      percent: digits(Math.round(fraction * 100)), left: nf(data.remaining)
    });
  } else {
    ui.usageSummary.textContent = t("usage.noLimit");
  }

  const minutes = Math.max(0, Math.round((data.resetAtMs - Date.now()) / 60000));
  ui.usageReset.textContent = t("usage.reset", {
    h: digits(Math.floor(minutes / 60)), m: digits(minutes % 60)
  });

  const quota = data.quota ?? {};
  ui.quotaBox.hidden = !quota.hit;
  if (quota.hit) {
    const left = quota.retryAtMs ? Math.max(0, Math.ceil((quota.retryAtMs - Date.now()) / 1000)) : 0;
    ui.quotaBox.textContent = left
      ? t("usage.quotaRetry", { s: digits(left) })
      : t("usage.quotaHit");
    ui.quotaBox.title = quota.message ?? "";
  }

  const history = (data.history ?? []).filter((day) => day.day !== today.day);
  ui.usageHistory.replaceChildren(...history.map((day) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = digits(day.day);
    const total = document.createElement("span");
    total.textContent = nf(day.total);
    li.append(name, total);
    return li;
  }));
}

async function refreshUsage() {
  const answer = await chrome.runtime.sendMessage({ type: "dp-usage-get" }).catch(() => null);
  if (answer?.ok) renderUsage(answer.usage);
}

ui.usageRefresh.addEventListener("click", refreshUsage);

ui.usageClear.addEventListener("click", async () => {
  const answer = await chrome.runtime.sendMessage({ type: "dp-usage-clear" }).catch(() => null);
  if (answer?.ok) renderUsage(answer.usage);
});

ui.dailyLimit.addEventListener("change", async () => {
  const answer = await chrome.runtime
    .sendMessage({ type: "dp-usage-limit", limit: Number(ui.dailyLimit.value) || 0 })
    .catch(() => null);
  if (answer?.ok) renderUsage(answer.usage);
});

/* ── حافظهٔ ترجمه ─────────────────────────────────────────────────── */

async function refreshMemoryStat() {
  const answer = await chrome.runtime.sendMessage({ type: "dp-memory-stats" }).catch(() => null);
  if (!answer?.ok) {
    ui.memoryStat.textContent = t("memory.empty");
    return;
  }
  ui.memoryStat.textContent = answer.lines
    ? t("memory.stat", { lines: digits(answer.lines), tracks: digits(answer.tracks) })
    : t("memory.empty");
}

ui.memoryClear.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "dp-memory-clear" }).catch(() => null);
  ui.memoryClear.textContent = t("btn.memoryCleared");
  setTimeout(() => { ui.memoryClear.textContent = t("btn.memoryClear"); }, 1600);
  refreshMemoryStat();
});

/* ── صحنهٔ روی ویدئو ─────────────────────────────────────────────── */

ui.themeChips.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  settings = { ...readForm(), overlayTheme: chip.dataset.theme };
  buildThemeChips(getLang());
  persist();
});

async function toggleStage() {
  const running = currentState.stagePhase === "track" || currentState.stagePhase === "live";
  ui.stageAction.disabled = true;
  stageNote = "";
  const type = running ? "dp-stage-stop" : "dp-stage-start";
  const response = await chrome.runtime.sendMessage({ type }).catch(() => null);
  ui.stageAction.disabled = false;
  if (response?.state) render(response.state);
  refreshMemoryStat();
  refreshUsage();
}

ui.stageAction.addEventListener("click", toggleStage);

ui.stageSave.addEventListener("click", async () => {
  ui.stageSave.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: "dp-stage-save" }).catch(() => null);
  ui.stageSave.disabled = false;
  if (!response?.ok) showAlert(message(response?.error) || t("err.noTrackCues"));
});

/** توضیح وضعیت مسیر زیرنویس، با عددهای واقعی */
function stageMessage(state) {
  const track = state.track;
  if (state.stagePhase === "working") {
    // تا وقتی زیرنویس پیدا نشده، «در حال ترجمه» گمراه‌کننده است
    if (state.stageSearch) {
      return {
        text: t("stage.searching", {
          n: digits(state.stageSearch.attempt), total: digits(state.stageSearch.total)
        }),
        tone: ""
      };
    }
    return { text: t("btn.stageWorking", { n: digits(state.stageProgress ?? 0) }), tone: "" };
  }
  if (state.stagePhase === "track" && track) {
    const total = digits(track.count);
    if (track.origin === "same-language") return { text: t("stage.original", { n: total }), tone: "is-ok" };
    if (!track.translated) return { text: t("stage.memory", { n: total }), tone: "is-ok" };
    if (track.fromMemory) {
      return {
        text: t("stage.mixed", {
          n: total, memory: digits(track.fromMemory), fresh: digits(track.translated)
        }),
        tone: "is-ok"
      };
    }
    return { text: t("stage.track", { n: total }), tone: "is-ok" };
  }
  if (state.stagePhase === "live") return { text: t("stage.liveOnly"), tone: "is-warn" };
  if (state.stageError) return { text: message(state.stageError), tone: "is-warn" };
  if (stageNote) return { text: stageNote, tone: "" };
  return { text: t("stage.hint"), tone: "" };
}

function renderStage(state) {
  const working = state.stagePhase === "working";
  const running = state.stagePhase === "track" || state.stagePhase === "live";

  ui.stageAction.disabled = working;
  ui.stageAction.classList.toggle("is-on", running);
  ui.stageActionLabel.textContent = working
    ? (state.stageSearch ? t("btn.stageSearching") : t("btn.stageWorking", { n: digits(state.stageProgress ?? 0) }))
    : running ? t("btn.stageStop") : t("btn.stageStart");

  const status = stageMessage(state);
  ui.stageStatus.textContent = status.text;
  ui.stageStatus.classList.remove("is-ok", "is-warn");
  if (status.tone) ui.stageStatus.classList.add(status.tone);

  ui.stageSave.hidden = state.stagePhase !== "track";
}

/* ── فایل‌ها و وضعیت کلی ─────────────────────────────────────────── */

function renderFiles(state) {
  const files = state.files ?? [];
  const notices = state.notices ?? [];
  if (!files.length && !notices.length) {
    ui.results.hidden = true;
    return;
  }
  ui.results.hidden = false;

  // مسیر پوشه یک بار بالای فهرست نوشته می‌شود، نه جلوی هر فایل
  const folder = files.find((file) => file.filename?.includes("/"))?.filename
    .split("/").slice(0, -1).join("/");
  ui.fileFolder.hidden = !folder;
  ui.fileFolder.textContent = folder ? `${folder}/` : "";

  const items = [];
  for (const file of files) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = String(file.filename ?? "").split("/").pop();
    name.title = file.filename;
    const size = document.createElement("span");
    size.textContent = `${digits((file.bytes / 1048576).toFixed(2))} MB`;
    li.append(name, size);
    items.push(li);
  }
  for (const notice of notices) {
    const li = document.createElement("li");
    li.className = "warn";
    li.textContent = message(notice);
    items.push(li);
  }
  ui.fileList.replaceChildren(...items);
  ui.copyTranscript.hidden = !state.transcript;
}

function render(state) {
  currentState = state ?? { phase: "idle", stagePhase: "idle" };
  transcript = currentState.transcript ?? transcript;
  const live = currentState.phase === "live";
  const busy = currentState.phase === "starting" || currentState.phase === "stopping";

  ui.status.classList.toggle("is-live", live);
  ui.status.classList.toggle("is-busy", busy);

  const tabTitle = currentState.tabTitle ? ` — ${currentState.tabTitle.slice(0, 30)}` : "";
  ui.statusText.textContent = live
    ? `${t("status.live")}${tabTitle}`
    : busy
      ? t(currentState.phase === "starting" ? "status.connecting" : "status.saving")
      : t("status.ready");
  ui.timer.textContent = clock(live || busy ? currentState.elapsedMs ?? 0 : 0);

  ui.action.disabled = busy;
  ui.action.classList.toggle("is-live", live);
  ui.actionLabel.textContent = live ? t("btn.stop") : busy ? t("btn.wait") : t("btn.start");

  ui.livePanel.hidden = !live && !busy;
  if (live || busy) {
    ui.captionDub.textContent = currentState.dubText || t("caption.waiting");
    ui.captionSrc.textContent = currentState.sourceText || "";
    ui.meterCues.textContent = t("meter.cues", { n: digits(currentState.cueCount ?? 0) });
    ui.meterAudio.textContent = t("meter.audio", { time: clock(currentState.audioMs ?? 0) });
  }

  // کارت «نمایش روی ویدئو» قفل نمی‌شود: تغییر قالب هنگام دوبله هم مجاز است
  document.querySelectorAll(".card:not(.live):not(.results):not(.stage), .advanced")
    .forEach((node) => node.classList.toggle("locked", live || busy));

  renderStage(currentState);
  showAlert(message(currentState.error));
  if (!live && !busy) renderFiles(currentState);
  else ui.results.hidden = true;
}

async function start() {
  const config = readForm();
  if (!config.apiKey) {
    showAlert(t("err.noKey"));
    ui.apiKey.focus();
    return;
  }
  if (!config.livePlayback && !config.saveMp3 && !config.saveSubtitle) {
    showAlert(t("err.noOutput"));
    return;
  }
  settings = config;
  await saveSettings(settings);
  showAlert("");
  ui.action.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: "dp-start", settings });
  if (!response?.ok) {
    showAlert(message(response?.error) || t("err.startFailed"));
    ui.action.disabled = false;
    return;
  }
  render(response.state);
}

async function stop() {
  ui.action.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: "dp-stop" });
  if (response?.ok) render(response.state);
  else showAlert(message(response?.error) || t("err.stopFailed"));
  ui.action.disabled = false;
}

ui.action.addEventListener("click", () => {
  if (currentState.phase === "live") stop();
  else if (currentState.phase === "idle") start();
});

ui.toggleKey.addEventListener("click", () => {
  keyVisible = !keyVisible;
  ui.apiKey.type = keyVisible ? "text" : "password";
  ui.toggleKey.textContent = keyVisible ? t("btn.hide") : t("btn.show");
});

ui.copyTranscript.addEventListener("click", async () => {
  if (!transcript) return;
  await navigator.clipboard.writeText(transcript);
  ui.copyTranscript.textContent = t("btn.copied");
  setTimeout(() => { ui.copyTranscript.textContent = t("btn.copy"); }, 1600);
});

ui.openDownloads.addEventListener("click", () => {
  chrome.downloads.showDefaultFolder();
});

ui.langSwitch.addEventListener("click", (event) => {
  const button = event.target.closest(".langbtn");
  if (!button) return;
  const lang = button.dataset.lang;
  if (!UI_LANGS.some((item) => item.code === lang) || lang === getLang()) return;
  applyLanguage(lang);
  persist();
});

ui.overlayCustomColors.addEventListener("input", () => persist({ redrawChips: true }));
ui.overlayPlate.addEventListener("input", () => persist({ redrawChips: true }));
ui.overlaySpoken.addEventListener("input", () => persist({ redrawChips: true }));
ui.overlayPlateOpacity.addEventListener("input", () => persist({ redrawChips: true }));
for (const node of document.querySelectorAll("input, select, textarea")) {
  node.addEventListener("change", persist);
  if (["text", "password", "number", "range", "textarea"].includes(node.type)) {
    node.addEventListener("input", persist);
  }
}

/* ── بخش‌های جمع‌شو ─────────────────────────────────────────────── */

/**
 * هر بلوک پیش‌فرض بسته است. وضعیت باز/بسته ذخیره می‌شود، پس بار بعد همان
 * بخش‌هایی که خودت باز گذاشته‌ای باز می‌آیند.
 */
const folds = [...document.querySelectorAll("[data-section]")];

function applyFolds() {
  const open = new Set(settings.openSections ?? []);
  for (const fold of folds) fold.open = open.has(fold.dataset.section);
}

for (const fold of folds) {
  fold.addEventListener("toggle", () => {
    const open = folds.filter((item) => item.open).map((item) => item.dataset.section);
    settings = { ...settings, openSections: open };
    persist();
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "dp-state") render(msg.state);
});

(async function init() {
  settings = await loadSettings();
  applyLanguage(settings.uiLang, { rerender: false });
  writeForm();
  applyFolds();
  const response = await chrome.runtime.sendMessage({ type: "dp-get-state" });
  render(response?.state ?? { phase: "idle", stagePhase: "idle" });
  refreshUsage();
})();
