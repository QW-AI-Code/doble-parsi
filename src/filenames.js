/**
 * نام‌گذاری و مسیر خروجی‌ها.
 *
 * هدف: فایل MP3 و زیرنویس باید *دقیقاً* هم‌نام ویدئوی اصلی ذخیره شوند،
 * نه با یک نام تصادفی. نام از عنوان تب گرفته می‌شود و برند سایت
 * («… - YouTube»، «… - آپارات» و مانند آن) از انتهای آن حذف می‌شود.
 *
 * ساختار پوشه‌ها، تا پوشهٔ دانلود شلوغ نشود:
 *   Downloads/Doble Parsi/<نام ویدئو>/<نام ویدئو>.mp3
 *   Downloads/Doble Parsi/<نام ویدئو>/<نام ویدئو>.srt
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

/** پوشهٔ اصلی همهٔ خروجی‌ها، داخل پوشهٔ دانلود مرورگر */
export const ROOT_FOLDER = "Doble Parsi";

/** کاراکترهایی که ویندوز/مک/لینوکس در نام فایل نمی‌پذیرند */
const ILLEGAL = /[\x00-\x1f\x7f<>:"/\\|?*]/gu;

/** شمارنده‌ی اعلان‌های یوتیوب و مانند آن: «(3) عنوان» */
const NOTIFICATION_PREFIX = /^\(\s*\d+\s*\)\s*/u;

/** جداکننده‌های رایج بین عنوان و نام سرویس */
const BRAND_SPLIT = /\s+[-|–—·•·]\s+/u;

const KNOWN_BRANDS = [
  "youtube", "youtubemusic", "youtubekids", "netflix", "vimeo", "twitch",
  "dailymotion", "aparat", "آپارات", "نماوا", "namava", "فیلیمو", "filimo",
  "telewebion", "تلوبیون", "filmnet", "فیلم‌نت", "primevideo", "amazonprimevideo",
  "disney+", "disneyplus", "hulu", "hbomax", "max", "appletv", "appletv+",
  "spotify", "soundcloud", "bilibili", "rutube", "vk", "odysee", "rumble",
  "coursera", "udemy", "edx", "khanacademy", "skillshare", "pluralsight",
  "linkedin", "facebook", "instagram", "tiktok", "x", "twitter", "reddit",
  "googledrive", "googlemeet", "meet", "zoom", "microsoftteams", "teams",
  "skype", "webex", "bigbluebutton", "adobeconnect", "ted", "tedtalk",
  "arte", "bbciplayer", "bbc", "cnn", "aljazeera", "euronews"
];

const TRAILING_JUNK = [
  /\s*[-–—|]\s*(watch online|full movie|hd|4k|1080p|720p)\s*$/iu,
  /\s*[-–—|]\s*(تماشای آنلاین|دانلود|پخش آنلاین)\s*$/u
];

function normalizeBrand(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s._]+/g, "")
    .replace(/[™®]/g, "");
}

/** برندهای احتمالی برگرفته از دامنه: youtube.com ⇒ youtube */
function brandsFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter((part) => part && !/^(com|net|org|co|ir|tv|io|me|app|www|de|fr|uk|it|es|ru|in)$/.test(part));
    return parts.map(normalizeBrand);
  } catch {
    return [];
  }
}

/** عنوان تب ⇒ نام فایل خوانا و امن */
export function cleanTitle(title, url) {
  let text = String(title ?? "").normalize("NFKC").trim();
  text = text.replace(NOTIFICATION_PREFIX, "");
  text = text.replace(/^[▶►▷•\s]+/u, "");

  const brands = new Set([...KNOWN_BRANDS.map(normalizeBrand), ...brandsFromUrl(url)]);

  // حداکثر دو بار انتهای عنوان را از نام سرویس پاک می‌کنیم
  for (let round = 0; round < 2; round += 1) {
    const segments = text.split(BRAND_SPLIT);
    if (segments.length < 2) break;
    const last = segments[segments.length - 1].trim();
    if (last && last.length <= 32 && brands.has(normalizeBrand(last))) {
      text = segments.slice(0, -1).join(" - ").trim();
      continue;
    }
    break;
  }

  for (const pattern of TRAILING_JUNK) text = text.replace(pattern, "");

  text = text
    .replace(ILLEGAL, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");

  // محدودیت طول مسیر ویندوز: عنوان را کوتاه می‌کنیم، نه پسوند را
  const clipped = Array.from(text).slice(0, 90).join("").trim().replace(/[.\s]+$/g, "");
  return clipped;
}

export function timestampTag(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** نام امن برای یک پوشه (بدون نقطه و فاصلهٔ اضافی در ابتدا/انتها) */
export function safeFolder(name) {
  const clean = String(name ?? "")
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return Array.from(clean).slice(0, 90).join("").trim().replace(/[.\s]+$/g, "");
}

/** نام پایهٔ خروجی‌ها: هم برای نام فایل، هم برای نام پوشهٔ ویدئو */
export function outputBaseName({ title, url, tag, useOriginalName = true }) {
  const clean = cleanTitle(title, url);
  const stamp = tag ?? timestampTag();
  if (!clean) return `dobleparsi-${stamp}`;
  return useOriginalName ? clean : `${clean}-${stamp}`;
}

/**
 * ساخت نام نهایی فایل.
 * @param {object} input
 * @param {string} input.title       عنوان تب
 * @param {string} input.url         نشانی تب
 * @param {string} input.extension   پسوند بدون نقطه: mp3 | srt | vtt
 * @param {string} [input.suffix]    پسوند میانی مثل "original" برای زیرنویس مبدأ
 * @param {string} [input.tag]       مهر زمانی
 * @param {boolean} [input.useOriginalName] هم‌نام ویدئو یا نام دارای مهر زمانی
 */
export function buildOutputName({ title, url, extension, suffix, tag, useOriginalName = true }) {
  const ext = String(extension ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const base = outputBaseName({ title, url, tag, useOriginalName });
  const middle = suffix ? `.${String(suffix).replace(ILLEGAL, "")}` : "";
  return `${base}${middle}.${ext}`;
}

/**
 * مسیر نسبی نهایی برای chrome.downloads:
 *   Doble Parsi/<نام ویدئو>/<نام ویدئو>.<پسوند>
 * همهٔ خروجی‌های یک جلسه در یک پوشه‌ی هم‌نام ویدئو کنار هم می‌مانند.
 */
export function buildOutputPath(input) {
  const filename = buildOutputName(input);
  const folder = safeFolder(outputBaseName(input)) || "dobleparsi";
  return `${ROOT_FOLDER}/${folder}/${filename}`;
}
