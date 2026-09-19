/**
 * پیدا کردن زیرنویس واقعیِ خودِ سایت.
 *
 * سه لایه، از دقیق به عمومی:
 *
 *   ۱) فهرست زیرنویس خودِ پخش‌کننده  (خانوادهٔ یوتیوب: `getPlayerResponse()`)
 *   ۲) رَدِ شبکه‌ای صفحه — `performance.getEntriesByType("resource")`
 *      همان درخواست‌هایی را که *خود صفحه* قبلاً زده لیست می‌کند. اگر پخش‌کننده
 *      فایل زیرنویسی گرفته باشد، نشانی‌اش همان‌جاست. پس هیچ‌جا هوک نمی‌گذاریم،
 *      `fetch` صفحه را دستکاری نمی‌کنیم و برای هر سایت کد جدا نمی‌نویسیم؛ فقط
 *      یک API استاندارد را می‌خوانیم. فایل هم در کش مرورگر است، پس گرفتنش
 *      رایگان است.
 *   ۳) عنصر‌های <track> و `video.textTracks` — این لایه در `src/overlay/stage.js`
 *      انجام می‌شود، چون آنجا خودِ DOM و پارسر WebVTT مرورگر در دسترس است.
 *
 * تابع `readCaptionTrack` عیناً با `chrome.scripting.executeScript` به دنیای
 * MAIN تزریق می‌شود، پس باید کاملاً خودبسنده باشد: هیچ import و هیچ متغیر
 * بیرونی. فقط می‌خواند و برمی‌گرداند؛ چیزی در صفحه نمی‌نویسد.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

/**
 * @param {string} preferredLang کد زبان مبدأ دلخواه، یا "auto"
 * @returns {Promise<{ok: boolean, text?: string, format?: string, lang?: string,
 *   label?: string, method?: string, videoId?: string, duration?: number, reason?: string}>}
 */
export async function readCaptionTrack(preferredLang) {
  const wanted = String(preferredLang || "auto").toLowerCase().split("-")[0];

  const identity = () => {
    const url = new URL(location.href);
    const id = url.searchParams.get("v")
      || (/\/(embed|shorts|live)\/([\w-]{6,})/.exec(url.pathname)?.[2] ?? "")
      || (/\/(?:video|videos|v)\/([\w-]{4,})/.exec(url.pathname)?.[1] ?? "");
    const media = document.querySelector("video");
    return { videoId: id, duration: Number(media?.duration) || 0 };
  };

  const score = (code, name, isAuto) => {
    const base = String(code || "").toLowerCase().split("-")[0];
    let value = 0;
    if (wanted !== "auto" && base === wanted) value += 100;
    if (wanted === "auto" && base === "en") value += 40;
    if (!isAuto) value += 25;                            // دست‌نویس بهتر از خودکار
    if (/^\w+$/.test(String(name || ""))) value += 1;
    return value;
  };

  /* ── لایهٔ ۱: فهرست زیرنویس خودِ پخش‌کننده ───────────────────────── */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * پخش‌کننده در نخستین لحظه‌ها آماده نیست.
   *
   * این همان چیزی بود که باعث می‌شد ویدئویی که *زیرنویس دارد* بگوید «ندارد»:
   * `getPlayerResponse` هنوز وجود نداشت، یا وجود داشت ولی `captionTracks`
   * داخلش خالی بود. پس تا چند صد میلی‌ثانیه منتظر می‌مانیم — این انتظار
   * داخل خودِ صفحه است و هیچ درخواست شبکه‌ای ندارد.
   */
  const waitForCaptionList = async () => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const player = document.querySelector("#movie_player, .html5-video-player");
      let response = null;
      try {
        response = player?.getPlayerResponse?.() ?? null;
      } catch {
        response = null;
      }
      response = response || globalThis.ytInitialPlayerResponse || null;
      const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length) return { player, tracks };
      // ماژول زیرنویس پخش‌کننده را وادار به بارگذاری می‌کنیم؛ همین باعث
      // می‌شود درخواست timedtext زده شود و لایهٔ ردِ شبکه‌ای آن را ببیند.
      if (attempt === 6) {
        try {
          player?.loadModule?.("captions");
        } catch {}
      }
      await sleep(attempt < 6 ? 120 : 250);
    }
    return { player: document.querySelector("#movie_player, .html5-video-player"), tracks: null };
  };

  const fromPlayer = async () => {
    const { tracks: waited } = await waitForCaptionList();
    const tracks = waited;
    if (!Array.isArray(tracks) || !tracks.length) return null;

    const best = tracks
      .map((track) => ({
        url: String(track.baseUrl || ""),
        lang: String(track.languageCode || ""),
        label: String(track.name?.simpleText || track.name?.runs?.[0]?.text || track.languageCode || ""),
        auto: String(track.kind || "") === "asr",
        rank: score(track.languageCode, track.name?.simpleText, String(track.kind || "") === "asr")
      }))
      .filter((track) => track.url)
      .sort((a, b) => b.rank - a.rank)[0];
    if (!best) return null;

    // json3 خروجی تمیزتری از XML دارد: زمان‌ها عددی‌اند و متن قطعه‌قطعه نیست
    const url = new URL(best.url, location.href);
    url.searchParams.set("fmt", "json3");
    const answer = await fetch(url.toString(), { credentials: "same-origin" });
    if (!answer.ok) return null;
    const text = await answer.text();
    if (!text.trim()) return null;
    return { text, format: "json3", lang: best.lang, label: best.label, method: "player" };
  };

  /* ── لایهٔ ۲: ردِ شبکه‌ای خودِ صفحه ──────────────────────────────── */
  const fromNetworkTrace = async () => {
    let entries = [];
    try {
      entries = performance.getEntriesByType("resource") ?? [];
    } catch {
      return null;
    }

    const looksLikeSubtitle = /(\.vtt|\.srt|\.ttml|\.dfxp|timedtext|\/subtitle|\/subtitles|\/captions?\/|caption=|subtitles=)/i;
    const candidates = entries
      .map((entry) => String(entry.name || ""))
      .filter((name) => looksLikeSubtitle.test(name) && !/\.(m3u8|mpd|ts|mp4|m4s|webm|js|css|png|jpe?g|woff2?)(\?|$)/i.test(name))
      .reverse()                                          // تازه‌ترین اول
      .slice(0, 12);

    const langOf = (name) => {
      const hit = /[?&](?:lang|language|hl|locale)=([a-z]{2,3})(?:[-_][a-z]{2,4})?/i.exec(name)
        || /[/_.-]([a-z]{2})(?:[-_][a-z]{2,4})?\.(?:vtt|srt|ttml)/i.exec(name);
      return hit ? hit[1].toLowerCase() : "";
    };

    const ordered = candidates.sort((a, b) => score(langOf(b), "", false) - score(langOf(a), "", false));
    for (const name of ordered) {
      try {
        const answer = await fetch(name, { credentials: "same-origin" });
        if (!answer.ok) continue;
        const text = await answer.text();
        if (!/-->|"events"|<p\b/i.test(text)) continue;
        return { text, format: "auto", lang: langOf(name), label: "", method: "trace" };
      } catch {
        // منبع دیگری را امتحان می‌کنیم
      }
    }
    return null;
  };

  try {
    const found = (await fromPlayer()) || (await fromNetworkTrace());
    if (!found) {
      // «پخش‌کننده هست ولی فهرست خالی است» با «هنوز آماده نیست» یکی نیست:
      // اولی یعنی ویدئو واقعاً زیرنویس ندارد، دومی یعنی باید دوباره پرسید.
      const player = document.querySelector("#movie_player, .html5-video-player");
      const media = document.querySelector("video");
      const ready = Boolean(player) && Number(media?.readyState) > 0;
      return { ok: false, reason: ready ? "no-track" : "not-ready", ...identity() };
    }
    return { ok: true, ...found, ...identity() };
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) };
  }
}

/**
 * کلید هویت ویدئو برای حافظهٔ ترجمه.
 * پارامترهای بی‌ربط (زمان شروع، کد ارجاع، …) حذف می‌شوند تا یک ویدئو با
 * چند نشانی مختلف، یک کلید بگیرد.
 */
export function sourceKey(url, videoId) {
  const id = String(videoId ?? "").trim();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (id) return `${host}:${id}`;
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return id ? `local:${id}` : "local:unknown";
  }
}

/**
 * دکمهٔ زیرنویس خودِ پخش‌کننده را روشن یا خاموش می‌کند.
 *
 * **چرا لازم است:** یوتیوب فهرست زیرنویس (`captionTracks`) را تا وقتی کاربر
 * CC را روشن نکند نمی‌سازد. تا پیش از این یعنی «این ویدئو زیرنویس ندارد»،
 * حتی وقتی داشت. پس خودمان یک لحظه روشنش می‌کنیم، فایل زیرنویس را می‌گیریم و
 * بلافاصله به حالت قبل برمی‌گردانیم.
 *
 * دو راه، به ترتیب:
 *   ۱) کلیک روی همان دکمهٔ `.ytp-subtitles-button` — دقیقاً کاری که خودِ
 *      کاربر می‌کند، پس مطمئن‌ترین است.
 *   ۲) `setOption("captions", "track", …)` از API خودِ پخش‌کننده، اگر دکمه
 *      نبود یا اثر نکرد.
 *
 * وضعیت پیشین برگردانده می‌شود تا **فقط چیزی که ما عوض کردیم** برگردد: اگر
 * کاربر خودش CC را روشن گذاشته بود، روشن می‌ماند.
 *
 * مثل `readCaptionTrack` این تابع هم عیناً به دنیای MAIN تزریق می‌شود، پس
 * باید خودبسنده باشد.
 *
 * @param {boolean} on
 * @returns {Promise<{ok: boolean, was: boolean, now: boolean, changed: boolean, how: string}>}
 */
export async function setCaptionsEnabled(on) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const player = document.querySelector("#movie_player, .html5-video-player");
  const button = document.querySelector(".ytp-subtitles-button");

  const isOn = () => {
    try {
      const track = player?.getOption?.("captions", "track");
      if (track && Object.keys(track).length > 0) return true;
    } catch {}
    return button?.getAttribute("aria-pressed") === "true";
  };

  const was = isOn();
  if (Boolean(on) === was) return { ok: true, was, now: was, changed: false, how: "noop" };

  // ۱) همان دکمه‌ای که کاربر می‌زند
  try {
    if (button && !button.hasAttribute("disabled") && button.getAttribute("aria-disabled") !== "true") {
      button.click();
      await sleep(220);
      if (isOn() === Boolean(on)) return { ok: true, was, now: Boolean(on), changed: true, how: "button" };
    }
  } catch {}

  // ۲) API خودِ پخش‌کننده
  try {
    player?.loadModule?.("captions");
    await sleep(150);
    if (on) {
      const list = player?.getOption?.("captions", "tracklist") ?? [];
      const wanted = Array.isArray(list) ? list.find((item) => item?.languageCode) : null;
      player?.setOption?.("captions", "track", wanted ? { languageCode: wanted.languageCode } : {});
    } else {
      player?.setOption?.("captions", "track", {});
    }
    await sleep(150);
    if (isOn() === Boolean(on)) return { ok: true, was, now: Boolean(on), changed: true, how: "api" };
  } catch {}

  const now = isOn();
  return { ok: now === Boolean(on), was, now, changed: now !== was, how: "failed" };
}
