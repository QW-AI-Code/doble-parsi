/**
 * حافظهٔ ترجمه (Translation Memory).
 *
 * هر خطی که یک بار ترجمه شده، دیگر ترجمه نمی‌شود. دو لایه ذخیره داریم:
 *
 *   lines  — تک‌خط‌ها، مستقل از ویدئو. اگر جملهٔ «Let's get started.» را
 *            در یک ویدئو ترجمه کرده باشیم، در هر ویدئوی دیگری هم مجانی است.
 *   tracks — کل زیرنویس یک ویدئو در یک رکورد. بازتماشای همان ویدئو با یک
 *            خواندن از دیسک کامل می‌شود، بدون هیچ درخواست شبکه.
 *
 * روی IndexedDB نوشته شده، چون در سرویس‌ورکر MV3 در دسترس است، به‌خلاف
 * localStorage. سهمیهٔ `chrome.storage.local` هم بی‌جهت مصرف نمی‌شود.
 *
 * کلید هر خط از یک هش سریع غیررمزنگارانه ساخته می‌شود و متن مبدأ هم کنار
 * ترجمه ذخیره می‌شود، پس برخورد هش هرگز به ترجمهٔ غلط تبدیل نمی‌شود.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

const DB_NAME = "doble-parsi-memory";
const DB_VERSION = 1;
const LINE_STORE = "lines";
const TRACK_STORE = "tracks";

/** سقف نگهداری؛ از این بیشتر، قدیمی‌ترین‌ها کنار می‌روند */
export const LIMITS = { lines: 40000, tracks: 80 };

let connection = null;

function open() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LINE_STORE)) {
        const lines = db.createObjectStore(LINE_STORE, { keyPath: "id" });
        lines.createIndex("touched", "touched");
      }
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        const tracks = db.createObjectStore(TRACK_STORE, { keyPath: "id" });
        tracks.createIndex("touched", "touched");
      }
    };
    request.onsuccess = () => {
      request.result.onclose = () => { connection = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    connection = null;
    throw error;
  });
  return connection;
}

function run(store, mode, work) {
  return open().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const result = work(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(result?.value ?? result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

const wrap = (request) => {
  const box = { value: undefined };
  request.onsuccess = () => { box.value = request.result; };
  return box;
};

/**
 * هش رشتهٔ متنی، ۵۳ بیت، بدون وابستگی و بدون await.
 * برای کلید کش کافی است؛ ادعای رمزنگاری ندارد و متن مبدأ هم ذخیره می‌شود.
 */
export function hashText(value) {
  const text = String(value ?? "");
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** فاصله‌ها و نویز نگارشی یکدست می‌شود تا یک جمله دو بار ترجمه نشود */
export function canonical(text) {
  return String(text ?? "")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function lineId({ target, model, text }) {
  return `${target}|${model}|${hashText(canonical(text))}`;
}

export function trackId({ key, lang, target, model }) {
  return `${key}|${lang || "auto"}|${target}|${model}`;
}

/**
 * ترجمه‌های موجود را برمی‌گرداند.
 * @returns {Promise<Map<string, string>>} متن مبدأ ⇒ ترجمه
 */
export async function recallLines({ target, model, texts }) {
  const found = new Map();
  const unique = [...new Set(texts.filter((text) => text && text.trim()))];
  if (!unique.length) return found;

  try {
    const rows = await run(LINE_STORE, "readonly", (store) => {
      const boxes = unique.map((text) => ({ text, box: wrap(store.get(lineId({ target, model, text }))) }));
      return { value: boxes };
    });
    for (const row of rows) {
      const record = row.box.value;
      if (record && canonical(record.source) === canonical(row.text)) found.set(row.text, record.text);
    }
  } catch {
    return found;                                   // حافظه اختیاری است، خطا نباید جلسه را بخواباند
  }
  return found;
}

export async function rememberLines({ target, model, pairs }) {
  const rows = (pairs ?? []).filter((pair) => pair?.source?.trim() && pair?.text?.trim());
  if (!rows.length) return 0;
  const touched = Date.now();
  try {
    await run(LINE_STORE, "readwrite", (store) => {
      for (const pair of rows) {
        store.put({
          id: lineId({ target, model, text: pair.source }),
          source: pair.source,
          text: pair.text,
          target,
          model,
          touched
        });
      }
    });
    await trim(LINE_STORE, LIMITS.lines);
    return rows.length;
  } catch {
    return 0;
  }
}

export async function recallTrack(identity) {
  try {
    const record = await run(TRACK_STORE, "readonly", (store) => wrap(store.get(trackId(identity))));
    if (!record?.cues?.length) return null;
    // آخرین استفاده را به‌روز می‌کنیم تا در پاک‌سازی LRU زودتر قربانی نشود
    run(TRACK_STORE, "readwrite", (store) => store.put({ ...record, touched: Date.now() })).catch(() => {});
    return record;
  } catch {
    return null;
  }
}

export async function rememberTrack(identity, payload) {
  try {
    await run(TRACK_STORE, "readwrite", (store) => {
      store.put({ id: trackId(identity), ...identity, ...payload, touched: Date.now() });
    });
    await trim(TRACK_STORE, LIMITS.tracks);
    return true;
  } catch {
    return false;
  }
}

/** قدیمی‌ترین رکوردها را حذف می‌کند تا تعداد از سقف پایین بیاید */
async function trim(store, limit) {
  try {
    const count = await run(store, "readonly", (objectStore) => wrap(objectStore.count()));
    if (count <= limit) return;
    let remaining = count - limit;
    await run(store, "readwrite", (objectStore) => {
      const cursor = objectStore.index("touched").openCursor();
      cursor.onsuccess = () => {
        const position = cursor.result;
        if (!position || remaining <= 0) return;
        position.delete();
        remaining -= 1;
        position.continue();
      };
    });
  } catch {
    // پاک‌سازی بهترین‌تلاش است
  }
}

export async function stats() {
  try {
    const lines = await run(LINE_STORE, "readonly", (store) => wrap(store.count()));
    const tracks = await run(TRACK_STORE, "readonly", (store) => wrap(store.count()));
    return { lines: lines ?? 0, tracks: tracks ?? 0 };
  } catch {
    return { lines: 0, tracks: 0 };
  }
}

export async function clear() {
  try {
    await run(LINE_STORE, "readwrite", (store) => store.clear());
    await run(TRACK_STORE, "readwrite", (store) => store.clear());
    return true;
  } catch {
    return false;
  }
}
