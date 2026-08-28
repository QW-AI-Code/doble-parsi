/**
 * ساخت زیرنویس از تکه‌های متنی که به‌صورت زنده از مدل می‌رسد
 * و تبدیل آن به SRT / WebVTT.
 */

const SENTENCE_END = /[.!?؟…۔。！？]["'”»)\]]?$/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
const NO_SPACE_BEFORE = /^[,.!?;:؟،؛…)\]}»"']/u;

const IDLE_FLUSH_MS = 900;
const MAX_CUE_MS = 7000;
const MAX_CUE_CHARS = 140;
const MIN_SENTENCE_CHARS = 12;
const MIN_CUE_MS = 700;

function joinText(previous, next) {
  if (!previous) return next.trimStart();
  if (/\s$/.test(previous) || /^\s/.test(next)) return previous + next;
  if (NO_SPACE_BEFORE.test(next)) return previous + next;
  if (CJK.test(previous.at(-1) ?? "") || CJK.test(next.at(0) ?? "")) return previous + next;
  return `${previous} ${next}`;
}

function stamp(ms, separator) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(millis, 3)}`;
}

export class CaptionTrack {
  constructor() {
    this.cues = [];
    this.buffer = "";
    this.startMs = 0;
    this.lastMs = 0;
  }

  get isEmpty() {
    return this.cues.length === 0 && !this.buffer.trim();
  }

  get cueCount() {
    return this.cues.length + (this.buffer.trim() ? 1 : 0);
  }

  /** یک تکه متن تازه با زمان رسیدنش */
  push(text, atMs) {
    const chunk = typeof text === "string" ? text : "";
    if (!chunk.trim()) return;
    if (!this.buffer.trim()) this.startMs = atMs;
    this.buffer = joinText(this.buffer, chunk);
    this.lastMs = atMs;

    const trimmed = this.buffer.trim();
    const longEnough = trimmed.length >= MIN_SENTENCE_CHARS;
    if ((SENTENCE_END.test(trimmed) && longEnough) ||
        trimmed.length >= MAX_CUE_CHARS ||
        atMs - this.startMs >= MAX_CUE_MS) {
      this.flush(atMs);
    }
  }

  /** هر چند صد میلی‌ثانیه صدا زده می‌شود تا سکوت‌ها کیو را ببندند */
  tick(nowMs) {
    if (this.buffer.trim() && nowMs - this.lastMs >= IDLE_FLUSH_MS) this.flush(nowMs);
  }

  flush(endMs) {
    const text = this.buffer.trim();
    this.buffer = "";
    if (!text) return;
    const start = this.startMs;
    const end = Math.max(endMs ?? this.lastMs, start + MIN_CUE_MS);
    this.cues.push({ start, end, text });
  }

  /** کیوهای نهایی با اعمال آفست تاخیر و جلوگیری از همپوشانی */
  finalize(offsetMs = 0) {
    this.flush(this.lastMs);
    const shifted = this.cues
      .map((cue) => {
        const duration = Math.max(MIN_CUE_MS, cue.end - cue.start);
        const start = Math.max(0, cue.start - offsetMs);
        return { start, end: start + duration, text: cue.text };
      })
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < shifted.length - 1; i += 1) {
      if (shifted[i].end > shifted[i + 1].start) {
        shifted[i].end = Math.max(shifted[i].start + 200, shifted[i + 1].start - 40);
      }
    }
    return shifted;
  }

  plainText() {
    this.flush(this.lastMs);
    return this.cues.map((cue) => cue.text).join("\n");
  }
}

export function toSrt(cues) {
  return cues
    .map((cue, index) =>
      `${index + 1}\n${stamp(cue.start, ",")} --> ${stamp(cue.end, ",")}\n${cue.text}\n`)
    .join("\n");
}

export function toVtt(cues) {
  const body = cues
    .map((cue) => `${stamp(cue.start, ".")} --> ${stamp(cue.end, ".")}\n${cue.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
