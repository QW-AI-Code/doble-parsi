/**
 * ورقهٔ سبک صحنهٔ زیرنویس.
 *
 * این CSS داخل یک Shadow DOM بسته و با «Constructable Stylesheet» سوار
 * می‌شود، پس:
 *   • هیچ قاعده‌ای به صفحه درز نمی‌کند و هیچ قاعده‌ای از صفحه به ما نمی‌رسد،
 *   • یک `!important` هم لازم نیست (روش رایج تزریق `<div>` به صفحه پر از
 *     `!important` است، چون با CSS سایت می‌جنگد؛ اینجا جنگی نیست)،
 *   • همان یک نمونهٔ ورقه بین همهٔ صحنه‌ها به اشتراک می‌رود.
 *
 * چون به‌جای فایل، رشته است، نیازی به `web_accessible_resources` نیست و
 * صفحه به هیچ منبعی از افزونه دسترسی پیدا نمی‌کند.
 *
 * این فایل به‌صورت اسکریپت کلاسیک تزریق می‌شود (اسکریپت محتوا ماژول نیست)،
 * پس روی `globalThis` دنیای جداشدهٔ افزونه می‌نشیند — نه روی صفحه.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
"use strict";

globalThis.__dobleParsiStageCss = String.raw`
:host {
  --dp-scale: 0.042;
  --dp-video-h: 480px;
  --dp-size: clamp(13px, calc(var(--dp-video-h) * var(--dp-scale)), 64px);
  --dp-width: 78%;
  --dp-x: 50%;
  --dp-y: 88%;
  --dp-ink: #ffffff;
  --dp-spoken: #7dd3fc;
  --dp-plate: rgba(6, 10, 22, 0.62);
  --dp-edge: rgba(255, 255, 255, 0.14);
  --dp-radius: 14px;
  --dp-pad: 0.42em 0.72em;
  --dp-shadow: 0 10px 34px rgba(0, 0, 0, 0.42);
  --dp-font: "Vazirmatn", "Vazir", "IRANSans", "Segoe UI", system-ui, Tahoma, sans-serif;

  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: block;
  pointer-events: none;
  contain: layout style;
}

:host([hidden]) { display: none; }

* { box-sizing: border-box; margin: 0; }

.stage {
  position: absolute;
  left: var(--dp-box-x, 0px);
  top: var(--dp-box-y, 0px);
  width: var(--dp-box-w, 100%);
  height: var(--dp-box-h, 100%);
  pointer-events: none;
  container-type: size;
}

/* ریل متن: نقطهٔ لنگر با درصد جابه‌جا می‌شود، پس در تمام‌صفحه هم سر جایش می‌ماند */
.rail {
  position: absolute;
  left: var(--dp-x);
  top: var(--dp-y);
  translate: -50% -100%;
  width: var(--dp-width);
  max-width: 96%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--dp-font);
  font-size: var(--dp-size);
  line-height: 1.42;
  text-align: center;
  text-wrap: balance;
  transition: opacity 180ms ease;
}

.rail[data-idle="1"] { opacity: 0; }

.line {
  margin: 0;
  color: var(--dp-ink);
  font-weight: 600;
  padding: var(--dp-pad);
  border-radius: var(--dp-radius);
  /* رنگ کاربر روی میزبان می‌نشیند و ارث می‌رسد؛ اگر تنظیم نشده باشد،
     مقداری که خودِ قالب روی همین عنصر گذاشته سر جایش می‌ماند. */
  background: var(--dp-plate-user, var(--dp-plate));
  box-shadow: var(--dp-shadow);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.line:empty { display: none; }

/* بخش گفته‌شدهٔ جمله. با Custom Highlight API رنگ می‌شود، پس متن به
   <span> تکه‌تکه نمی‌شود و انتخاب/کپی متن سالم می‌ماند. */
::highlight(dp-spoken) {
  color: var(--dp-spoken-user, var(--dp-spoken));
  text-shadow: 0 0 0.5em color-mix(in srgb, var(--dp-spoken-user, var(--dp-spoken)) 55%, transparent);
}

/* جایگزین برای مرورگرهایی که Highlight API ندارند */
.mark { color: var(--dp-spoken-user, var(--dp-spoken)); }

/* دستگیرهٔ جابه‌جایی: تنها چیزی که کلیک را می‌گیرد */
.grip {
  position: absolute;
  left: var(--dp-x);
  top: var(--dp-y);
  translate: -50% 0.3em;
  width: 3.4em;
  height: 0.34em;
  border-radius: 999px;
  background: var(--dp-ink);
  opacity: 0;
  pointer-events: auto;
  cursor: grab;
  transition: opacity 160ms ease, height 160ms ease;
}

:host(:hover) .grip { opacity: 0.34; }
.grip:hover { opacity: 0.8; height: 0.44em; }
.grip[data-dragging="1"] { cursor: grabbing; opacity: 0.9; }

/* راهنمای چسبیدن به لنگرهای نه‌گانه */
.snap {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 140ms ease;
  background:
    linear-gradient(to right, transparent calc(50% - 0.5px), var(--dp-edge) 50%, transparent calc(50% + 0.5px)),
    linear-gradient(to bottom, transparent calc(50% - 0.5px), var(--dp-edge) 50%, transparent calc(50% + 0.5px));
}
.snap[data-on="1"] { opacity: 1; }

/* نشان کوچک حالت: از کجا می‌آید و چند خط در کش هست */
.badge {
  position: absolute;
  inset-inline-end: 1.2em;
  top: 1em;
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3em 0.6em;
  border-radius: 999px;
  background: rgba(6, 10, 22, 0.66);
  border: 1px solid var(--dp-edge);
  color: #e8edfb;
  font-family: var(--dp-font);
  font-size: clamp(9px, calc(var(--dp-video-h) * 0.019), 13px);
  font-weight: 600;
  letter-spacing: 0.01em;
  opacity: 0;
  translate: 0 -0.4em;
  transition: opacity 220ms ease, translate 220ms ease;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.badge[data-on="1"] { opacity: 1; translate: 0 0; }
.badge .dot {
  width: 0.5em;
  height: 0.5em;
  border-radius: 50%;
  background: #34d399;
}
.badge[data-kind="memory"] .dot { background: #a78bfa; }
.badge[data-kind="live"] .dot { background: #fb7185; }

/* ═══════════════ قالب‌ها ═══════════════ */

/* شفق — شیشهٔ مات با هالهٔ رنگی که آرام می‌چرخد */
.stage[data-theme="aurora"] .line {
  --dp-plate: rgba(10, 14, 30, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.16);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  backdrop-filter: blur(16px) saturate(1.5);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
/* چرخش خودِ عنصر، نه یک متغیر ثبت‌شده با @property:
   ثبت متغیر سراسری است و داخل ورقهٔ سبک یک Shadow DOM نادیده گرفته می‌شود،
   پس انیمیشنِ متغیر عملاً هیچ کاری نمی‌کرد. */
.stage[data-theme="aurora"] .rail::before {
  content: "";
  position: absolute;
  inset: -40% -14%;
  border-radius: 999px;
  background: conic-gradient(from 0deg, #3b82f6, #8b5cf6, #22d3ee, #3b82f6);
  filter: blur(38px);
  opacity: 0.28;
  z-index: -1;
  animation: dp-drift 16s linear infinite;
}
@keyframes dp-drift {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* نئون — بی‌جعبه، متن با هالهٔ دولایه */
.stage[data-theme="neon"] .line {
  background: var(--dp-plate-user, none);
  box-shadow: none;
  padding: 0.1em 0.2em;
  font-weight: 800;
  letter-spacing: 0.006em;
  color: #f2f7ff;
  text-shadow:
    0 0 0.08em rgba(255, 255, 255, 0.9),
    0 0 0.5em rgba(56, 189, 248, 0.85),
    0 0 1.1em rgba(139, 92, 246, 0.7),
    0 2px 3px rgba(0, 0, 0, 0.7);
}
.stage[data-theme="neon"] { --dp-spoken: #fde68a; }

/* سینما — بدون جعبه، دورخط تیز. paint-order باعث می‌شود دورخط
   داخل حرف را نخورد؛ همان کاری که زیرنویس سینمایی می‌کند. */
.stage[data-theme="cinema"] .line {
  background: var(--dp-plate-user, none);
  box-shadow: none;
  padding: 0.06em 0.2em;
  font-weight: 700;
  color: #fffdf7;
  paint-order: stroke fill;
  -webkit-text-stroke: 0.085em rgba(0, 0, 0, 0.82);
  text-shadow: 0 0.06em 0.16em rgba(0, 0, 0, 0.55);
}
.stage[data-theme="cinema"] { --dp-spoken: #ffd479; }

/* روبان — نوار گرادیانی برند، هر خط جدا */
.stage[data-theme="ribbon"] .line {
  background: var(--dp-plate-user, linear-gradient(135deg, rgba(59, 130, 246, 0.94), rgba(139, 92, 246, 0.94)));
  border: none;
  border-radius: 4px 14px 4px 14px;
  padding: 0.34em 0.9em;
  font-weight: 700;
  color: #ffffff;
  box-shadow: 0 10px 26px rgba(59, 130, 246, 0.32);
}
.stage[data-theme="ribbon"] { --dp-spoken: #fff3b0; }

/* تخته — پلاک مات با نوار تأکید کناری، خواناترین حالت روی ویدئوی پرجزئیات */
.stage[data-theme="slate"] .line {
  background: var(--dp-plate-user, rgba(8, 12, 24, 0.9));
  border-inline-start: 0.18em solid #3b82f6;
  border-radius: 6px;
  padding: 0.4em 0.8em;
  font-weight: 600;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}
.stage[data-theme="slate"] { --dp-spoken: #93c5fd; }

/* کاغذ — تنها قالب روشن؛ برای مستند، اسلاید و ویدئوی پس‌زمینه‌سفید */
.stage[data-theme="paper"] {
  --dp-ink: #14181f;
  --dp-spoken: #b45309;
}
.stage[data-theme="paper"] .line {
  background: var(--dp-plate-user, rgba(252, 250, 245, 0.94));
  border: 1px solid rgba(20, 24, 31, 0.1);
  border-radius: 10px;
  font-weight: 600;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
}

/* تشخیص خودکار روشنایی: پلاک تیره روی صحنهٔ روشن و برعکس */
.stage[data-plate="light"][data-theme="aurora"] .line,
.stage[data-plate="light"][data-theme="slate"] .line {
  background: rgba(250, 250, 252, 0.9);
  color: #12161d;
  border-color: rgba(20, 24, 31, 0.12);
}
.stage[data-plate="light"][data-theme="cinema"] .line,
.stage[data-plate="light"][data-theme="neon"] .line {
  color: #0f1319;
  -webkit-text-stroke-color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 0 0.3em rgba(255, 255, 255, 0.9);
}

@media (prefers-reduced-motion: reduce) {
  .stage[data-theme="aurora"] .rail::before { animation: none; }
  .rail, .grip, .badge, .snap { transition: none; }
}
`;
