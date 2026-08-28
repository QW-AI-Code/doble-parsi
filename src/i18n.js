/**
 * i18n افزونه: فارسی (پیش‌فرض) + انگلیسی
 * Extension i18n: Persian (default) + English
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

export const UI_LANGS = [
  { code: "fa", label: "فارسی", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" }
];

export const DEFAULT_UI_LANG = "fa";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** جدول رشته‌ها؛ برای تست هم‌ترازی کلیدها هم صادر می‌شود */
export const DICT = {
  fa: {
    "app.name": "دوبله پارسی",
    "app.tagline": "دوبله زنده صدای تب + خروجی MP3 و زیرنویس",
    "app.langSwitch": "تغییر زبان رابط",

    "status.ready": "آماده",
    "status.connecting": "در حال اتصال…",
    "status.saving": "در حال ذخیره خروجی‌ها…",
    "status.live": "در حال دوبله",

    "state.on": "روشن",
    "state.off": "خاموش",

    "field.apiKey": "کلید API جِمینای",
    "hint.apiKey": "کلید فقط روی همین مرورگر ذخیره می‌شود.",
    "btn.show": "نمایش",
    "btn.hide": "پنهان",

    "field.targetLang": "زبان دوبله",
    "hint.autoVoice": "صدای دوبله خودکار از گویندهٔ اصلی تقلید می‌شود و همهٔ زبان‌ها (از جمله فارسی) پشتیبانی می‌شوند.",

    "section.outputs": "خروجی‌ها",
    "sw.livePlayback": "پخش زنده دوبله",
    "sw.livePlayback.desc": "همزمان با تماشا، صدای دوبله را بشنو",
    "sw.duck": "کم‌کردن صدای اصلی",
    "sw.duck.desc": "وقتی گوینده حرف می‌زند، صدای اصلی پایین می‌آید",
    "sw.mp3": "ذخیره فایل MP3",
    "sw.mp3.desc": "صدای دوبله‌شده به‌صورت فایل صوتی دانلود می‌شود",
    "sw.subtitle": "ذخیره زیرنویس",
    "sw.subtitle.desc": "متن دوبله با زمان‌بندی، به‌صورت فایل زیرنویس",
    "sw.bilingual": "زیرنویس زبان اصلی هم ذخیره شود",
    "sw.bilingual.desc": "یک فایل جدا با متن زبان مبدأ",

    "field.mp3Source": "محتوای فایل",
    "opt.mix": "دوبله + صدای اصلی (میکس)",
    "opt.dub": "فقط صدای دوبله",
    "field.bitrate": "کیفیت",
    "opt.96": "۹۶ کیلوبیت",
    "opt.128": "۱۲۸ کیلوبیت",
    "opt.192": "۱۹۲ کیلوبیت",

    "field.subFormat": "فرمت",
    "opt.both": "هر دو",
    "field.offset": "جبران تاخیر (میلی‌ثانیه)",

    "section.liveText": "متن زنده",
    "caption.waiting": "در انتظار صدا…",
    "meter.cues": "{n} خط زیرنویس",
    "meter.audio": "{time} صدا",

    "section.files": "فایل‌های ذخیره‌شده",
    "btn.copy": "کپی متن دوبله",
    "btn.copied": "کپی شد ✓",
    "btn.downloads": "پوشه دانلود",

    "btn.start": "شروع دوبله",
    "btn.stop": "پایان و ذخیره",
    "btn.wait": "لطفاً صبر کن…",

    "section.advanced": "تنظیمات پیشرفته",
    "field.fileName": "نام‌گذاری فایل‌ها",
    "sw.originalName": "هم‌نام با ویدئوی اصلی",
    "sw.originalName.desc": "فایل‌ها با نام خودِ ویدئو ذخیره می‌شوند، نه نام تصادفی",
    "hint.folders": "خروجی‌ها مرتب ذخیره می‌شوند: پوشهٔ دانلود ← «Doble Parsi» ← پوشه‌ای هم‌نام ویدئو ← فایل صوتی و زیرنویس.",
    "field.translateModel": "مدل ترجمه",
    "hint.model": "اگر مدل پیش‌فرض جواب نداد، مدل Live دیگری را امتحان کن.",
    "field.duckLevel": "سطح صدای اصلی هنگام دوبله",

    "foot.hint": "صدای تب فعال گرفته می‌شود؛ برای شروع، تب ویدیو را باز و پخش کن.",
    "foot.by": "ساخته‌شده توسط",
    "foot.rights": "همهٔ حقوق محفوظ است.",
    "foot.github": "گیت‌هاب سازنده",

    "err.busy": "یک جلسه دوبله همین حالا در حال اجراست.",
    "err.noTab": "تب فعالی پیدا نشد.",
    "err.badTab": "این صفحه قابل ضبط نیست. یک تب معمولی (مثل یوتیوب یا یک جلسه آنلاین) را باز کن.",
    "err.noKey": "اول کلید API جِمینای را وارد کن.",
    "err.noOutput": "حداقل یکی از خروجی‌ها را روشن کن: پخش زنده، MP3 یا زیرنویس.",
    "err.startFailed": "شروع دوبله ناموفق بود.",
    "err.stopFailed": "پایان جلسه با خطا مواجه شد.",
    "err.unknown": "خطای ناشناخته رخ داد.",
    "err.socket": "ارتباط با سرویس هوش مصنوعی برقرار نشد. کلید API و اتصال اینترنت را بررسی کن.",
    "err.api": "پاسخ سرویس: {message}",
    "err.download": "ذخیره فایل انجام نشد.",
    "err.mp3Failed": "ذخیره MP3 ناموفق بود.",
    "err.mp3Silent": "صدای ضبط‌شده سکوت بود. اگر «پخش زنده» خاموش است، حالت MP3 را روی «فقط صدای دوبله» بگذار.",
    "err.mp3Empty": "صدایی برای ذخیره در MP3 ضبط نشد.",
    "err.clip": "سطح صدا بالا بود و محدودکننده وارد عمل شد؛ اگر کیفیت راضی‌ات نکرد بیت‌ریت را ببر روی ۱۹۲.",
    "err.dropped": "مدل سریع‌تر از زمان واقعی صدا فرستاد و حدود {seconds} ثانیه از دوبله جا نشد.",
    "err.subFailed": "ذخیره زیرنویس ناموفق بود.",
    "err.subEmptyDub": "متنی برای زیرنویس دوبله ثبت نشد.",
    "err.subEmptySource": "متنی برای زیرنویس زبان اصلی ثبت نشد."
  },

  en: {
    "app.name": "Doble Parsi",
    "app.tagline": "Live tab dubbing + MP3 and subtitle output",
    "app.langSwitch": "Switch interface language",

    "status.ready": "Ready",
    "status.connecting": "Connecting…",
    "status.saving": "Saving output files…",
    "status.live": "Dubbing",

    "state.on": "On",
    "state.off": "Off",

    "field.apiKey": "Gemini API key",
    "hint.apiKey": "The key is stored only in this browser.",
    "btn.show": "Show",
    "btn.hide": "Hide",

    "field.targetLang": "Dubbing language",
    "hint.autoVoice": "The dub automatically mimics the original speaker and supports every language, Persian included.",

    "section.outputs": "Outputs",
    "sw.livePlayback": "Live dub playback",
    "sw.livePlayback.desc": "Hear the dub while you watch",
    "sw.duck": "Duck original audio",
    "sw.duck.desc": "Lower the original track while the dub speaks",
    "sw.mp3": "Save MP3 file",
    "sw.mp3.desc": "Download the dubbed audio as a file",
    "sw.subtitle": "Save subtitles",
    "sw.subtitle.desc": "Timed dub text as a subtitle file",
    "sw.bilingual": "Also save source-language subtitles",
    "sw.bilingual.desc": "A separate file with the original text",

    "field.mp3Source": "File content",
    "opt.mix": "Dub + original (mix)",
    "opt.dub": "Dub only",
    "field.bitrate": "Quality",
    "opt.96": "96 kbps",
    "opt.128": "128 kbps",
    "opt.192": "192 kbps",

    "field.subFormat": "Format",
    "opt.both": "Both",
    "field.offset": "Delay offset (ms)",

    "section.liveText": "Live text",
    "caption.waiting": "Waiting for audio…",
    "meter.cues": "{n} subtitle lines",
    "meter.audio": "{time} audio",

    "section.files": "Saved files",
    "btn.copy": "Copy dub transcript",
    "btn.copied": "Copied ✓",
    "btn.downloads": "Downloads folder",

    "btn.start": "Start dubbing",
    "btn.stop": "Stop and save",
    "btn.wait": "Hold on…",

    "section.advanced": "Advanced settings",
    "field.fileName": "File naming",
    "sw.originalName": "Match the original video name",
    "sw.originalName.desc": "Files keep the video's own name instead of a random one",
    "hint.folders": "Outputs stay tidy: Downloads → \"Doble Parsi\" → a folder named after the video → the audio and subtitle files.",
    "field.translateModel": "Translation model",
    "hint.model": "If the default model fails, try another Live model.",
    "field.duckLevel": "Original volume while dubbing",

    "foot.hint": "Audio is captured from the active tab, so open and play the video first.",
    "foot.by": "Built by",
    "foot.rights": "All rights reserved.",
    "foot.github": "Author on GitHub",

    "err.busy": "A dubbing session is already running.",
    "err.noTab": "No active tab found.",
    "err.badTab": "This page cannot be captured. Open a regular tab (YouTube, a meeting, etc.).",
    "err.noKey": "Enter your Gemini API key first.",
    "err.noOutput": "Turn on at least one output: live playback, MP3 or subtitles.",
    "err.startFailed": "Could not start dubbing.",
    "err.stopFailed": "Something went wrong while finishing the session.",
    "err.unknown": "An unknown error occurred.",
    "err.socket": "Could not reach the AI service. Check your API key and internet connection.",
    "err.api": "Service response: {message}",
    "err.download": "Saving the file failed.",
    "err.mp3Failed": "Saving the MP3 failed.",
    "err.mp3Silent": "The recording was silent. If live playback is off, set the MP3 mode to Dub only.",
    "err.mp3Empty": "No audio was captured for the MP3.",
    "err.clip": "Levels ran hot and the limiter kicked in; bump the bitrate to 192 if you hear artifacts.",
    "err.dropped": "The model sent audio faster than real time and about {seconds}s of the dub did not fit.",
    "err.subFailed": "Saving the subtitles failed.",
    "err.subEmptyDub": "No text was captured for the dub subtitles.",
    "err.subEmptySource": "No text was captured for the source-language subtitles."
  }
};

let current = DEFAULT_UI_LANG;

export function setLang(lang) {
  current = DICT[lang] ? lang : DEFAULT_UI_LANG;
  return current;
}

export function getLang() {
  return current;
}

export function dirOf(lang = current) {
  return UI_LANGS.find((item) => item.code === lang)?.dir ?? "rtl";
}

/** اعداد فارسی فقط در حالت فارسی */
export function digits(value, lang = current) {
  const text = String(value);
  return lang === "fa" ? text.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : text;
}

export function t(key, vars, lang = current) {
  const table = DICT[lang] ?? DICT[DEFAULT_UI_LANG];
  let text = table[key] ?? DICT[DEFAULT_UI_LANG][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/**
 * پیام‌های خطا از سرویس‌ورکر/offscreen به‌صورت کد می‌آیند تا در هر دو زبان
 * درست نمایش داده شوند. رشته‌ی خام هم پشتیبانی می‌شود.
 */
export function message(payload, lang = current) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.code) return t(payload.code, payload.vars, lang);
  return "";
}

/** ترجمه‌ی همه‌ی گره‌های دارای data-i18n */
export function applyDom(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
    if (node.hasAttribute("aria-label")) node.setAttribute("aria-label", t(node.dataset.i18nTitle));
  }
  for (const node of root.querySelectorAll("[data-i18n-ph]")) {
    node.placeholder = t(node.dataset.i18nPh);
  }
}
