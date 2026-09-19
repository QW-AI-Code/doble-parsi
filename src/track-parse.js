/**
 * تبدیل فایل زیرنویس واقعیِ سایت به کیوهای یکدست.
 *
 * چهار قالبی که پخش‌کننده‌های وب عملاً تحویل می‌دهند پشتیبانی می‌شود:
 *   json3  (نسخهٔ JSON زیرنویس زمان‌بندی‌شدهٔ یوتیوب)
 *   ttml   (همان زیرنویس در قالب XML، حالت پیش‌فرض قدیمی‌تر)
 *   vtt    (WebVTT، استاندارد <track> در HTML)
 *   srt    (فایل‌های آپلودی کاربران)
 *
 * ورودی همیشه متن خام است و خروجی همیشه آرایه‌ای از
 * `{ start, end, text }` بر حسب **میلی‌ثانیه** روی خط زمانی خودِ ویدئو.
 * این توابع خالص‌اند: نه شبکه، نه DOM. پس هم در سرویس‌ورکر کار می‌کنند و
 * هم در تست.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

const MIN_CUE_MS = 220;
const MAX_CUE_MS = 12000;
const HTML_ENTITIES = new Map([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"],
  ["nbsp", "\u00a0"], ["#39", "'"], ["#34", '"']
]);

/** موجودیت‌های HTML و تگ‌های درون‌خطی زیرنویس را باز می‌کند */
export function decodeCaptionText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")                 // <i>, <c.colorE5E5E5>, <v Roger> …
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
      const key = name.toLowerCase();
      if (HTML_ENTITIES.has(key)) return HTML_ENTITIES.get(key);
      if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16) || 0x20);
      if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10) || 0x20);
      return whole;
    })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** «00:01:02,500» و «1:02.5» و «62.5s» ⇒ میلی‌ثانیه */
export function parseTimestamp(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const parts = text.split(":").map((part) => Number.parseFloat(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Math.round(seconds * 1000);
}

/**
 * کیوها را مرتب، بی‌همپوشانی و بدون خط تکراری می‌کند.
 * پخش‌کننده‌ها زیرنویس «غلتان» می‌فرستند: هر کیو خط قبلی را هم تکرار می‌کند.
 * آن دنبالهٔ تکراری اینجا حذف می‌شود تا ترجمه دوباره هزینه نبرد.
 */
export function normalizeCues(input) {
  const cues = [];
  for (const raw of input ?? []) {
    const text = decodeCaptionText(raw?.text).replace(/\n/g, " ").trim();
    if (!text) continue;
    const start = Math.max(0, Math.round(Number(raw.start) || 0));
    let end = Math.round(Number(raw.end) || 0);
    if (!(end > start)) end = start + MIN_CUE_MS;
    cues.push({ start, end: Math.min(end, start + MAX_CUE_MS), text });
  }

  cues.sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  // متن کاملِ کیوی قبلی، پیش از کوتاه‌شدن. مقایسه باید با همین انجام شود،
  // وگرنه در زیرنویس غلتان فقط یک پله جلو می‌رویم و بقیه دوباره تکرار می‌شوند.
  let previousFull = "";
  for (const cue of cues) {
    const previous = out.at(-1);
    if (previous) {
      // همان متن، چسبیده به کیوی قبلی ⇒ فقط پایانش را کِش می‌دهیم
      if (previousFull === cue.text && cue.start - previous.end <= 400) {
        previous.end = Math.max(previous.end, cue.end);
        continue;
      }
      // زیرنویس غلتان: کیوی تازه با متن قبلی شروع شده
      if (cue.text.startsWith(previousFull) && cue.text.length > previousFull.length) {
        const rest = cue.text.slice(previousFull.length).trim();
        if (rest) {
          out.push({ start: Math.max(cue.start, previous.end), end: cue.end, text: rest });
          previousFull = cue.text;
          continue;
        }
      }
      if (previous.end > cue.start) previous.end = Math.max(previous.start + 120, cue.start);
    }
    out.push(cue);
    previousFull = cue.text;
  }
  return out;
}

function fromJson3(payload) {
  const events = payload?.events ?? [];
  return events.map((event) => {
    const text = (event.segs ?? []).map((segment) => segment.utf8 ?? "").join("");
    const start = Number(event.tStartMs) || 0;
    const duration = Number(event.dDurationMs) || 0;
    return { start, end: start + duration, text };
  });
}

function fromTtml(text) {
  const cues = [];
  // بدون DOMParser نوشته شده تا در سرویس‌ورکر هم قابل استفاده باشد
  const pattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  for (const match of text.matchAll(pattern)) {
    const attributes = match[1];
    const at = (name) => new RegExp(`${name}="([^"]*)"`, "i").exec(attributes)?.[1];
    const start = parseTimestamp(at("begin") ?? at("t"))
      ?? (at("t") ? Number(at("t")) : null);
    if (start === null) continue;
    const explicitEnd = parseTimestamp(at("end"));
    const duration = Number(at("dur") ?? at("d"));
    const end = explicitEnd ?? (Number.isFinite(duration) ? start + duration : start + 2000);
    cues.push({ start, end, text: match[2].replace(/<br\s*\/?>/gi, " ") });
  }
  return cues;
}

function fromCueBlocks(text, arrow) {
  const cues = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim());
    if (!lines.length) continue;
    const timingIndex = lines.findIndex((line) => line.includes(arrow));
    if (timingIndex < 0) continue;
    const [from, to] = lines[timingIndex].split(arrow);
    const start = parseTimestamp(from);
    const end = parseTimestamp(String(to ?? "").trim().split(/\s+/)[0]);
    if (start === null) continue;
    cues.push({ start, end: end ?? start + 2000, text: lines.slice(timingIndex + 1).join("\n") });
  }
  return cues;
}

/** تشخیص قالب از روی محتوا؛ روی حدس نام فایل تکیه نمی‌کنیم */
export function detectFormat(text) {
  const head = String(text ?? "").trimStart().slice(0, 400);
  if (!head) return "unknown";
  if (head.startsWith("{") || head.startsWith("[")) return "json3";
  if (/^WEBVTT/i.test(head)) return "vtt";
  if (/^</.test(head)) return "ttml";
  if (/-->/.test(head)) return "srt";
  return "unknown";
}

/**
 * متن خام زیرنویس ⇒ کیوهای یکدست.
 * @param {string} text
 * @param {string} [format] اگر ندانیم، از محتوا تشخیص داده می‌شود
 */
export function parseCaptionFile(text, format) {
  const kind = format && format !== "auto" ? format : detectFormat(text);
  let raw = [];
  if (kind === "json3") {
    try {
      raw = fromJson3(JSON.parse(text));
    } catch {
      raw = [];
    }
  } else if (kind === "ttml") raw = fromTtml(text);
  else if (kind === "vtt") raw = fromCueBlocks(text, "-->");
  else if (kind === "srt") raw = fromCueBlocks(text, "-->");
  return normalizeCues(raw);
}

/**
 * کیوهای کوتاه را به جمله‌های خواندنی می‌چسباند.
 *
 * زیرنویس خودکار یوتیوب هر دو سه کلمه یک کیو می‌سازد. ترجمهٔ تکه‌تکه‌ی آن
 * هم بی‌کیفیت است و هم گران. اینجا کیوهای پشت‌سرهم تا مرز جمله یکی می‌شوند
 * و زمان شروع اولین و پایان آخرین کیو حفظ می‌شود.
 */
export function groupIntoSentences(cues, { maxChars = 190, maxMs = 8000, gapMs = 900 } = {}) {
  const sentenceEnd = /[.!?؟…۔。！？][)"'”»\]]?$/u;
  const out = [];
  let open = null;

  const close = () => {
    if (open) out.push(open);
    open = null;
  };

  for (const cue of cues) {
    if (!open) {
      open = { start: cue.start, end: cue.end, text: cue.text };
    } else if (
      cue.start - open.end > gapMs ||
      open.text.length + cue.text.length + 1 > maxChars ||
      cue.end - open.start > maxMs
    ) {
      close();
      open = { start: cue.start, end: cue.end, text: cue.text };
    } else {
      open.text = `${open.text} ${cue.text}`.replace(/\s+/g, " ");
      open.end = cue.end;
    }
    if (open && sentenceEnd.test(open.text)) close();
  }
  close();
  return out;
}
