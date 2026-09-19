/**
 * صحنهٔ زیرنویس روی خودِ ویدئو.
 *
 * چهار تصمیم معماری:
 *
 *  ۱) **یک div ساده با Shadow DOM باز.** تمام ظاهر داخل ریشهٔ سایه‌ای است، پس
 *     CSS سایت به ما نمی‌رسد و CSS ما به سایت نمی‌رسد و یک `!important` هم
 *     لازم نیست. عمداً از عنصر سفارشی (`customElements`) و از
 *     `adoptedStyleSheets` استفاده *نمی‌شود*: هر دو در دنیای جداشدهٔ اسکریپت
 *     محتوا شکننده‌اند — ورقهٔ سبک ساخته‌شده در این دنیا را کروم برای
 *     `adoptedStyleSheets` رد می‌کند و استثنا می‌دهد. ورقه به‌صورت یک عنصر
 *     `<style>` داخل ریشهٔ سایه‌ای می‌نشیند که همه‌جا کار می‌کند.
 *
 *  ۲) **بدون حلقهٔ نظارت.** موقعیت ویدئو با `ResizeObserver` و
 *     `IntersectionObserver` و رویداد `fullscreenchange` دنبال می‌شود، نه با
 *     `setInterval`.
 *
 *  ۳) **هایلایت کارائوکه با Custom Highlight API.** بخش گفته‌شده با
 *     `CSS.highlights` و یک `Range` رنگ می‌شود، نه با شکستن متن به ده‌ها
 *     `<span>`. اگر مرورگر این API را نداشت، به دو گرهٔ متنی برمی‌گردیم.
 *
 *  ۴) **یک خط، نه دو خط.** فقط ترجمه نشان داده می‌شود. جعبهٔ دومِ متن اصلی
 *     حذف شد: فضای زیادی از تصویر می‌گرفت و کاربردی نداشت. متن مبدأ همچنان
 *     در فایل زیرنویس اختیاری ذخیره می‌شود.
 *
 *  ۵) **بومی‌سازی راست‌چین.** متن با جهت درست و با تکه‌های لاتینِ جداشده از
 *     سرویس‌ورکر می‌رسد (`src/bidi.js`), پس یک جملهٔ فارسی که وسطش
 *     «Windows 11» دارد به‌هم نمی‌ریزد.
 *
 *  ۶) **همگام با خط زمانی خودِ ویدئو.** در حالت «زیرنویس سایت» کیوها از
 *     `video.currentTime` خوانده می‌شوند، پس جلو و عقب رفتن، توقف و تغییر
 *     سرعت پخش همه درست کار می‌کنند.
 *
 * هر مرحلهٔ راه‌اندازی داخل `try` است و نتیجه‌اش در `report` ثبت می‌شود. پیام
 * `dp-stage-diagnose` همان گزارش را برمی‌گرداند، پس اگر چیزی دیده نشد، پاپ‌آپ
 * می‌گوید *کدام* مرحله شکسته — نه اینکه در سکوت هیچ‌چیز نشان ندهد.
 *
 * این اسکریپت فقط با کلیک کاربر و از راه `activeTab` تزریق می‌شود؛ در مانیفست
 * هیچ `content_scripts` و هیچ دسترسی دائمی ثبت نشده است.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
"use strict";

(() => {
  if (globalThis.__dobleParsiStage) {
    globalThis.__dobleParsiStage.revive();
    return;
  }

  const SNAP_X = [8, 50, 92];
  const SNAP_Y = [16, 50, 88];
  const SNAP_TOLERANCE = 4.5;
  const LIVE_IDLE_MS = 2600;
  const CONTRAST_EVERY_MS = 900;
  const RTL = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0780-\u07bf\ufb50-\ufdff\ufe70-\ufeff]/;

  /** گزارش تشخیص؛ هر چیزی که ممکن است شکسته باشد اینجا ثبت می‌شود */
  const report = {
    frame: (() => {
      try {
        return window.top === window ? "top" : "iframe";
      } catch {
        return "iframe";
      }
    })(),
    url: location.href.slice(0, 120),
    cssBytes: 0,
    shadow: false,
    mounted: false,
    hasVideo: false,
    videoBox: null,
    mode: "idle",
    cues: 0,
    visibleText: "",
    karaoke: "none",
    contrast: "idle",
    error: ""
  };

  const state = {
    enabled: true,
    theme: "aurora",
    scale: 0.042,
    width: 78,
    x: 50,
    y: 88,
    karaoke: true,
    autoContrast: true,
    showOriginal: false,     // متن زبان اصلی به‌جای ترجمه
    plate: "",               // رنگ دلخواه پلاک، خالی = رنگ قالب
    spoken: "",              // رنگ دلخواه بخش گفته‌شده
    mode: "idle",            // idle | track | live
    demo: false,             // کیوی آزمایشی است، نه زیرنویس واقعی
    cues: [],
    index: -1,
    liveDub: "",
    liveDir: "",
    liveAt: 0,
    contrastAt: 0,
    contrastBlocked: false,
    videoKey: "",            // اثر انگشت ویدئوی جاری
    keyCheckedAt: 0
  };

  /* ── ساختن صحنه ─────────────────────────────────────────────────── */

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.dobleParsi = "stage";

  // خط دفاعی: حتی اگر ورقهٔ سبک به هر دلیلی نرسد، میزبان سر جای خودش است
  const CRITICAL = {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: "100%",
    height: "100%",
    margin: "0px",
    padding: "0px",
    border: "0px",
    display: "block",
    pointerEvents: "none",
    zIndex: "2147483000"
  };
  for (const [name, value] of Object.entries(CRITICAL)) host.style.setProperty(...toCssProperty(name, value));

  function toCssProperty(name, value) {
    return [name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value];
  }

  // Shadow DOM باز است، نه بسته: جداسازی سبک دقیقاً یکی است، ولی در DevTools
  // دیده می‌شود و عیب‌یابی ممکن می‌ماند.
  const root = host.attachShadow({ mode: "open" });
  report.shadow = true;

  const css = String(globalThis.__dobleParsiStageCss ?? "");
  report.cssBytes = css.length;
  const style = document.createElement("style");
  style.textContent = css;
  root.append(style);

  const make = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };

  const stage = make("div", "stage");
  const rail = make("div", "rail");
  rail.dataset.idle = "1";

  const dub = make("p", "line dub");
  dub.setAttribute("dir", "auto");
  const dubText = document.createTextNode("");
  dub.append(dubText);

  rail.append(dub);

  const grip = make("div", "grip");
  const snap = make("div", "snap");

  const badge = make("div", "badge");
  const badgeDot = make("span", "dot");
  const badgeLabel = document.createTextNode("");
  badge.append(badgeDot, badgeLabel);

  stage.append(snap, rail, grip, badge);
  root.append(stage);

  /* ── هایلایت کارائوکه ───────────────────────────────────────────── */

  const Highlighter = globalThis.Highlight;
  const registry = globalThis.CSS?.highlights;
  let highlight = null;
  try {
    if (typeof Highlighter === "function" && registry) {
      highlight = new Highlighter();
      registry.set("dp-spoken", highlight);
      report.karaoke = "highlight-api";
    }
  } catch {
    highlight = null;
  }
  if (!highlight) report.karaoke = "text-nodes";

  let fallbackMark = null;
  let paintedCut = -1;

  /** @param {number} chars تعداد کاراکترهایی که تا این لحظه گفته شده */
  function paintKaraoke(chars) {
    const total = dubText.data.length + (fallbackMark?.firstChild.data.length ?? 0);
    const cut = Math.max(0, Math.min(total, Math.round(chars)));
    if (cut === paintedCut) return;
    paintedCut = cut;

    if (highlight) {
      highlight.clear();
      if (cut > 0) {
        const range = document.createRange();
        range.setStart(dubText, 0);
        range.setEnd(dubText, Math.min(cut, dubText.data.length));
        highlight.add(range);
      }
      return;
    }

    // مسیر جانشین: دو گرهٔ متنی، بدون innerHTML
    if (!fallbackMark) {
      fallbackMark = make("span", "mark");
      fallbackMark.append(document.createTextNode(""));
      dub.prepend(fallbackMark);
    }
    const full = fallbackMark.firstChild.data + dubText.data;
    fallbackMark.firstChild.data = full.slice(0, cut);
    dubText.data = full.slice(cut);
  }

  function clearKaraoke() {
    if (paintedCut === 0) return;
    paintedCut = 0;
    if (highlight) {
      if (highlight.size) highlight.clear();
      return;
    }
    if (fallbackMark) {
      dubText.data = fallbackMark.firstChild.data + dubText.data;
      fallbackMark.firstChild.data = "";
    }
  }

  /* ── نوشتن متن ──────────────────────────────────────────────────── */

  /**
   * @param {string} value متن آمادهٔ نمایش (جداسازهای دوسویه از قبل داخلش است)
   * @param {"rtl"|"ltr"|""} [dir] اگر نیامد، از نخستین حرف قوی تشخیص داده می‌شود
   */
  function writeDub(value, dir) {
    const text = String(value ?? "");
    const current = fallbackMark ? fallbackMark.firstChild.data + dubText.data : dubText.data;
    if (current === text) return false;
    clearKaraoke();
    paintedCut = -1;
    dubText.data = text;
    dub.setAttribute("dir", dir || (RTL.test(text.slice(0, 24)) ? "rtl" : "ltr"));
    report.visibleText = text.slice(0, 60);
    return true;
  }

  /** ورود نرم هر جمله، با Web Animations API */
  function animateIn(node) {
    try {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      node.animate(
        [
          { opacity: 0, transform: "translateY(0.35em) scale(0.985)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    } catch {
      // انیمیشن تجملی است؛ نبودش نباید متن را از بین ببرد
    }
  }

  let badgeTimer = 0;
  function showBadge(info) {
    if (!info?.text) {
      badge.dataset.on = "0";
      return;
    }
    badgeLabel.data = info.text;
    badge.dataset.kind = info.kind ?? "track";
    badge.dataset.on = "1";
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => { badge.dataset.on = "0"; }, 4200);
  }

  /* ── پیدا کردن و دنبال کردن ویدئو ───────────────────────────────── */

  let video = null;
  const resizeObserver = new ResizeObserver(() => layout());
  const visibilityObserver = new IntersectionObserver(() => layout(), { threshold: [0, 0.01, 1] });

  function candidateScore(node) {
    const box = node.getBoundingClientRect();
    if (box.width < 100 || box.height < 60) return -1;
    const area = box.width * box.height;
    return area + (node.paused ? 0 : area * 0.5) + (node.readyState > 0 ? 1000 : 0);
  }

  function pickVideo() {
    let best = null;
    let bestScore = 0;
    for (const node of document.querySelectorAll("video")) {
      const score = candidateScore(node);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  }

  function attachVideo(next) {
    if (next === video) return;
    if (video) {
      resizeObserver.unobserve(video);
      visibilityObserver.unobserve(video);
    }
    video = next ?? null;
    report.hasVideo = Boolean(video);
    if (video) {
      resizeObserver.observe(video);
      visibilityObserver.observe(video);
      layout();
    }
  }

  /** جعبهٔ صحنه را روی جعبهٔ ویدئو می‌نشاند */
  function layout() {
    if (!video) return;
    const box = video.getBoundingClientRect();
    report.videoBox = [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)];
    stage.style.setProperty("--dp-box-x", `${Math.round(box.left)}px`);
    stage.style.setProperty("--dp-box-y", `${Math.round(box.top)}px`);
    stage.style.setProperty("--dp-box-w", `${Math.round(box.width)}px`);
    stage.style.setProperty("--dp-box-h", `${Math.round(box.height)}px`);
    host.style.setProperty("--dp-video-h", `${Math.max(180, Math.round(box.height))}px`);
  }

  /* ── تشخیص عوض‌شدن ویدئو ─────────────────────────────────────────── */

  /**
   * اثر انگشت ویدئوی درحال‌پخش.
   *
   * در یوتیوب رفتن به ویدئوی بعدی صفحه را بارگذاری نمی‌کند: نشانی با
   * `pushState` عوض می‌شود، همان عنصر `<video>` باقی می‌ماند و اسکریپت محتوا
   * زنده است. پس کیوهای ویدئوی قبلی روی ویدئوی تازه می‌ماندند. برای همین
   * خودِ صحنه باید بفهمد، نه سرویس‌ورکر که ممکن است خوابیده باشد.
   *
   * چهار نشانهٔ مستقل کنار هم گذاشته می‌شوند تا یکی‌شان که جا ماند بقیه بگیرند:
   *   • شناسهٔ ویدئو در نشانی (یا مسیر صفحه)
   *   • عنوان صفحه، پس از پاک‌کردن شمارندهٔ اعلان («(۳) …») و نام سرویس
   *   • `currentSrc` که در پخش‌کننده‌های MSE برای هر ویدئو تازه است
   *   • مدت ویدئو، گرد‌شده به ثانیه
   *
   * خطای مثبتِ کاذب بی‌خطر است: همان ویدئو دوباره از حافظهٔ ترجمه می‌آید،
   * بی‌درخواست و بی‌هزینه.
   */
  function cleanTitle(value) {
    return String(value ?? "")
      .replace(/^\(\s*[\d\u06f0-\u06f9]+\s*\)\s*/u, "")   // شمارندهٔ اعلان
      .replace(/\s+[-|–—·]\s+[^-|–—·]{1,24}$/u, "")           // «… - YouTube»
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function videoKey() {
    let id = "";
    let host = "";
    try {
      const url = new URL(location.href);
      host = url.hostname;
      id = url.searchParams.get("v") || url.pathname;
    } catch {
      id = String(location.href).slice(0, 120);
    }
    const heading = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const title = cleanTitle(heading || document.title);
    const src = String(video?.currentSrc ?? "");
    const seconds = Number.isFinite(video?.duration) ? Math.round(video.duration) : 0;
    return `${host}|${id}|${title}|${src}|${seconds}`;
  }

  /**
   * اگر ویدئو عوض شده باشد، زیرنویس قبلی همان لحظه برداشته می‌شود و
   * سرویس‌ورکر خبردار می‌شود تا کیوهای کهنه‌اش را دور بریزد و — اگر کاربر
   * «ادامهٔ خودکار» را روشن گذاشته باشد — ویدئوی تازه را بگیرد.
   */
  function checkVideoChanged({ announce = true } = {}) {
    const key = videoKey();
    if (!key || key === state.videoKey) return false;
    const first = state.videoKey === "";
    state.videoKey = key;
    if (first) return false;

    const had = state.cues.length > 0 || state.mode !== "idle";
    state.mode = "idle";
    state.demo = false;
    state.cues = [];
    state.index = -1;
    state.liveDub = "";
    state.liveDir = "";
    writeDub("");
    rail.dataset.idle = "1";
    showBadge(null);
    report.cues = 0;

    if (announce && had) {
      chrome.runtime.sendMessage({ type: "dp-stage-video-changed", key }).catch(() => {});
    }
    return true;
  }

  /**
   * میزبان به `body` می‌رود، نه به `documentElement`.
   * در تمام‌صفحه هرچه بیرون از عنصر تمام‌صفحه باشد رندر نمی‌شود، پس صحنه را
   * همان‌جا میزبان می‌کنیم.
   */
  function mount() {
    const parent = document.fullscreenElement ?? document.body ?? document.documentElement;
    if (parent && host.parentNode !== parent) {
      parent.append(host);
      report.mounted = host.isConnected;
    }
  }

  function revive() {
    mount();
    attachVideo(pickVideo() ?? video);
    layout();
  }

  const rescan = (() => {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        mount();
        attachVideo(pickVideo() ?? video);
        checkVideoChanged();
      }, 220);
    };
  })();

  new MutationObserver(rescan).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("resize", layout, { passive: true });
  addEventListener("scroll", layout, { passive: true, capture: true });
  document.addEventListener("fullscreenchange", () => {
    mount();
    layout();
  });

  // بارگذاری مدیای تازه: نشانهٔ صریح خودِ پلتفرم برای «محتوای دیگر»
  for (const type of ["emptied", "loadstart", "loadedmetadata", "durationchange"]) {
    document.addEventListener(type, (event) => {
      if (event.target?.tagName === "VIDEO") checkVideoChanged();
    }, { capture: true, passive: true });
  }

  // ناوبری تک‌صفحه‌ای: Navigation API تازه‌ترین راه است، دو رویداد قدیمی
  // به‌عنوان پشتیبان می‌مانند
  globalThis.navigation?.addEventListener?.("navigate", () => setTimeout(checkVideoChanged, 60));
  addEventListener("popstate", () => setTimeout(checkVideoChanged, 60));
  addEventListener("hashchange", () => setTimeout(checkVideoChanged, 60));

  // و یک بررسی ارزان در حلقهٔ رندر، برای پخش‌کننده‌هایی که هیچ‌کدام را
  // نمی‌فرستند (فقط ساختن و مقایسهٔ یک رشته، هر ۴۰۰ میلی‌ثانیه)
  const KEY_CHECK_MS = 400;

  /* ── تشخیص خودکار روشنایی صحنه ──────────────────────────────────── */

  const probe = document.createElement("canvas");
  probe.width = 24;
  probe.height = 8;
  const probeContext = probe.getContext("2d", { willReadFrequently: true });

  function updateContrast(now) {
    if (!state.autoContrast || state.contrastBlocked || !video || !probeContext) return;
    if (now - state.contrastAt < CONTRAST_EVERY_MS) return;
    state.contrastAt = now;
    if (!video.videoWidth || video.readyState < 2) return;

    // فقط نواری از فریم که پشت زیرنویس است نمونه‌برداری می‌شود
    const bandHeight = Math.max(8, Math.round(video.videoHeight * 0.16));
    const bandTop = Math.min(
      video.videoHeight - bandHeight,
      Math.max(0, Math.round((state.y / 100) * video.videoHeight - bandHeight))
    );
    try {
      probeContext.drawImage(
        video,
        Math.round(video.videoWidth * 0.12), bandTop,
        Math.round(video.videoWidth * 0.76), bandHeight,
        0, 0, probe.width, probe.height
      );
      const { data } = probeContext.getImageData(0, 0, probe.width, probe.height);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      const mean = sum / (data.length / 4);
      stage.dataset.plate = mean > 168 ? "light" : "dark";
      report.contrast = stage.dataset.plate;
    } catch {
      // ویدئوی cross-origin بوم را آلوده می‌کند و خواندن پیکسل ممنوع می‌شود
      state.contrastBlocked = true;
      report.contrast = "blocked";
      delete stage.dataset.plate;
    }
  }

  /* ── موتور نمایش ────────────────────────────────────────────────── */

  function findCue(atMs) {
    const cues = state.cues;
    if (!cues.length) return -1;
    let low = 0;
    let high = cues.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const cue = cues[middle];
      if (atMs < cue.start) high = middle - 1;
      else if (atMs > cue.end) low = middle + 1;
      else return middle;
    }
    return -1;
  }

  /**
   * ترجمه یا متن اصلی؟
   * اگر کاربر سوییچ زبان اصلی را زده باشد و آن کیو متن مبدأ داشته باشد، همان
   * نشان داده می‌شود؛ وگرنه به ترجمه برمی‌گردیم تا خط هرگز خالی نماند.
   */
  function pick(cue) {
    if (!cue) return { text: "", dir: "" };
    if (state.showOriginal && cue.source) {
      return { text: cue.sourceDisplay ?? cue.source, dir: cue.sourceDir ?? "" };
    }
    return { text: cue.display ?? cue.text, dir: cue.dir };
  }

  function renderTrack(now) {
    const atMs = (video?.currentTime ?? 0) * 1000;
    const index = findCue(atMs);

    if (index !== state.index) {
      state.index = index;
      const cue = index >= 0 ? state.cues[index] : null;
      const shown = pick(cue);
      const changed = writeDub(shown.text, shown.dir);
      rail.dataset.idle = cue ? "0" : "1";
      if (cue && changed) animateIn(dub);
    }

    if (index >= 0 && state.karaoke && !state.showOriginal) {
      const cue = state.cues[index];
      const span = Math.max(1, cue.end - cue.start);
      const progress = Math.max(0, Math.min(1, (atMs - cue.start) / span));
      paintKaraoke(dubText.data.length * progress);
    } else if (index >= 0) {
      clearKaraoke();
    }

    updateContrast(now);
  }

  function renderLive(now) {
    const fresh = now - state.liveAt < LIVE_IDLE_MS;
    const changed = writeDub(fresh ? state.liveDub : "", state.liveDir);
    rail.dataset.idle = fresh && state.liveDub ? "0" : "1";
    if (changed && fresh) animateIn(dub);
    clearKaraoke();
    updateContrast(now);
  }

  let frame = 0;
  function loop(now) {
    frame = requestAnimationFrame(loop);
    try {
      if (!state.enabled || !video) {
        rail.dataset.idle = "1";
        return;
      }
      if (now - state.keyCheckedAt >= KEY_CHECK_MS) {
        state.keyCheckedAt = now;
        if (checkVideoChanged()) return;
      }
      if (state.mode === "track") renderTrack(now);
      else if (state.mode === "live") renderLive(now);
      else rail.dataset.idle = "1";
    } catch (error) {
      // یک فریم خراب نباید حلقه را برای همیشه بکشد
      report.error = String(error?.message ?? error).slice(0, 160);
    }
  }

  /* ── جابه‌جایی با کشیدن، با چسبیدن به لنگرها ─────────────────────── */

  grip.addEventListener("pointerdown", (event) => {
    if (!video) return;
    const box = video.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = state.x;
    const originY = state.y;
    grip.dataset.dragging = "1";
    grip.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (moveEvent) => {
      const x = originX + ((moveEvent.clientX - startX) / box.width) * 100;
      const y = originY + ((moveEvent.clientY - startY) / box.height) * 100;
      apply({ x: Math.max(4, Math.min(96, x)), y: Math.max(8, Math.min(98, y)) });
      const near = SNAP_X.some((value) => Math.abs(state.x - value) < SNAP_TOLERANCE)
        || SNAP_Y.some((value) => Math.abs(state.y - value) < SNAP_TOLERANCE);
      snap.dataset.on = near ? "1" : "0";
    };

    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      delete grip.dataset.dragging;
      snap.dataset.on = "0";

      const snapped = (value, anchors) => {
        const best = anchors.find((anchor) => Math.abs(value - anchor) < SNAP_TOLERANCE);
        return best ?? Math.round(value * 10) / 10;
      };
      apply({ x: snapped(state.x, SNAP_X), y: snapped(state.y, SNAP_Y) });
      chrome.runtime.sendMessage({
        type: "dp-stage-position",
        position: { x: state.x, y: state.y }
      }).catch(() => {});
    };

    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  });

  /* ── اعمال تنظیمات ──────────────────────────────────────────────── */

  function apply(patch) {
    const before = state.showOriginal;
    Object.assign(state, patch);
    host.style.setProperty("--dp-scale", String(state.scale));
    host.style.setProperty("--dp-width", `${state.width}%`);
    host.style.setProperty("--dp-x", `${state.x}%`);
    host.style.setProperty("--dp-y", `${state.y}%`);
    stage.dataset.theme = state.theme;

    // رشتهٔ خالی یعنی متغیر برداشته شود تا رنگ خودِ قالب برگردد
    if (state.plate) host.style.setProperty("--dp-plate-user", state.plate);
    else host.style.removeProperty("--dp-plate-user");
    if (state.spoken) host.style.setProperty("--dp-spoken-user", state.spoken);
    else host.style.removeProperty("--dp-spoken-user");

    if (!state.autoContrast) delete stage.dataset.plate;

    // سوییچ زبان اصلی باید همان لحظه دیده شود، نه در کیوی بعدی
    if (before !== state.showOriginal) state.index = -1;
    host.style.setProperty("visibility", state.enabled ? "visible" : "hidden");
  }

  /* ── لایهٔ سوم کشف زیرنویس: TextTrack خودِ مرورگر ─────────────────── */

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * زیرنویس را از `video.textTracks` می‌خواند.
   * `mode = "hidden"` باعث می‌شود مرورگر فایل WebVTT را با پارسر خودش بخواند و
   * کیوها را بسازد، بدون آنکه روی ویدئو نمایش دهد.
   */
  async function collectTextTrack(preferredLang) {
    const media = pickVideo() ?? video;
    if (!media?.textTracks?.length) return { ok: false, reason: "no-track" };

    const wanted = String(preferredLang || "auto").toLowerCase().split("-")[0];
    const tracks = [...media.textTracks].filter((track) => ["subtitles", "captions"].includes(track.kind));
    if (!tracks.length) return { ok: false, reason: "no-track" };

    const ranked = tracks
      .map((track) => {
        const base = String(track.language || "").toLowerCase().split("-")[0];
        let rank = 0;
        if (wanted !== "auto" && base === wanted) rank += 100;
        if (wanted === "auto" && base === "en") rank += 40;
        if (track.mode === "showing") rank += 30;
        if (track.cues?.length) rank += 20;
        return { track, rank };
      })
      .sort((a, b) => b.rank - a.rank);

    for (const { track } of ranked) {
      const previous = track.mode;
      if (track.mode === "disabled") track.mode = "hidden";
      for (let attempt = 0; attempt < 12 && !track.cues?.length; attempt += 1) await wait(150);
      const list = [...(track.cues ?? [])];
      if (previous === "disabled" && track.mode === "hidden") track.mode = "disabled";
      if (!list.length) continue;
      return {
        ok: true,
        method: "texttrack",
        lang: String(track.language || ""),
        label: String(track.label || ""),
        duration: Number(media.duration) || 0,
        cues: list.map((cue) => ({
          start: Math.round(cue.startTime * 1000),
          end: Math.round(cue.endTime * 1000),
          text: String(cue.text ?? "")
        }))
      };
    }
    return { ok: false, reason: "no-track" };
  }

  /* ── گزارش تشخیص ────────────────────────────────────────────────── */

  function diagnose() {
    mount();
    attachVideo(pickVideo() ?? video);
    let painted = null;
    try {
      const box = rail.getBoundingClientRect();
      painted = [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)];
    } catch {}
    return {
      ...report,
      mode: state.mode,
      cues: state.cues.length,
      mounted: host.isConnected,
      hasVideo: Boolean(video),
      enabled: state.enabled,
      theme: state.theme,
      railBox: painted,
      hostVisibility: host.style.getPropertyValue("visibility") || "visible"
    };
  }

  /* ── پیام‌ها ─────────────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    const type = message?.type;

    if (type === "dp-stage-config") {
      apply(message.config ?? {});
      mount();
      attachVideo(pickVideo() ?? video);
      respond({ ok: true, hasVideo: Boolean(video), frame: report.frame });
      return false;
    }

    if (type === "dp-stage-cues") {
      state.mode = "track";
      state.demo = false;
      state.cues = Array.isArray(message.cues) ? message.cues : [];
      state.index = -1;
      report.cues = state.cues.length;
      showBadge(message.badge);
      mount();
      attachVideo(pickVideo() ?? video);
      respond({ ok: true, count: state.cues.length, hasVideo: Boolean(video) });
      return false;
    }

    if (type === "dp-stage-live") {
      // زیرنویس واقعی سایت اولویت دارد و جایش را به متن زنده نمی‌دهد،
      // ولی کیوی آزمایشی باید کنار برود، وگرنه بعد از «تست نمایش» متن
      // دوبلهٔ زنده دیگر دیده نمی‌شد.
      if (state.mode !== "track" || state.demo) {
        if (state.demo) {
          state.demo = false;
          state.cues = [];
          state.index = -1;
        }
        state.mode = "live";
      }
      state.liveDub = String(message.dub ?? state.liveDub);
      state.liveDir = String(message.dir ?? state.liveDir ?? "");
      state.liveAt = performance.now();
      if (message.badge) showBadge(message.badge);
      respond({ ok: true });
      return false;
    }

    if (type === "dp-stage-collect") {
      // فقط فریمی که ویدئو دارد جواب می‌دهد، وگرنه در صفحه‌های چندفریمی
      // یک فریم بی‌ویدئو زودتر «نداریم» می‌گوید و کشف را خراب می‌کند
      if (!(pickVideo() ?? video)) return false;
      collectTextTrack(message.sourceLang)
        .then((result) => respond(result))
        .catch((error) => respond({ ok: false, reason: String(error?.message ?? error) }));
      return true;
    }

    if (type === "dp-stage-diagnose") {
      if (report.frame === "iframe" && !(pickVideo() ?? video)) return false;
      respond({ ok: true, ...diagnose() });
      return false;
    }

    if (type === "dp-stage-clear") {
      state.mode = "idle";
      state.demo = false;
      state.cues = [];
      state.index = -1;
      state.liveDub = "";
      state.liveDir = "";
      writeDub("");
      rail.dataset.idle = "1";
      showBadge(null);
      respond({ ok: true });
      return false;
    }

    return false;
  });

  /* ── راه‌اندازی ─────────────────────────────────────────────────── */

  try {
    apply({});
    mount();
    attachVideo(pickVideo());
    checkVideoChanged({ announce: false });
    frame = requestAnimationFrame(loop);
  } catch (error) {
    report.error = String(error?.message ?? error).slice(0, 160);
  }

  globalThis.__dobleParsiStage = {
    revive,
    diagnose,
    stop() {
      cancelAnimationFrame(frame);
      host.remove();
    }
  };
})();
