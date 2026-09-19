/**
 * تنظیمات پیش‌فرض افزونه
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { TRANSLATE_MODELS } from "./languages.js";
import { DEFAULT_UI_LANG } from "./i18n.js";
import { DEFAULT_THEME } from "./themes.js";
import { DEFAULT_TEXT_MODEL } from "./translate-client.js";

export const SETTINGS_VERSION = 9;

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  apiKey: "",
  uiLang: DEFAULT_UI_LANG,      // زبان رابط: fa | en
  targetLang: "fa",             // تنها انتخاب زبان: هم دوبله، هم زیرنویس
  tonePrompt: "",               // لحن دلخواه کاربر برای ترجمه (اختیاری)
  translateModel: TRANSLATE_MODELS[0],
  textModel: DEFAULT_TEXT_MODEL, // مدل متنی؛ خالی یا نامعتبر ⇒ خودکار
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
  useOriginalFilename: true,    // خروجی‌ها هم‌نام ویدئوی اصلی ذخیره شوند

  // ── نمایش روی ویدئو ──────────────────────────────────────────────
  overlay: true,                // صحنهٔ زیرنویس روی خود ویدئو
  overlayTheme: DEFAULT_THEME,
  overlayScale: 0.042,          // نسبت اندازهٔ متن به ارتفاع ویدئو
  overlayWidth: 78,             // درصد عرض ویدئو
  overlayX: 50,                 // درصد؛ با کشیدن دستگیره جابه‌جا می‌شود
  overlayY: 88,
  overlayKaraoke: true,         // هایلایت پیش‌روندهٔ جمله
  overlayContrast: true,        // تشخیص خودکار روشنایی صحنه
  overlayOriginal: false,       // نمایش متن زبان اصلی به‌جای ترجمه

  // رنگ دلخواه: تا وقتی خاموش است، رنگ‌های خودِ قالب اعمال می‌شوند
  overlayCustomColors: false,
  overlayPlate: "#0A0E1E",      // رنگ پس‌زمینهٔ پلاک
  overlayPlateOpacity: 0.55,    // شفافیت پلاک (رنگ‌گزین مرورگر آلفا نمی‌دهد)
  overlaySpoken: "#7DD3FC",     // رنگ بخش گفته‌شدهٔ جمله

  // ── زیرنویس واقعی سایت و حافظهٔ ترجمه ────────────────────────────
  useSiteCaptions: true,        // اگر سایت زیرنویس زمان‌بندی‌شده دارد، همان استفاده شود
  autoContinue: true,           // ویدئوی بعدی خودش گرفته و ترجمه شود
  liveFallback: true,           // ویدئوی بی‌زیرنویس: ترجمهٔ زندهٔ صدا
  toggleCaptions: true,         // CC خودِ پخش‌کننده یک لحظه روشن شود تا فهرست ساخته شود
  translationMemory: true,      // ترجمهٔ هر خط یک بار، بعد از کش

  /** بخش‌های بازِ پاپ‌آپ؛ پیش‌فرض همه بسته‌اند */
  openSections: []
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

  // نسخه‌های پیش از ۴ نه صحنهٔ روی ویدئو داشتند و نه حافظهٔ ترجمه؛
  // هر دو روشن شروع می‌شوند چون رفتار پیش‌فرض بهتری‌اند.
  if (!stored.version || stored.version < 4) {
    next.overlay = DEFAULT_SETTINGS.overlay;
    next.overlayTheme = DEFAULT_SETTINGS.overlayTheme;
    next.useSiteCaptions = DEFAULT_SETTINGS.useSiteCaptions;
    next.translationMemory = DEFAULT_SETTINGS.translationMemory;
  }

  // نسخهٔ ۵: انتخاب دستی زبان مبدأ و خط زبان اصلی حذف شدند. زبان مبدأ را
  // خود مدل تشخیص می‌دهد و روی ویدئو فقط ترجمه نشان داده می‌شود.
  if (!stored.version || stored.version < 5) {
    next.textModel = DEFAULT_SETTINGS.textModel;
  }

  // نسخهٔ ۶: رنگ دلخواه، سوییچ زبان اصلی و بخش‌های جمع‌شو
  if (!stored.version || stored.version < 6) {
    next.overlayOriginal = false;
    next.overlayCustomColors = false;
    next.openSections = [];
  }
  if (!Array.isArray(next.openSections)) next.openSections = [];

  // نسخهٔ ۷: ادامهٔ خودکار برای ویدئوی بعدی
  if (!stored.version || stored.version < 7) next.autoContinue = DEFAULT_SETTINGS.autoContinue;

  // نسخهٔ ۸: ترجمهٔ زنده برای ویدئوی بی‌زیرنویس
  if (!stored.version || stored.version < 8) next.liveFallback = DEFAULT_SETTINGS.liveFallback;

  // نسخهٔ ۹: روشن‌کردن موقت CC پخش‌کننده
  if (!stored.version || stored.version < 9) next.toggleCaptions = DEFAULT_SETTINGS.toggleCaptions;

  next.version = SETTINGS_VERSION;

  // انتخاب صدا حذف شد: مدل ترجمهٔ زنده خودش صدای گوینده‌ی اصلی را تقلید می‌کند
  delete next.model;
  delete next.voiceName;
  delete next.voiceModel;
  delete next.sourceLang;
  delete next.overlaySource;
  return next;
}

export async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return migrate(stored[STORAGE_KEY]);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, version: SETTINGS_VERSION } });
}

/**
 * «#RRGGBB» + شفافیت ⇒ «rgba(r, g, b, a)».
 * رنگ‌گزین مرورگر آلفا نمی‌دهد، ولی پلاک زیرنویس باید نیم‌شفاف باشد.
 */
export function toRgba(hex, opacity) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!match) return "";
  const value = Number.parseInt(match[1], 16);
  const alpha = Math.max(0, Math.min(1, Number(opacity)));
  const parts = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `rgba(${parts.join(", ")}, ${Number.isFinite(alpha) ? alpha.toFixed(2) : "1.00"})`;
}

/** تنظیماتی که صحنهٔ روی ویدئو لازم دارد */
export function stageConfig(settings) {
  return {
    enabled: settings.overlay !== false,
    theme: settings.overlayTheme ?? DEFAULT_SETTINGS.overlayTheme,
    scale: Number(settings.overlayScale) || DEFAULT_SETTINGS.overlayScale,
    width: Number(settings.overlayWidth) || DEFAULT_SETTINGS.overlayWidth,
    x: Number(settings.overlayX ?? DEFAULT_SETTINGS.overlayX),
    y: Number(settings.overlayY ?? DEFAULT_SETTINGS.overlayY),
    karaoke: settings.overlayKaraoke !== false,
    autoContrast: settings.overlayContrast !== false,
    showOriginal: settings.overlayOriginal === true,
    // رشتهٔ خالی یعنی «دست نزن، رنگ قالب سر جایش بماند»
    plate: settings.overlayCustomColors
      ? toRgba(settings.overlayPlate, settings.overlayPlateOpacity)
      : "",
    spoken: settings.overlayCustomColors ? String(settings.overlaySpoken ?? "") : ""
  };
}
