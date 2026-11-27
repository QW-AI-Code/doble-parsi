/**
 * حافظهٔ «مدل‌هایی که روی همین کلید واقعاً کار می‌کنند».
 *
 * مشکل نسخهٔ ۱.۲.۰: با دکمهٔ «نمایش زیرنویس» در بیشتر مواقع زیرنویسی دیده
 * نمی‌شد، چون مدل پیش‌فرض روی کلید رایگانِ کاربر سهمیهٔ صفر داشت یا وجود
 * نداشت؛ تنها راه‌حل، زدن دستی «یافتن مدل‌هایی که روی کلید من کار می‌کنند» بود.
 *
 * حالا همین بررسی پیش از ترجمه **خودکار** انجام می‌شود و نتیجه‌اش برای همان
 * کلید نگه داشته می‌شود، پس بار بعد هیچ هزینه‌ای ندارد. خود کلید هرگز ذخیره
 * نمی‌شود؛ فقط یک اثر انگشت کوتاه SHA-256 از آن، تا با عوض شدن کلید، فهرست
 * قدیمی دوباره استفاده نشود.
 *
 * Working-model cache (1.3.0): "Show subtitles" now runs the model probe on its
 * own and remembers the answer per API key (only a short SHA-256 fingerprint of
 * the key is stored, never the key itself).
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

export const MODEL_CACHE_KEY = "dubleParsiModels";

/** نتیجهٔ بررسی تا این مدت معتبر است؛ بعد از آن دوباره بررسی می‌شود */
export const MODEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** اثر انگشت کوتاه کلید (۱۶ رقم هگز از SHA-256) */
export async function keyTag(apiKey) {
  const key = String(apiKey ?? "").trim();
  if (!key) return "";
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** آیا حافظه برای همین کلید و هنوز تازه است؟ */
export function isFresh(entry, tag, now = Date.now()) {
  return Boolean(
    entry && tag && entry.tag === tag &&
    Array.isArray(entry.models) && entry.models.length > 0 &&
    Number.isFinite(entry.at) && now - entry.at < MODEL_CACHE_TTL_MS
  );
}

/**
 * مدلی که برای ترجمه به کار می‌رود.
 * انتخاب دستی کاربر محترم است؛ «خودکار» یعنی کم‌مصرف‌ترین مدلِ کارکننده.
 * @returns {{ model: string, fallbacks: string[] }}
 */
export function pickModel(models, wanted) {
  const ids = (models ?? []).map((entry) => String(entry?.id ?? entry ?? "")).filter(Boolean);
  const chosen = String(wanted ?? "").trim();
  const model = chosen || ids[0] || "";
  return { model, fallbacks: ids.filter((id) => id !== model) };
}

function area() {
  return globalThis.chrome?.storage?.local ?? null;
}

export async function readModelCache() {
  try {
    const store = area();
    if (!store) return null;
    const saved = await store.get(MODEL_CACHE_KEY);
    return saved?.[MODEL_CACHE_KEY] ?? null;
  } catch {
    return null;
  }
}

export async function writeModelCache(apiKey, models) {
  try {
    const store = area();
    const tag = await keyTag(apiKey);
    if (!store || !tag) return null;
    const entry = {
      tag,
      at: Date.now(),
      models: (models ?? []).map((model) => ({
        id: String(model.id),
        thrifty: Boolean(model.thrifty),
        ms: Number(model.ms) || 0
      }))
    };
    await store.set({ [MODEL_CACHE_KEY]: entry });
    return entry;
  } catch {
    return null;
  }
}

export async function clearModelCache() {
  try {
    await area()?.remove(MODEL_CACHE_KEY);
  } catch {}
}
