/**
 * تپ صوتی: نمونه‌های خام را مونو می‌کند و به ترد اصلی می‌فرستد؛ خروجی خودش سکوت است.
 *
 * تفاوت با نسخه‌ی ۱.۰.۰: بسته‌بندی (batching).
 * قبلاً هر رندرکوانتوم (۱۲۸ نمونه) یک postMessage جدا بود ⇒ ۳۷۵ پیام در ثانیه
 * برای هر تپ. زیر بار، ترد اصلی عقب می‌افتد، پیام‌ها دیر می‌رسند و در فایل
 * ضبط‌شده به‌شکل تِرَق‌تِرَق دیده می‌شود. حالا در بسته‌های ۱۰۲۴ نمونه‌ای
 * ارسال می‌شود (حدود ۴۷ پیام در ثانیه در ۴۸ کیلوهرتز).
 */
const BATCH_FRAMES = 1024;

class DubTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batch = new Float32Array(BATCH_FRAMES);
    this.used = 0;
    this.closed = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === "flush") this.emit();
      if (event.data?.type === "close") {
        this.emit();
        this.closed = true;
      }
    };
  }

  emit() {
    if (!this.used) return;
    const payload = this.batch.slice(0, this.used);
    this.used = 0;
    this.port.postMessage(payload.buffer, [payload.buffer]);
  }

  push(mono, frames) {
    let offset = 0;
    while (offset < frames) {
      const room = BATCH_FRAMES - this.used;
      const take = room < frames - offset ? room : frames - offset;
      this.batch.set(mono.subarray(offset, offset + take), this.used);
      this.used += take;
      offset += take;
      if (this.used === BATCH_FRAMES) this.emit();
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) {
      for (const channel of output) channel.fill(0);
    }
    if (this.closed) return false;

    const input = inputs[0];
    if (!input || !input.length) return true;

    const first = input[0];
    if (!first || !first.length) return true;

    const frames = first.length;

    if (input.length === 1) {
      this.push(first, frames);
      return true;
    }

    if (!this.mono || this.mono.length < frames) this.mono = new Float32Array(frames);
    const mono = this.mono;
    mono.fill(0, 0, frames);

    let counted = 0;
    for (const channel of input) {
      if (!channel || channel.length !== frames) continue;
      for (let i = 0; i < frames; i += 1) mono[i] += channel[i];
      counted += 1;
    }
    if (counted > 1) {
      const scale = 1 / counted;
      for (let i = 0; i < frames; i += 1) mono[i] *= scale;
    }

    this.push(mono, frames);
    return true;
  }
}

registerProcessor("dub-tap", DubTapProcessor);
