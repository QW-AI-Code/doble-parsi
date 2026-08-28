## Doble Parsi v1.0.0

**Dub the audio of any browser tab live with AI, then keep the MP3 and the SRT/VTT subtitles named exactly after the video.**

### Downloads

| File | What it is |
| --- | --- |
| `doble-parsi-1.0.0-chrome.zip` | Main extension package. Unzip it, then load it in Chrome/Edge via **Load unpacked**. |
| `doble-parsi-1.0.0.crx` | Signed package (optional). |

### Install in one minute

1. Download and unzip `doble-parsi-1.0.0-chrome.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.
5. Open the popup, paste your Gemini API key, choose a language, press **Start dubbing**.

Requires Chrome or Edge 116+.

### What's new

- **Live tab dubbing** — the active tab's audio is captured, translated as it plays and dubbed back within a couple of seconds.
- **The original speaker's voice** — the live translation model reproduces the speaker's own voice, so there is no voice setting to get wrong.
- **31 dubbing languages** — Persian by default, 30 more in one dropdown.
- **MP3 export** — dub only or dub mixed with the original, at 96 / 128 / 192 kbps.
- **SRT / VTT subtitles** — timed from the live transcript, with an adjustable delay offset and an optional second file in the source language.
- **Files named after the video** — the real title is read from the page, cleaned up and used for both the folder and the file names.
- **Tidy downloads** — every session lands in `Downloads/Doble Parsi/<video name>/`, and the `.srt` extension is never rewritten.
- **Bilingual interface** — Persian (RTL) and English (LTR), switching instantly, with the Vazirmatn font bundled so nothing loads from the internet.
- **Click-free audio path** — a ring-buffer player and windowed-sinc resampling replaced per-chunk playback, and the encoder now receives proper 16-bit samples, so recordings hold no crackle or white noise.
- **Warning-free load** — the invalid string `author` key was removed from the manifest, so `chrome://extensions` reports no warnings.
- **Self-healing sessions** — the socket reconnects and resumes on its own, and closing the tab still saves your files.

### Security audit

| Area | Result |
| --- | --- |
| Remote code | None. No CDN, no remote script, no `eval`. CSP is `script-src 'self' 'wasm-unsafe-eval'`. |
| Network destinations | Exactly one: the AI live endpoint declared in `host_permissions`. No analytics or telemetry. |
| API key handling | Stored locally with `chrome.storage.local`, sent only to that endpoint over TLS, never synced or logged. |
| Host access | No `<all_urls>`, no `tabs` permission, no content scripts. Page access via `activeTab` only, after you click the icon. |
| Injected script | One function, metadata only: it reads the video title and writes nothing. |
| File writes | Only through `chrome.downloads`. Paths are sanitised twice and `..` segments dropped, so writes stay inside the downloads folder. |
| Bundled encoder | A pre-built WebAssembly MP3 encoder under MPL-2.0, in a worker with no network access, receiving PCM only. |
| Third-party runtime dependencies | None. The build, lint and test tooling is plain Node.js. |
| Data retention | Nothing leaves your machine except the audio sent for translation. The session snapshot clears on browser restart. |
| Artifact integrity | Built by the release workflow and published with a SHA-256 checksum file. |

Full details: [README](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.md) · [CHANGELOG](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [SECURITY](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

---

<div dir="rtl">

## دوبله پارسی نسخهٔ <span dir="ltr">v1.0.0</span>

**صدای هر تب مرورگر را زنده و با هوش مصنوعی دوبله کن، بعد فایل <span dir="ltr">MP3</span> و زیرنویس <span dir="ltr">SRT/VTT</span> را دقیقاً هم‌نام همان ویدئو تحویل بگیر.**

### فایل‌های دانلود

| فایل | چیست |
| --- | --- |
| <span dir="ltr">`doble-parsi-1.0.0-chrome.zip`</span> | فایل اصلی اکستنشن. آن را دانلود و از حالت فشرده خارج کن، سپس در کروم با <span dir="ltr">**Load unpacked**</span> بارگذاری کن. |
| <span dir="ltr">`doble-parsi-1.0.0.crx`</span> | بستهٔ امضاشده (اختیاری). |

### نصب در یک دقیقه

۱. فایل <span dir="ltr">`doble-parsi-1.0.0-chrome.zip`</span> را دانلود و از حالت فشرده خارج کن.
۲. در مرورگر <span dir="ltr">`chrome://extensions`</span> (یا <span dir="ltr">`edge://extensions`</span>) را باز کن.
۳. گزینهٔ <span dir="ltr">**Developer mode**</span> را روشن کن.
۴. روی <span dir="ltr">**Load unpacked**</span> بزن و پوشهٔ خارج‌شده را انتخاب کن.
۵. پاپ‌آپ را باز کن، کلید <span dir="ltr">API</span> جِمینای را بچسبان، زبان را انتخاب کن و **شروع دوبله** را بزن.

به کروم یا اِج نسخهٔ ۱۱۶ و بالاتر نیاز دارد.

### تازه‌ها

- **دوبلهٔ زندهٔ تب** — صدای تب فعال گرفته می‌شود، همان لحظه ترجمه می‌شود و با چند ثانیه تأخیر دوبله پخش می‌شود.
- **صدای خودِ گویندهٔ اصلی** — مدل ترجمهٔ زنده صدای گوینده را بازسازی می‌کند، پس هیچ تنظیم صدایی نیست که اشتباه ست شود.
- **۳۱ زبان دوبله** — فارسی پیش‌فرض، ۳۰ زبان دیگر در یک فهرست.
- **خروجی <span dir="ltr">MP3</span>** — فقط دوبله یا میکس با صدای اصلی، با کیفیت <span dir="ltr">96 / 128 / 192 kbps</span>.
- **زیرنویس <span dir="ltr">SRT / VTT</span>** — از متن زندهٔ دوبله، با جبران تأخیر قابل تنظیم و یک فایل اختیاری به زبان اصلی.
- **نام فایل‌ها هم‌نام ویدئو** — نام واقعی از داخل صفحه خوانده، پاک‌سازی و برای نام پوشه و فایل‌ها استفاده می‌شود.
- **پوشهٔ دانلود مرتب** — هر جلسه در <span dir="ltr">`Downloads/Doble Parsi/<video name>/`</span> می‌نشیند و پسوند <span dir="ltr">`.srt`</span> دست‌نخورده می‌ماند.
- **رابط دوزبانه** — فارسی (راست‌چین) و انگلیسی (چپ‌چین) با جابه‌جایی فوری و فونت وزیرمتن همراه بسته، پس هیچ چیز از اینترنت گرفته نمی‌شود.
- **مسیر صوتی بدون تِرَق** — پخش‌کنندهٔ بافر حلقه‌ای و بازنمونه‌برداری <span dir="ltr">sinc</span> جای پخش تکه‌تکه را گرفت و انکودر نمونهٔ درست ۱۶ بیتی می‌گیرد، پس ضبط نه خش دارد و نه نویز سفید.
- **بارگذاری بدون هشدار** — کلید نامعتبر <span dir="ltr">`author`</span> از مانیفست حذف شد، پس <span dir="ltr">`chrome://extensions`</span> هیچ هشداری نشان نمی‌دهد.
- **جلسه‌های خودترمیم** — اتصال خودش برمی‌گردد و جلسه را ادامه می‌دهد، و بستن تب هم فایل‌ها را ذخیره می‌کند.

### خلاصهٔ ممیزی امنیتی

| بخش | نتیجه |
| --- | --- |
| کد راه دور | ندارد. نه <span dir="ltr">CDN</span>، نه اسکریپت بیرونی، نه <span dir="ltr">`eval`</span>. سیاست امنیتی <span dir="ltr">`script-src 'self' 'wasm-unsafe-eval'`</span> است. |
| مقصدهای شبکه | فقط یکی: همان سرویس هوش مصنوعی که در <span dir="ltr">`host_permissions`</span> اعلام شده. نه آنالیتیکس، نه تلمتری. |
| نگهداری کلید <span dir="ltr">API</span> | محلی در <span dir="ltr">`chrome.storage.local`</span>، فقط روی <span dir="ltr">TLS</span> به همان سرویس فرستاده می‌شود، بدون همگام‌سازی و بدون لاگ. |
| دسترسی به سایت‌ها | نه <span dir="ltr">`<all_urls>`</span>، نه دسترسی <span dir="ltr">`tabs`</span>، نه <span dir="ltr">content script</span>. دسترسی به صفحه فقط با <span dir="ltr">`activeTab`</span> و بعد از کلیک تو. |
| کد تزریق‌شده | یک تابع، فقط متادیتا: عنوان ویدئو را می‌خواند و چیزی نمی‌نویسد. |
| نوشتن فایل | فقط از راه <span dir="ltr">`chrome.downloads`</span>. مسیرها دو بار پاک‌سازی می‌شوند و بخش‌های <span dir="ltr">`..`</span> حذف می‌شوند، پس نوشتن داخل پوشهٔ دانلود می‌ماند. |
| انکودر همراه بسته | انکودر <span dir="ltr">MP3</span> از پیش ساخته‌شده با مجوز <span dir="ltr">MPL-2.0</span>، در ورکر بدون دسترسی شبکه، که فقط <span dir="ltr">PCM</span> می‌گیرد. |
| وابستگی‌های شخص ثالث | ندارد. ابزار بیلد، لینت و تست همه نود خالص است. |
| نگهداری داده | هیچ چیز از دستگاه تو بیرون نمی‌رود جز صدایی که برای ترجمه می‌رود. وضعیت جلسه با شروع مرورگر پاک می‌شود. |
| اصالت فایل‌ها | با ورک‌فلوی ریلیز ساخته و همراه فایل چک‌سام <span dir="ltr">SHA-256</span> منتشر می‌شوند. |

جزئیات کامل: [<span dir="ltr">README فارسی</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.fa.md) · [<span dir="ltr">CHANGELOG</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [<span dir="ltr">SECURITY</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

</div>
