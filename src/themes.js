/**
 * قالب‌های نمایش زیرنویس روی ویدئو.
 *
 * هر قالب فقط یک `data-theme` روی صحنه است؛ ظاهرش کامل در
 * `src/overlay/stage-css.js` تعریف شده. اینجا فقط نام دوزبانه و رنگ‌های
 * نمونه برای تراشه‌های انتخاب در پاپ‌آپ نگه داشته می‌شود.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

export const OVERLAY_THEMES = [
  {
    id: "aurora",
    fa: "شفق",
    en: "Aurora",
    swatch: { plate: "rgba(14,20,40,.55)", ink: "#ffffff", accent: "#22d3ee", glow: true }
  },
  {
    id: "neon",
    fa: "نئون",
    en: "Neon",
    swatch: { plate: "transparent", ink: "#f2f7ff", accent: "#38bdf8", glow: true }
  },
  {
    id: "cinema",
    fa: "سینما",
    en: "Cinema",
    swatch: { plate: "transparent", ink: "#fffdf7", accent: "#ffd479", outline: true }
  },
  {
    id: "ribbon",
    fa: "روبان",
    en: "Ribbon",
    swatch: { plate: "linear-gradient(135deg,#3b82f6,#8b5cf6)", ink: "#ffffff", accent: "#fff3b0" }
  },
  {
    id: "slate",
    fa: "تخته",
    en: "Slate",
    swatch: { plate: "rgba(8,12,24,.92)", ink: "#e8edfb", accent: "#3b82f6", bar: true }
  },
  {
    id: "paper",
    fa: "کاغذ",
    en: "Paper",
    swatch: { plate: "#fcfaf5", ink: "#14181f", accent: "#b45309" }
  }
];

export const DEFAULT_THEME = OVERLAY_THEMES[0].id;

export function findTheme(id) {
  return OVERLAY_THEMES.find((theme) => theme.id === id) ?? OVERLAY_THEMES[0];
}

/** اندازهٔ متن به‌صورت نسبتی از ارتفاع ویدئو ذخیره می‌شود، نه پیکسل ثابت،
 *  تا در تمام‌صفحه و پنجرهٔ کوچک یک‌اندازه دیده شود. */
export const SCALE_RANGE = { min: 0.026, max: 0.072, step: 0.002 };
