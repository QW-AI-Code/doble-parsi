/**
 * جهت‌دهی دوسویه (bidi) برای زیرنویس.
 *
 * مشکل: یک جملهٔ فارسی که وسطش «Windows 11» یا «GitHub Actions» دارد، اگر فقط
 * `dir="rtl"` بگیرد، الگوریتم دوسویه عدد و نقطه و پرانتز مرزی را به سمت غلط
 * می‌کشد و جمله به‌هم می‌ریزد. راه‌حل استاندارد، *جداسازی* آن تکه است.
 *
 * دو راه وجود دارد و اینجا دومی انتخاب شده:
 *   ۱) هر تکهٔ لاتین را در یک `<span dir="ltr">` بپیچیم — یعنی ساختن ده‌ها
 *      عنصر در هر فریم، و از کار افتادن هایلایت کارائوکه که روی *یک* گرهٔ
 *      متنی کار می‌کند.
 *   ۲) همان کار را با کاراکترهای جداساز یونیکد انجام دهیم:
 *      U+2066 (LRI) پیش از تکه و U+2069 (PDI) پس از آن. متن یک گرهٔ متنی
 *      می‌ماند، DOM دست‌نخورده است، و مرورگر همان جداسازی را اعمال می‌کند.
 *
 * این توابع خالص‌اند: نه DOM، نه شبکه. پس قابل تست‌اند.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

/** LEFT-TO-RIGHT ISOLATE */
export const LRI = "\u2066";
/** POP DIRECTIONAL ISOLATE */
export const PDI = "\u2069";

const RTL_STRONG = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0780-\u07bf\ufb1d-\ufdff\ufe70-\ufeff]/;
const LTR_STRONG = /[A-Za-z\u00c0-\u024f\u0370-\u052f]/;

/**
 * یک تکهٔ لاتین: با یک حرف لاتین شروع می‌شود و می‌تواند رقم، نقطه، خط تیره و
 * چند کلمهٔ پشت‌سرهم را در بر بگیرد. «11» تنها عدد است و جداسازی لازم ندارد،
 * ولی «Windows 11» یک تکهٔ کامل است.
 */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9._'’+#&/\\:-]*(?:[ \u00a0]+[A-Za-z0-9][A-Za-z0-9._'’+#&/\\:-]*)*/g;

/**
 * جهت پاراگراف را از نخستین کاراکتر «قوی» تشخیص می‌دهد — همان کاری که
 * `dir="auto"` می‌کند، ولی اینجا خودمان لازمش داریم تا بدانیم جداسازی
 * لازم است یا نه.
 * @returns {"rtl" | "ltr"}
 */
export function baseDirection(text) {
  for (const character of String(text ?? "")) {
    if (RTL_STRONG.test(character)) return "rtl";
    if (LTR_STRONG.test(character)) return "ltr";
  }
  return "ltr";
}

/**
 * تکه‌های لاتین را با جداساز یونیکد می‌پیچد.
 *
 * در متن چپ‌چین کاری انجام نمی‌شود: آنجا تکهٔ لاتین خودش در جهت پاراگراف است.
 * جداسازهای قبلی هم دوباره پیچیده نمی‌شوند تا متن آلوده نشود.
 *
 * @param {string} text
 * @param {"rtl" | "ltr" | "auto"} [direction]
 */
export function isolateLatin(text, direction = "auto") {
  const value = String(text ?? "");
  if (!value) return "";
  const base = direction === "auto" ? baseDirection(value) : direction;
  if (base !== "rtl") return value;
  if (value.includes(LRI)) return value;
  return value.replace(LATIN_RUN, (run) => `${LRI}${run}${PDI}`);
}

/** جداسازها را برمی‌دارد؛ برای نوشتن در فایل زیرنویس و کلید حافظه */
export function stripIsolates(text) {
  return String(text ?? "").replace(/[\u2066\u2067\u2068\u2069\u200e\u200f]/g, "");
}

/**
 * متن آمادهٔ نمایش روی ویدئو، همراه جهتی که باید به عنصر داده شود.
 * @returns {{ text: string, dir: "rtl" | "ltr" }}
 */
export function forDisplay(text) {
  const dir = baseDirection(text);
  return { text: isolateLatin(text, dir), dir };
}
