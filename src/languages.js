/**
 * زبان‌های مقصد دوبله
 * Dubbing target languages
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

/**
 * code    : کد BCP-47 که به translationConfig فرستاده می‌شود
 * english : نام انگلیسی زبان
 */
export const LANGUAGES = [
  { code: "fa", english: "Persian (Farsi)", fa: "فارسی", en: "Persian" },
  { code: "en", english: "English", fa: "انگلیسی", en: "English" },
  { code: "ar", english: "Arabic", fa: "عربی", en: "Arabic" },
  { code: "tr", english: "Turkish", fa: "ترکی استانبولی", en: "Turkish" },
  { code: "az", english: "Azerbaijani", fa: "ترکی آذربایجانی", en: "Azerbaijani" },
  { code: "de", english: "German", fa: "آلمانی", en: "German" },
  { code: "fr", english: "French", fa: "فرانسوی", en: "French" },
  { code: "es", english: "Spanish", fa: "اسپانیایی", en: "Spanish" },
  { code: "it", english: "Italian", fa: "ایتالیایی", en: "Italian" },
  { code: "ru", english: "Russian", fa: "روسی", en: "Russian" },
  { code: "hi", english: "Hindi", fa: "هندی", en: "Hindi" },
  { code: "ur", english: "Urdu", fa: "اردو", en: "Urdu" },
  { code: "zh-Hans", english: "Simplified Chinese", fa: "چینی (ساده)", en: "Chinese (Simplified)" },
  { code: "ja", english: "Japanese", fa: "ژاپنی", en: "Japanese" },
  { code: "ko", english: "Korean", fa: "کره‌ای", en: "Korean" },
  { code: "pt-BR", english: "Brazilian Portuguese", fa: "پرتغالی (برزیل)", en: "Portuguese (Brazil)" },
  { code: "nl", english: "Dutch", fa: "هلندی", en: "Dutch" },
  { code: "sv", english: "Swedish", fa: "سوئدی", en: "Swedish" },
  { code: "pl", english: "Polish", fa: "لهستانی", en: "Polish" },
  { code: "id", english: "Indonesian", fa: "اندونزیایی", en: "Indonesian" },
  { code: "vi", english: "Vietnamese", fa: "ویتنامی", en: "Vietnamese" },
  { code: "he", english: "Hebrew", fa: "عبری", en: "Hebrew" },
  { code: "el", english: "Greek", fa: "یونانی", en: "Greek" },
  { code: "th", english: "Thai", fa: "تایلندی", en: "Thai" },
  { code: "uk", english: "Ukrainian", fa: "اوکراینی", en: "Ukrainian" },
  { code: "ro", english: "Romanian", fa: "رومانیایی", en: "Romanian" },
  { code: "hu", english: "Hungarian", fa: "مجاری", en: "Hungarian" },
  { code: "cs", english: "Czech", fa: "چکی", en: "Czech" },
  { code: "bn", english: "Bengali", fa: "بنگالی", en: "Bengali" },
  { code: "ta", english: "Tamil", fa: "تامیلی", en: "Tamil" },
  { code: "sw", english: "Swahili", fa: "سواحیلی", en: "Swahili" }
];

/** مدل‌های پیشنهادی */
export const TRANSLATE_MODELS = [
  "gemini-3.5-live-translate-preview"
];

export function findLanguage(code) {
  return LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0];
}

export function languageLabel(code, lang = "fa") {
  const item = LANGUAGES.find((entry) => entry.code === code);
  return item ? item[lang] ?? item.fa : code;
}
