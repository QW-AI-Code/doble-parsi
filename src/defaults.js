/**
 * تنظیمات پیش‌فرض افزونه
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { TRANSLATE_MODELS } from "./languages.js";
import { DEFAULT_UI_LANG } from "./i18n.js";

export const SETTINGS_VERSION = 3;

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  apiKey: "",
  uiLang: DEFAULT_UI_LANG,      // زبان رابط: fa | en
  targetLang: "fa",             // زبان دوبله
  translateModel: TRANSLATE_MODELS[0],
  livePlayback: true,           // پخش زنده صدای دوبله
  duckOriginal: true,           // کم کردن صدای اصلی هنگام صحبت گوینده
  duckLevel: 0.12,
  saveMp3: true,                // ذخیره خروجی صوتی
  mp3Source: "mix",             // mix = دوبله + صدای اصلی، dub = فقط دوبله
  mp3Bitrate: 128000,
  saveSubtitle: true,           // ذخیره زیرنویس
  subtitleFormat: "srt",        // srt | vtt | both
  bilingualSubtitle: false,     // زیرنویس زبان اصلی هم ذخیره شود
  subtitleOffsetMs: 1200,       // جبران تاخیر دوبله در زیرنویس (میلی‌ثانیه)
  useOriginalFilename: true     // خروجی‌ها هم‌نام ویدئوی اصلی ذخیره شوند
};

export const STORAGE_KEY = "dubleParsiSettings";

/** تنظیمات نسخه‌های قبلی را به ساختار فعلی می‌آورد */
export function migrate(stored) {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_SETTINGS };
  const next = { ...DEFAULT_SETTINGS, ...stored };

  if (!stored.version || stored.version < 2) {
    // نسخه‌های قدیمی یک فیلد model داشتند که مدل ترجمه بود
    if (typeof stored.model === "string" && stored.model.trim()) {
      next.translateModel = stored.model.trim();
    }
  }

  next.version = SETTINGS_VERSION;

  // انتخاب صدا حذف شد: مدل ترجمهٔ زنده خودش صدای گوینده‌ی اصلی را تقلید می‌کند
  delete next.model;
  delete next.voiceName;
  delete next.voiceModel;
  return next;
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return migrate(stored[STORAGE_KEY]);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, version: SETTINGS_VERSION } });
}
