/**
 * پخش‌کننده‌ی صدای دوبله با بافر حلقه‌ای (ring buffer) — کاملاً بدون تِرَق.
 *
 * چرا جای AudioBufferSourceNode نسخه‌ی ۱.۰.۰ را گرفت:
 *  ۱. قبلاً برای هر تکه‌ی رسیده از مدل یک AudioBuffer با نرخ ۲۴ کیلوهرتز
 *     ساخته و جدا زمان‌بندی می‌شد. هر بافر مستقل بازنمونه‌برداری می‌شد،
 *     پس در مرز هر تکه پرش دامنه و در نتیجه کلیک شنیده می‌شد.
 *  ۲. اگر شبکه لحظه‌ای کند می‌شد، playCursor از currentTime عقب می‌افتاد و
 *     جای خالی با پرش ناگهانی پر می‌شد ⇒ تِرَق بلند، که در فایل MP3 هم ضبط می‌شد.
 *
 * حالا نمونه‌ها از قبل به نرخ کانتکست تبدیل شده‌اند و در یک بافر حلقه‌ای
 * پیوسته می‌ریزند. کم‌شدن داده (underrun) با فید ۲ میلی‌ثانیه‌ای به سکوت
 * می‌رود و برگشتش هم فید ورودی دارد؛ هیچ لبه‌ی تیزی تولید نمی‌شود.
 */
const RING_FRAMES = 1 << 19;   // ≈ ۱۱ ثانیه در ۴۸ کیلوهرتز
const STATUS_INTERVAL_FRAMES = 2048;

class DubPlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    const settings = options?.processorOptions ?? {};
    super();
    this.ring = new Float32Array(RING_FRAMES);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;

    const prebufferMs = Number.isFinite(settings.prebufferMs) ? settings.prebufferMs : 180;
    const fadeMs = Number.isFinite(settings.fadeMs) ? settings.fadeMs : 2;
    const maxBufferMs = Number.isFinite(settings.maxBufferMs) ? settings.maxBufferMs : 9000;

    this.prebufferFrames = Math.max(64, Math.round((prebufferMs / 1000) * sampleRate));
    this.fadeFrames = Math.max(8, Math.round((fadeMs / 1000) * sampleRate));
    this.rampStep = 1 / this.fadeFrames;
    this.maxFrames = Math.min(RING_FRAMES - 1, Math.round((maxBufferMs / 1000) * sampleRate));

    this.streaming = false;
    this.gain = 0;
    this.draining = false;
    this.drainReported = false;
    this.droppedFrames = 0;
    this.sinceStatus = 0;
    this.active = false;

    this.port.onmessage = (event) => this.handle(event.data);
  }

  handle(message) {
    const type = message?.type;
    if (type === "push") {
      this.write(new Float32Array(message.samples));
      return;
    }
    if (type === "drain") {
      this.draining = true;
      this.drainReported = false;
      return;
    }
    if (type === "reset") {
      this.readIndex = 0;
      this.writeIndex = 0;
      this.available = 0;
      this.streaming = false;
      this.gain = 0;
      this.draining = false;
      this.droppedFrames = 0;
    }
  }

  write(samples) {
    const count = samples.length;
    if (!count) return;

    // سرریز: قدیمی‌ترین نمونه‌ها را رها می‌کنیم تا تاخیر بی‌نهایت رشد نکند
    const overflow = this.available + count - this.maxFrames;
    if (overflow > 0) {
      const drop = Math.min(overflow, this.available);
      this.readIndex = (this.readIndex + drop) % RING_FRAMES;
      this.available -= drop;
      this.droppedFrames += drop;
    }

    const first = Math.min(count, RING_FRAMES - this.writeIndex);
    this.ring.set(samples.subarray(0, first), this.writeIndex);
    if (first < count) this.ring.set(samples.subarray(first), 0);
    this.writeIndex = (this.writeIndex + count) % RING_FRAMES;
    this.available += count;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || !output.length) return true;

    const channel = output[0];
    const frames = channel.length;
    channel.fill(0);

    if (!this.streaming) {
      if (this.available >= this.prebufferFrames || (this.draining && this.available > 0)) {
        this.streaming = true;
        this.gain = 0;
      }
    }

    if (this.streaming) {
      const take = this.available < frames ? this.available : frames;
      const starving = take < frames;

      for (let i = 0; i < take; i += 1) {
        let gain = this.gain + this.rampStep;
        if (gain > 1) gain = 1;
        if (starving) {
          // فید خروج روی دنباله‌ی موجود: هرگز لبه‌ی تیز تولید نمی‌شود
          const tail = (take - i) / this.fadeFrames;
          if (tail < gain) gain = tail;
        }
        this.gain = gain;
        channel[i] = this.ring[this.readIndex] * gain;
        this.ring[this.readIndex] = 0;
        this.readIndex = this.readIndex + 1 === RING_FRAMES ? 0 : this.readIndex + 1;
      }

      this.available -= take;
      if (starving) {
        this.streaming = false;
        this.gain = 0;
      }
    }

    for (let c = 1; c < output.length; c += 1) output[c].set(channel);

    const speaking = this.streaming || this.available > 0;
    this.sinceStatus += frames;
    if (this.sinceStatus >= STATUS_INTERVAL_FRAMES || speaking !== this.active) {
      this.sinceStatus = 0;
      this.active = speaking;
      this.port.postMessage({
        type: "status",
        active: speaking,
        bufferedFrames: this.available,
        droppedFrames: this.droppedFrames
      });
    }

    if (this.draining && !this.drainReported && this.available === 0 && !this.streaming) {
      this.drainReported = true;
      this.port.postMessage({ type: "drained", droppedFrames: this.droppedFrames });
    }

    return true;
  }
}

registerProcessor("dub-player", DubPlayerProcessor);
