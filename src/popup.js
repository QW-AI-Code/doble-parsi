/**
 * رابط کاربری افزونه دوبله پارسی
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./defaults.js";
import { LANGUAGES } from "./languages.js";
import { applyDom, digits, dirOf, getLang, message, setLang, t, UI_LANGS } from "./i18n.js";

const el = (id) => document.getElementById(id);

const ui = {
  status: el("status"),
  statusText: el("statusText"),
  timer: el("timer"),
  alert: el("alert"),
  apiKey: el("apiKey"),
  toggleKey: el("toggleKey"),
  targetLang: el("targetLang"),
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
  duckLevel: el("duckLevel"),
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
let currentState = { phase: "idle" };
let transcript = "";
let keyVisible = false;

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

function readForm() {
  return {
    ...settings,
    apiKey: ui.apiKey.value.trim(),
    uiLang: getLang(),
    translateModel: ui.translateModel.value.trim() || DEFAULT_SETTINGS.translateModel,
    targetLang: ui.targetLang.value,
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
    useOriginalFilename: ui.useOriginalFilename.checked
  };
}

function writeForm() {
  ui.apiKey.value = settings.apiKey;
  ui.translateModel.value = settings.translateModel;
  ui.targetLang.value = settings.targetLang;
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
  syncSubPanels();
}

function syncSubPanels() {
  ui.mp3Options.hidden = !ui.saveMp3.checked;
  ui.subtitleOptions.hidden = !ui.saveSubtitle.checked;
  ui.duckRow.classList.toggle("locked", !ui.livePlayback.checked);
}

let saveTimer = null;
function persist() {
  settings = readForm();
  syncSubPanels();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSettings(settings).catch(() => {}), 250);
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

  ui.year.textContent = digits(new Date().getFullYear());
  ui.toggleKey.textContent = keyVisible ? t("btn.hide") : t("btn.show");
  ui.copyTranscript.textContent = t("btn.copy");
  ui.captionDub.dataset.placeholder = t("caption.waiting");
  syncSubPanels();
  if (rerender) render(currentState);
}

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
  currentState = state ?? { phase: "idle" };
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

  document.querySelectorAll(".card:not(.live):not(.results), .advanced")
    .forEach((node) => node.classList.toggle("locked", live || busy));

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

for (const node of document.querySelectorAll("input, select")) {
  node.addEventListener("change", persist);
  if (node.type === "text" || node.type === "password" || node.type === "number" || node.type === "range") {
    node.addEventListener("input", persist);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "dp-state") render(msg.state);
});

(async function init() {
  settings = await loadSettings();
  applyLanguage(settings.uiLang, { rerender: false });
  writeForm();
  const response = await chrome.runtime.sendMessage({ type: "dp-get-state" });
  render(response?.state ?? { phase: "idle" });
})();
