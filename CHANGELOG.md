# Changelog

All notable changes to **Doble Parsi** are documented here, in English first and
Persian second. This project follows [Semantic Versioning](https://semver.org).
Every release must update this file, both READMEs, `.github/release-notes.md`,
`manifest.json` and `package.json` with the same version.

---

## [1.0.0] — 2026-08-28

First public release.

### Added

- **Live tab dubbing** — the active tab's audio is captured, translated in real time and played back as a dub within a couple of seconds.
- **Original speaker's voice** — the live translation model reproduces the speaker's voice, so no voice option is exposed.
- **31 dubbing languages** — Persian by default, plus 30 more in one dropdown.
- **MP3 export** — dub only or dub mixed with the original, at 96 / 128 / 192 kbps, encoded off the main thread.
- **SRT / VTT subtitles** — built from the live transcript with sentence-aware cues, overlap repair and an adjustable delay offset (default 1200 ms).
- **Source-language subtitles** — an optional second file holding the original speech.
- **Video-accurate file names** — the real title is read from media metadata, `og:title`, the player heading, the video element and finally the tab title, then cleaned of notification counters, site brands and trailing junk.
- **Tidy download layout** — `Downloads/Doble Parsi/<video name>/` per session, with the final path forced during the browser's filename event.
- **Live session panel** — dub and source captions, cue counter, audio meter, timer and a `REC` toolbar badge.
- **Bilingual interface** — Persian (RTL) and English (LTR) with instant switching, Persian digits and the Vazirmatn font bundled offline.
- **Automatic ducking** — the original track drops while the dub speaks and eases back afterwards.
- **Session resilience** — queued audio before the socket is ready, automatic reconnect with session resumption, and a clean stop that still saves outputs when the tab closes.

### Fixed

- **Manifest load warning** — the `author` key was a plain string, which Chrome rejects as an invalid value on load. Authorship now lives in `package.json`, the README and the popup footer.
- **Click-free audio path** — dub audio plays from a continuous ring buffer instead of one buffer per chunk, and both directions use a windowed-sinc resampler, removing the clicks and the aliasing of per-chunk playback.
- **White-noise recordings** — the encoder is fed limited, explicitly converted 16-bit samples, and an odd trailing byte in a stream chunk is carried into the next chunk instead of being dropped.
- **Silent MP3 with live playback off** — the recording tap now sits before the playback gain.
- **Swallowed encoder errors** — encoder failures surface as localised messages instead of being ignored.

### Changed

- **Repository layout** — icons and the font moved to `assets/`, worklets and the encoder moved under `src/`, and build, lint and test tooling was added with zero runtime dependencies.
- **Localised manifest** — the name, short name, description and toolbar tooltip come from `_locales/en` and `_locales/fa`.
- **Automated releases** — tagging `v*.*.*` builds the ZIP, writes SHA-256 checksums, optionally signs a `.crx` and publishes a release whose body is read from `.github/release-notes.md`.

---

<div dir="rtl">

## [<span dir="ltr">1.0.0</span>] — ۶ شهریور ۱۴۰۵

نخستین انتشار عمومی.

### افزوده شد

- **دوبلهٔ زندهٔ تب** — صدای تب فعال گرفته می‌شود، همان لحظه ترجمه می‌شود و با چند ثانیه تأخیر به‌صورت دوبله پخش می‌شود.
- **صدای گویندهٔ اصلی** — مدل ترجمهٔ زنده صدای گوینده را بازسازی می‌کند، پس گزینهٔ انتخاب صدا ارائه نشده است.
- **۳۱ زبان دوبله** — فارسی پیش‌فرض، به‌همراه ۳۰ زبان دیگر در یک فهرست.
- **خروجی <span dir="ltr">MP3</span>** — فقط دوبله یا میکس با صدای اصلی، با کیفیت <span dir="ltr">96 / 128 / 192 kbps</span> و انکود بیرون از ترد اصلی.
- **زیرنویس <span dir="ltr">SRT / VTT</span>** — از متن زنده ساخته می‌شود، با کیوهای جمله‌شناس، اصلاح همپوشانی و جبران تأخیر قابل تنظیم (پیش‌فرض <span dir="ltr">1200 ms</span>).
- **زیرنویس زبان اصلی** — یک فایل دوم اختیاری با متن گفتار اصلی.
- **نام فایل دقیقاً مثل ویدئو** — نام واقعی از متادیتای مدیا، <span dir="ltr">`og:title`</span>، تیتر پخش‌کننده، عنصر ویدئو و در آخر عنوان تب خوانده می‌شود و از شمارندهٔ اعلان، نام سرویس و دنبالهٔ بی‌مصرف پاک می‌شود.
- **چیدمان مرتب دانلود** — برای هر جلسه <span dir="ltr">`Downloads/Doble Parsi/<video name>/`</span>، با تحمیل مسیر نهایی در رویداد نام‌گذاری مرورگر.
- **پنل جلسهٔ زنده** — متن دوبله و متن اصلی، شمارندهٔ کیو، سنجهٔ صدا، زمان‌شمار و برچسب <span dir="ltr">`REC`</span> روی آیکون.
- **رابط دوزبانه** — فارسی (راست‌چین) و انگلیسی (چپ‌چین) با جابه‌جایی فوری، اعداد فارسی و فونت وزیرمتن به‌صورت آفلاین.
- **کم‌کردن خودکار صدای اصلی** — صدای اصلی هنگام حرف‌زدن دوبله پایین می‌آید و بعد نرم برمی‌گردد.
- **مقاومت جلسه** — صف‌کردن صدا پیش از آماده‌شدن سوکت، اتصال مجدد خودکار با ادامهٔ جلسه، و پایان تمیز که با بسته‌شدن تب هم خروجی‌ها را ذخیره می‌کند.

### اصلاح شد

- **هشدار بارگذاری مانیفست** — کلید <span dir="ltr">`author`</span> رشتهٔ ساده بود و کروم آن را مقدار نامعتبر می‌داند. نام سازنده حالا در <span dir="ltr">`package.json`</span>، <span dir="ltr">README</span> و پاصفحهٔ پاپ‌آپ است.
- **مسیر صوتی بدون تِرَق** — صدای دوبله از یک بافر حلقه‌ای پیوسته پخش می‌شود، نه یک بافر برای هر تکه، و هر دو جهت از بازنمونه‌بردار <span dir="ltr">sinc</span> پنجره‌ای استفاده می‌کنند.
- **ضبط نویز سفید** — به انکودر نمونهٔ محدودشده و صریحاً ۱۶ بیتی داده می‌شود و بایت فردِ آخر هر تکه به تکهٔ بعدی منتقل می‌شود، نه دور ریخته.
- **سکوت <span dir="ltr">MP3</span> با پخش زندهٔ خاموش** — تپ ضبط حالا قبل از بهرهٔ پخش قرار دارد.
- **خطاهای بلعیده‌شدهٔ انکودر** — خرابی انکودر به‌صورت پیام بومی‌شده نشان داده می‌شود، نه نادیده‌گرفته.

### تغییر کرد

- **ساختار مخزن** — آیکون‌ها و فونت به <span dir="ltr">`assets/`</span>، ورکلت‌ها و انکودر به زیر <span dir="ltr">`src/`</span> منتقل شدند و ابزار بیلد، لینت و تست بدون هیچ وابستگی اجرایی اضافه شد.
- **مانیفست بومی‌شده** — نام، نام کوتاه، توضیح و راهنمای دکمه از <span dir="ltr">`_locales/en`</span> و <span dir="ltr">`_locales/fa`</span> خوانده می‌شوند.
- **انتشار خودکار** — تگ‌زدن <span dir="ltr">`v*.*.*`</span> بستهٔ <span dir="ltr">ZIP</span> را می‌سازد، چک‌سام <span dir="ltr">SHA-256</span> می‌نویسد، در صورت وجود کلید فایل <span dir="ltr">`.crx`</span> را امضا می‌کند و ریلیزی می‌سازد که بدنه‌اش از <span dir="ltr">`.github/release-notes.md`</span> خوانده می‌شود.

</div>

[1.0.0]: https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.0.0
