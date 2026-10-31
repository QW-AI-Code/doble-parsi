/**
 * دکمهٔ میانبر روی پخش‌کنندهٔ یوتیوب + مینی‌پنل.
 *
 * یک دکمه کنار چرخ‌دندهٔ یوتیوب می‌نشیند و پنل کوچکی باز می‌کند با:
 *   شروع/توقف دوبله · نمایش/پنهان‌کردن زیرنویس · ولوم صدای اصلی · ولوم دوبله
 * تا کاربر هر بار مجبور نباشد پاپ‌آپ افزونه را باز کند.
 *
 * فقط روی www.youtube.com بارگذاری می‌شود (تنها content_script مانیفست).
 * اسکریپت کلاسیک است، نه ماژول؛ پس import/export ندارد. همهٔ کارها را
 * سرویس‌ورکر انجام می‌دهد و این فایل فقط رابط است: پیام می‌فرستد و وضعیت می‌خواند.
 * ظاهر پنل داخل Shadow DOM است تا CSS یوتیوب به آن نرسد.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
"use strict";

(() => {
  if (globalThis.__dobleParsiMini) return;
  globalThis.__dobleParsiMini = true;

  const POLL_MS = 1500;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const TEXT = {
    fa: {
      title: "دوبله پارسی",
      tip: "دوبله پارسی — پنل سریع",
      dubStart: "شروع دوبله",
      dubStop: "توقف دوبله",
      subStart: "نمایش زیرنویس",
      subStop: "پنهان‌کردن زیرنویس",
      original: "صدای اصلی ویدئو",
      dub: "صدای دوبله",
      mute: "قطع",
      unmute: "وصل",
      working: "در حال انجام…",
      live: "در حال دوبله",
      failed: "انجام نشد. دوباره تلاش کن.",
      gone: "افزونه به‌روز شد؛ صفحه را یک بار تازه کن."
    },
    en: {
      title: "Doble Parsi",
      tip: "Doble Parsi — quick panel",
      dubStart: "Start dubbing",
      dubStop: "Stop dubbing",
      subStart: "Show subtitles",
      subStop: "Hide subtitles",
      original: "Original video audio",
      dub: "Dub voice",
      mute: "Mute",
      unmute: "Unmute",
      working: "Working…",
      live: "Dubbing",
      failed: "That did not work. Try again.",
      gone: "The extension was updated; reload this page once."
    }
  };

  const CSS = `
    :host { all: initial; }
    .panel {
      position: absolute; right: 12px; bottom: 64px; z-index: 2147483000;
      width: 270px; max-width: calc(100% - 24px); box-sizing: border-box;
      padding: 12px; border-radius: 14px;
      background: rgba(18, 20, 30, 0.94); color: #f3f4f8;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.55);
      font: 13px/1.5 system-ui, "Segoe UI", Tahoma, sans-serif;
      display: flex; flex-direction: column; gap: 10px;
    }
    .panel[hidden] { display: none; }
    .panel[dir="rtl"] { font-family: Vazirmatn, Tahoma, system-ui, sans-serif; }
    h2 { margin: 0; font-size: 13px; font-weight: 700; opacity: 0.9; }
    .btns { display: flex; flex-direction: column; gap: 7px; }
    button {
      all: unset; box-sizing: border-box; cursor: pointer; text-align: center;
      padding: 8px 10px; border-radius: 10px; font-weight: 600;
      background: linear-gradient(100deg, #2b4fd8, #5b3fd1); color: #fff;
    }
    button.sub { background: linear-gradient(100deg, #064E3B, #115E59); }
    button.is-on { filter: saturate(0.6) brightness(0.8); outline: 1px solid rgba(255,255,255,.35); }
    button:hover { filter: brightness(1.12); }
    button:disabled { opacity: 0.5; cursor: default; }
    button:focus-visible, input:focus-visible { outline: 2px solid #8fb0ff; outline-offset: 2px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .out { font-variant-numeric: tabular-nums; opacity: 0.8; }
    .row { display: flex; align-items: center; gap: 8px; }
    input[type="range"] { flex: 1; min-width: 0; accent-color: #7aa2ff; cursor: pointer; }
    button.chip { padding: 3px 9px; font-size: 12px; background: rgba(255,255,255,.14); }
    button.chip.is-on { background: rgba(239, 68, 68, .55); filter: none; }
    .note { min-height: 16px; margin: 0; font-size: 12px; opacity: 0.85; }
    .note.err { color: #ffb4b4; opacity: 1; }
  `;


  const ICON_DATA = "data:image/png;base64,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";

  let lang = "fa";
  let remote = null;           // آخرین وضعیت سرویس‌ورکر
  let busy = false;
  let pollTimer = null;
  let sendTimer = null;
  let mutedFrom = 1;
  let button = null;
  let dot = null;
  let host = null;
  let refs = null;

  const tr = (key) => (TEXT[lang] ?? TEXT.fa)[key];

  function alive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  async function ask(message) {
    if (!alive()) return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return null;
    }
  }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (name === "class") node.className = value;
      else if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    }
    for (const child of children) node.append(child);
    return node;
  }

  const percent = (value) => `${Math.round(Number(value) * 100)}%`;

  /* ── ساخت پنل ─────────────────────────────────────────────────── */

  function buildPanel() {
    host = document.createElement("div");
    host.dataset.dobleParsi = "mini";
    // موقعیت را خود میزبان می‌گیرد؛ داخل پخش‌کننده می‌نشیند تا در تمام‌صفحه هم دیده شود
    Object.assign(host.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "2147483000" });
    const root = host.attachShadow({ mode: "open" });
    root.append(el("style", { text: CSS }));

    const panel = el("div", { class: "panel", role: "dialog" });
    panel.hidden = true;
    panel.style.pointerEvents = "auto";

    const title = el("h2");
    const dubBtn = el("button", { type: "button" });
    const subBtn = el("button", { type: "button", class: "sub" });

    const originalOut = el("span", { class: "out" });
    const originalLabel = el("span");
    const originalRange = el("input", { type: "range", min: "0", max: "1", step: "0.01" });
    const muteBtn = el("button", { type: "button", class: "chip" });

    const dubOut = el("span", { class: "out" });
    const dubLabel = el("span");
    const dubRange = el("input", { type: "range", min: "0", max: "1.5", step: "0.01" });

    const note = el("p", { class: "note" });

    panel.append(
      title,
      el("div", { class: "btns" }, dubBtn, subBtn),
      el("div", { class: "field" },
        el("div", { class: "head" }, originalLabel, originalOut),
        el("div", { class: "row" }, originalRange, muteBtn)),
      el("div", { class: "field" },
        el("div", { class: "head" }, dubLabel, dubOut),
        el("div", { class: "row" }, dubRange)),
      note
    );
    root.append(panel);

    // کلیدها و کلیک‌های پنل به میانبرهای یوتیوب و پخش/توقف نرسند
    for (const type of ["keydown", "keyup", "keypress", "click", "dblclick", "mousedown", "pointerdown", "wheel", "contextmenu"]) {
      panel.addEventListener(type, (event) => event.stopPropagation());
    }

    refs = { root, panel, title, dubBtn, subBtn, originalOut, originalLabel, originalRange, muteBtn, dubOut, dubLabel, dubRange, note };

    dubBtn.addEventListener("click", () => act(dubRunning() ? "dp-mini-stop" : "dp-mini-start"));
    subBtn.addEventListener("click", () => act("dp-mini-stage", { on: !subRunning() }));

    originalRange.addEventListener("input", () => volumeInput());
    dubRange.addEventListener("input", () => volumeInput());
    muteBtn.addEventListener("click", () => {
      const current = Number(originalRange.value);
      if (current > 0) {
        mutedFrom = current;
        originalRange.value = "0";
      } else {
        originalRange.value = String(mutedFrom || 1);
      }
      volumeInput();
    });

    return host;
  }

  const dubRunning = () => remote?.phase === "live" || remote?.phase === "starting";
  const subRunning = () => remote?.stagePhase === "track" || remote?.stagePhase === "live" || remote?.stagePhase === "working";

  function paint() {
    if (!refs) return;
    const { dubBtn, subBtn, title, originalLabel, dubLabel, originalRange, dubRange, originalOut, dubOut, muteBtn } = refs;
    refs.panel.dir = lang === "fa" ? "rtl" : "ltr";
    title.textContent = tr("title");
    originalLabel.textContent = tr("original");
    dubLabel.textContent = tr("dub");

    const transitional = remote?.phase === "starting" || remote?.phase === "stopping";
    dubBtn.textContent = dubRunning() ? tr("dubStop") : tr("dubStart");
    dubBtn.classList.toggle("is-on", dubRunning());
    dubBtn.disabled = busy || transitional;
    subBtn.textContent = subRunning() ? tr("subStop") : tr("subStart");
    subBtn.classList.toggle("is-on", subRunning());
    subBtn.disabled = busy || remote?.stagePhase === "working";

    // وسط کشیدن لغزنده، مقدار از سرویس‌ورکر روی آن نمی‌نشیند
    const dragging = refs.root.activeElement;
    if (remote && dragging !== originalRange && Number.isFinite(remote.originalVolume)) {
      originalRange.value = String(remote.originalVolume);
    }
    if (remote && dragging !== dubRange && Number.isFinite(remote.dubVolume)) {
      dubRange.value = String(remote.dubVolume);
    }
    originalOut.textContent = percent(originalRange.value);
    dubOut.textContent = percent(dubRange.value);
    const muted = Number(originalRange.value) === 0;
    muteBtn.textContent = muted ? tr("unmute") : tr("mute");
    muteBtn.classList.toggle("is-on", muted);

    if (button) button.title = tr("tip");
    if (dot) dot.style.display = dubRunning() ? "block" : "none";
  }

  function setNote(text, isError = false) {
    if (!refs) return;
    refs.note.textContent = text ?? "";
    refs.note.classList.toggle("err", Boolean(isError));
  }

  /* ── کنش‌ها ───────────────────────────────────────────────────── */

  function adopt(answer) {
    if (!answer) return;
    remote = answer;
    if (answer.uiLang === "fa" || answer.uiLang === "en") lang = answer.uiLang;
  }

  async function act(type, extra = {}) {
    if (busy) return;
    busy = true;
    setNote(tr("working"));
    paint();
    const answer = await ask({ type, ...extra });
    busy = false;
    if (!answer) setNote(alive() ? tr("failed") : tr("gone"), true);
    else {
      adopt(answer);
      setNote(answer.ok === false ? (answer.errorText || tr("failed")) : "", answer.ok === false);
    }
    paint();
  }

  function volumeInput() {
    refs.originalOut.textContent = percent(refs.originalRange.value);
    refs.dubOut.textContent = percent(refs.dubRange.value);
    refs.muteBtn.textContent = Number(refs.originalRange.value) === 0 ? tr("unmute") : tr("mute");
    refs.muteBtn.classList.toggle("is-on", Number(refs.originalRange.value) === 0);
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
      ask({
        type: "dp-mini-volume",
        originalVolume: Number(refs.originalRange.value),
        dubVolume: Number(refs.dubRange.value)
      });
    }, 40);
  }

  async function refresh() {
    const answer = await ask({ type: "dp-mini-get" });
    if (!answer?.ok) {
      if (!alive()) stop();
      return;
    }
    adopt(answer);
    if (!busy) {
      const err = answer.phase === "idle" ? answer.error : null;
      if (!err) setNote(answer.phase === "live" ? tr("live") : "");
    }
    paint();
  }

  function openPanel(open) {
    if (!refs) return;
    refs.panel.hidden = !open;
    button?.setAttribute("aria-expanded", String(open));
    clearInterval(pollTimer);
    if (open) {
      refresh();
      pollTimer = setInterval(refresh, POLL_MS);
    }
  }

  /* ── جای‌گذاری روی پخش‌کننده ─────────────────────────────────── */

  function makeButton() {
    // دقیقاً همان آیکون رنگی افزونه (assets/icons/icon48.png)، داخل فایل گذاشته شده تا
    // به web_accessible_resources و مجوز تازه‌ای نیاز نباشد
    const img = document.createElement("img");
    img.src = ICON_DATA;
    img.alt = "";
    img.draggable = false;
    img.style.cssText = "display:block;width:28px;height:28px;border-radius:6px;pointer-events:none;";
    dot = document.createElement("span");
    dot.style.cssText = "display:none;position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:#22c55e;border:1.5px solid #000;pointer-events:none;";
    const svg = document.createElement("span");
    svg.style.cssText = "position:relative;display:block;width:28px;height:28px;";
    svg.append(img, dot);

    const node = document.createElement("button");
    node.className = "ytp-button dp-mini-btn";
    node.type = "button";
    node.title = tr("tip");
    node.setAttribute("aria-label", tr("tip"));
    node.setAttribute("aria-haspopup", "dialog");
    node.setAttribute("aria-expanded", "false");
    node.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:48px;min-width:40px;height:100%;background:none;border:0;padding:0;cursor:pointer;opacity:1;";
    node.append(svg);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      openPanel(refs.panel.hidden);
    });
    return node;
  }

  /** دکمه باید دقیقاً کنار چرخ‌دندهٔ فعلی باشد؛ اگر یوتیوب جابه‌جایش کرد، برمی‌گردد */
  function place() {
    const player = document.querySelector(".html5-video-player");
    const controls = player?.querySelector(".ytp-right-controls");
    if (!player || !controls) return false;
    if (!host) buildPanel();
    if (host.parentElement !== player) player.append(host);
    if (!button) button = makeButton();
    const gear = controls.querySelector(".ytp-settings-button");
    const slot = gear?.parentElement ?? controls;
    if (!button.isConnected || button.parentElement !== slot || button.nextElementSibling !== (gear ?? null)) {
      slot.insertBefore(button, gear ?? slot.firstChild);
    }
    return true;
  }

  function ensure() {
    if (!alive()) return stop();
    if (place()) paint();
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!alive()) return stop();
      place();
    });
  }

  const observer = new MutationObserver(schedule);

  function stop() {
    observer.disconnect();
    clearInterval(pollTimer);
    button?.remove();
    host?.remove();
  }

  // کلیک بیرون از پنل آن را می‌بندد
  document.addEventListener("click", (event) => {
    if (!refs || refs.panel.hidden) return;
    const path = event.composedPath();
    if (path.includes(host) || path.includes(button)) return;
    openPanel(false);
  }, true);

  document.addEventListener("fullscreenchange", schedule);
  document.addEventListener("yt-navigate-finish", schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  ask({ type: "dp-mini-get" }).then((answer) => {
    if (answer?.ok) adopt(answer);
    ensure();
  });
})();
