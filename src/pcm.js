/**
 * ابزارهای سطح‌پایین PCM.
 *
 * نکته‌ی مهم مهندسی (ریشه‌ی باگ نویز نسخه‌ی ۱.۰.۰):
 * انکودر LAME/wasm همراهِ افزونه نمونه‌ها را به‌صورت
 * «Int16 planar» می‌خواند. اگر بافر Float32 به آن بدهیم، بیت‌های ممیز شناور
 * به‌عنوان Int16 تفسیر می‌شوند و خروجی نویز سفید تمام‌دامنه می‌شود
 * (RMS ≈ ۰٫۴۲ و Peak = ۱٫۰). پس تبدیل به Int16 اجباری است.
 */

const INT16_MAX = 32767;
const INT16_MIN = -32768;

/** آستانه‌ی شروع اشباع نرم: −۱ دسی‌بل فول‌اسکیل */
const LIMIT_THRESHOLD = 0.891251;
const LIMIT_RANGE = 1 - LIMIT_THRESHOLD;

/**
 * محدودکننده‌ی نرم (soft limiter). زیر −۱dBFS هیچ اثری روی سیگنال ندارد.
 * جلوی کلیپ سخت روی باس میکس (دوبله + صدای اصلی) را می‌گیرد؛
 * کلیپ سخت در ورودی انکودر یکی از منابع واقعی «خش‌خش» است.
 */
export function softLimitInPlace(samples) {
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    if (!Number.isFinite(value)) {
      samples[i] = 0;
      continue;
    }
    const magnitude = value < 0 ? -value : value;
    if (magnitude <= LIMIT_THRESHOLD) continue;
    const over = (magnitude - LIMIT_THRESHOLD) / LIMIT_RANGE;
    const shaped = LIMIT_THRESHOLD + LIMIT_RANGE * Math.tanh(over);
    samples[i] = value < 0 ? -shaped : shaped;
  }
  return samples;
}

/**
 * تبدیل Float32 (بازه‌ی −۱..۱) به Int16 با کلمپ متقارن.
 * بدون dither: هیچ نویز اضافه‌ای به سیگنال تزریق نمی‌شود.
 */
export function floatToInt16(samples, target) {
  const out = target && target.length >= samples.length
    ? target.subarray(0, samples.length)
    : new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    if (!Number.isFinite(value)) {
      out[i] = 0;
      continue;
    }
    const scaled = Math.round(value * INT16_MAX);
    out[i] = scaled > INT16_MAX ? INT16_MAX : scaled < INT16_MIN ? INT16_MIN : scaled;
  }
  return out;
}

/**
 * خواننده‌ی جریان بایتی PCM 16-bit little-endian.
 *
 * چرا لازم است: تکه‌های صوتی مدل می‌توانند طول بایتی فرد داشته باشند.
 * نسخه‌ی قبلی بایت آخر را دور می‌انداخت و از آن لحظه به بعد کل جریان
 * یک بایت جابه‌جا خوانده می‌شد — نتیجه‌اش دقیقاً نویز سفید بلند است.
 * این کلاس بایت باقی‌مانده را به تکه‌ی بعدی منتقل می‌کند.
 */
export class Int16StreamReader {
  constructor() {
    this.carry = -1;
  }

  /** @param {Uint8Array} bytes @returns {Float32Array} */
  push(bytes) {
    if (!bytes || !bytes.byteLength) return new Float32Array(0);

    const hasCarry = this.carry >= 0;
    const total = bytes.byteLength + (hasCarry ? 1 : 0);
    const frames = total >> 1;
    const leftover = total & 1;

    const out = new Float32Array(frames);
    let index = 0;
    let cursor = 0;

    if (hasCarry && frames > 0) {
      out[index] = (((this.carry | (bytes[0] << 8)) << 16) >> 16) / 32768;
      index += 1;
      cursor = 1;
    }

    for (; index < frames; index += 1) {
      const low = bytes[cursor];
      const high = bytes[cursor + 1];
      cursor += 2;
      out[index] = (((low | (high << 8)) << 16) >> 16) / 32768;
    }

    this.carry = leftover ? bytes[bytes.byteLength - 1] : -1;
    return out;
  }

  reset() {
    this.carry = -1;
  }
}
