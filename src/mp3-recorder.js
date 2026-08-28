/**
 * انکودر MP3 روی وب‌ورکر (کتابخانهٔ فشرده‌سازی همراهِ افزونه، LAME wasm).
 *
 * ★ رفع ریشه‌ای باگ نویز:
 * ورکر انکودر بافر را با `new Uint8Array(audioData)` می‌گیرد و به
 * `lame_encode_buffer` می‌دهد؛ یعنی داده را **Int16 planar** می‌خواند.
 * نسخه‌ی ۱.۰.۰ بافر Float32 می‌فرستاد، پس بیت‌های ممیز شناور به‌عنوان
 * نمونه‌ی ۱۶ بیتی تفسیر می‌شد و خروجی نویز سفید تمام‌دامنه بود.
 * اندازه‌گیری روی همان انکودر: ورودی Float32 ⇒ RMS ۰٫۴۲۴ و Peak ۱٫۰ با
 * طیف صاف (نویز)، ورودی Int16 ⇒ ۱۰۰٪ انرژی روی فرکانس اصلی (صدای پاک).
 * اینجا پیش از ارسال، محدودکننده‌ی نرم و تبدیل به Int16 اعمال می‌شود.
 */
import { floatToInt16, softLimitInPlace } from "./pcm.js";

const BLOCK_FRAMES = 4608;              // مضربی از فریم ۱۱۵۲ نمونه‌ای MPEG

export class Mp3Recorder {
  constructor({ sampleRate, bitrate = 128000 }) {
    // LAME خودش نرخ‌های غیراستاندارد (مثل ۹۶ کیلوهرتز) را داخلی بازنمونه‌برداری می‌کند
    this.sampleRate = Math.max(8000, Math.round(sampleRate));
    this.bitrate = Math.max(32000, Math.min(320000, Math.round(bitrate)));
    this.worker = null;
    this.nextId = 1;
    this.waiters = new Map();
    this.parts = [];
    this.block = new Float32Array(BLOCK_FRAMES);
    this.scratch = new Int16Array(BLOCK_FRAMES);
    this.blockUsed = 0;
    this.totalFrames = 0;
    this.queue = Promise.resolve();
    this.stopped = false;
    this.error = null;
    this.peak = 0;
    this.clippedFrames = 0;
  }

  async init() {
    this.worker = new Worker(chrome.runtime.getURL("src/vendor/mp3-encoder.worker.js"));
    this.worker.addEventListener("message", (event) => {
      const { id, success, data, error } = event.data ?? {};
      const waiter = this.waiters.get(id);
      if (!waiter) return;
      this.waiters.delete(id);
      if (success) waiter.resolve(data);
      else waiter.reject(new Error(String(error?.message ?? error ?? "MP3 encoder failed")));
    });
    this.worker.addEventListener("error", (event) => {
      this.fail(new Error(event.message || "انکودر MP3 از کار افتاد."));
    });
    await this.request({
      type: "init",
      data: { numberOfChannels: 1, sampleRate: this.sampleRate, bitrate: this.bitrate }
    });
  }

  fail(error) {
    if (!this.error) this.error = error;
    for (const waiter of this.waiters.values()) waiter.reject(error);
    this.waiters.clear();
  }

  request(command, transfer = []) {
    if (this.error) return Promise.reject(this.error);
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.waiters.set(id, { resolve, reject });
      this.worker.postMessage({ id, command }, transfer);
    });
  }

  /** افزودن نمونه‌های تازه (Float32 مونو، هم‌نرخ با sampleRate) */
  append(samples) {
    if (this.stopped || !this.worker || this.error) return;
    let offset = 0;
    while (offset < samples.length) {
      const room = BLOCK_FRAMES - this.blockUsed;
      const take = Math.min(room, samples.length - offset);
      this.block.set(samples.subarray(offset, offset + take), this.blockUsed);
      this.blockUsed += take;
      offset += take;
      if (this.blockUsed === BLOCK_FRAMES) this.flushBlock();
    }
  }

  flushBlock() {
    if (!this.blockUsed) return;
    const frames = this.blockUsed;
    const view = this.block.subarray(0, frames);

    // آمار سطح، پیش از محدودکننده — برای تشخیص سکوت یا اضافه‌بار
    for (let i = 0; i < frames; i += 1) {
      const magnitude = view[i] < 0 ? -view[i] : view[i];
      if (magnitude > this.peak) this.peak = magnitude;
      if (magnitude > 0.999) this.clippedFrames += 1;
    }

    softLimitInPlace(view);
    const pcm = floatToInt16(view, this.scratch).slice(0, frames);

    this.blockUsed = 0;
    this.totalFrames += frames;

    this.queue = this.queue.then(async () => {
      if (this.error) return;
      const result = await this.request(
        { type: "encode", data: { audioData: pcm.buffer, numberOfFrames: frames } },
        [pcm.buffer]
      );
      if (result?.encodedData?.byteLength) this.parts.push(new Uint8Array(result.encodedData));
    }).catch((error) => {
      // خطاها دیگر بی‌صدا بلعیده نمی‌شوند؛ به کاربر گزارش می‌شود
      this.fail(error instanceof Error ? error : new Error(String(error)));
    });
  }

  get durationMs() {
    return Math.round(((this.totalFrames + this.blockUsed) / this.sampleRate) * 1000);
  }

  get isEmpty() {
    return this.totalFrames + this.blockUsed === 0;
  }

  get isSilent() {
    return this.peak < 0.0005;
  }

  async finish() {
    if (this.stopped) return null;
    this.stopped = true;
    this.flushBlock();
    await this.queue;
    if (!this.error) {
      try {
        const result = await this.request({ type: "flush" });
        if (result?.flushedData?.byteLength) this.parts.push(new Uint8Array(result.flushedData));
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
    const failure = this.error;
    this.dispose();
    if (failure) throw failure;
    if (!this.parts.length) return null;
    return new Blob(this.parts, { type: "audio/mpeg" });
  }

  dispose() {
    try {
      this.worker?.terminate();
    } catch {}
    this.worker = null;
    this.waiters.clear();
  }
}
