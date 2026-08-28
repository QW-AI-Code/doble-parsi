/**
 * بازنمونه‌بردار sinc پنجره‌ای (Kaiser) با حالت پیوسته بین تکه‌ها.
 *
 * چرا جای درون‌یابی خطی نسخه‌ی قبل را گرفت:
 *  ۱. پایین‌آوردن ۴۸k → ۱۶k با درون‌یابی خطی هیچ فیلتر ضدآلیاس ندارد؛
 *     هرچه بالای ۸ کیلوهرتز باشد تا کرده و روی گفتار می‌افتد و ورودی مدل را خراب می‌کند.
 *  ۲. بالا بردن ۲۴k → ۴۸k با درون‌یابی خطی تصویرهای فرکانسی (imaging) می‌سازد
 *     که همان زبری/خش شنیده‌شده روی صدای دوبله است.
 *  ۳. حالت پیوسته (history + موقعیت کسری) یعنی مرز تکه‌ها هیچ پرش نمونه‌ای ندارد.
 */

const LEFT = 15;                 // تعداد تپ سمت چپ
const RIGHT = 16;                // تعداد تپ سمت راست
const TAPS = LEFT + RIGHT + 1;   // ۳۲ تپ
const SUBPHASES = 512;           // دقت تاخیر کسری
const KAISER_BETA = 9.0;         // ≈ −۹۰dB کف نویز باند توقف
const CUTOFF_GUARD = 0.92;       // حاشیه‌ی باند گذر برای جلوگیری از آلیاس لبه

function besselI0(x) {
  let sum = 1;
  let term = 1;
  const half = x / 2;
  for (let k = 1; k < 32; k += 1) {
    term *= (half / k) * (half / k);
    sum += term;
    if (term < sum * 1e-16) break;
  }
  return sum;
}

function sinc(x) {
  if (x === 0) return 1;
  const pix = Math.PI * x;
  return Math.sin(pix) / pix;
}

const kernelCache = new Map();

function buildKernel(cutoff) {
  const key = cutoff.toFixed(6);
  const cached = kernelCache.get(key);
  if (cached) return cached;

  const table = new Float32Array(SUBPHASES * TAPS);
  const support = RIGHT;
  const norm = besselI0(KAISER_BETA);

  for (let phase = 0; phase < SUBPHASES; phase += 1) {
    const frac = phase / SUBPHASES;
    let sum = 0;
    const base = phase * TAPS;
    for (let tap = 0; tap < TAPS; tap += 1) {
      const offset = tap - LEFT - frac;      // فاصله از نقطه‌ی خوانش
      const ratio = offset / support;
      let weight = 0;
      if (ratio > -1 && ratio < 1) {
        weight = besselI0(KAISER_BETA * Math.sqrt(1 - ratio * ratio)) / norm;
      }
      const value = 2 * cutoff * sinc(2 * cutoff * offset) * weight;
      table[base + tap] = value;
      sum += value;
    }
    // نرمال‌سازی بهره‌ی DC روی هر زیرفاز: جلوی موج‌دار شدن سطح را می‌گیرد
    if (sum !== 0) {
      const scale = 1 / sum;
      for (let tap = 0; tap < TAPS; tap += 1) table[base + tap] *= scale;
    }
  }

  kernelCache.set(key, table);
  return table;
}

export class SincResampler {
  constructor(inputRate, outputRate) {
    this.inputRate = inputRate;
    this.outputRate = outputRate;
    this.ratio = inputRate / outputRate;
    // پایین‌آوردن نرخ ⇒ برش روی نایکوئیست مقصد؛ بالا بردن ⇒ برش روی نایکوئیست مبدأ
    const limit = this.ratio > 1 ? 0.5 / this.ratio : 0.5;
    this.kernel = buildKernel(limit * CUTOFF_GUARD);
    this.history = new Float32Array(LEFT);
    this.position = LEFT;
    this.passthrough = inputRate === outputRate;
  }

  get isPassthrough() {
    return this.passthrough;
  }

  /** @param {Float32Array} input @returns {Float32Array} */
  process(input) {
    if (this.passthrough) return input.slice();
    if (!input.length) return new Float32Array(0);

    const merged = new Float32Array(this.history.length + input.length);
    merged.set(this.history, 0);
    merged.set(input, this.history.length);

    const limit = merged.length - RIGHT;
    const estimate = Math.max(0, Math.ceil((limit - this.position) / this.ratio) + 1);
    const out = new Float32Array(estimate);

    const kernel = this.kernel;
    let position = this.position;
    let written = 0;

    while (position < limit && written < estimate) {
      const base = Math.floor(position);
      const frac = position - base;
      let phase = (frac * SUBPHASES) | 0;
      if (phase >= SUBPHASES) phase = SUBPHASES - 1;
      const offset = phase * TAPS;
      const start = base - LEFT;

      let acc = 0;
      for (let tap = 0; tap < TAPS; tap += 1) acc += kernel[offset + tap] * merged[start + tap];

      out[written] = acc;
      written += 1;
      position += this.ratio;
    }

    const consumed = Math.floor(position) - LEFT;
    this.history = merged.slice(consumed);
    this.position = position - consumed;

    return written === estimate ? out : out.subarray(0, written).slice();
  }

  /** تخلیه‌ی دنباله‌ی فیلتر در پایان جریان */
  flush() {
    if (this.passthrough) return new Float32Array(0);
    return this.process(new Float32Array(RIGHT + 1));
  }

  reset() {
    this.history = new Float32Array(LEFT);
    this.position = LEFT;
  }
}
