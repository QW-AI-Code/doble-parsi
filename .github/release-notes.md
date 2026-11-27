## Doble Parsi v1.3.0

**Dub the audio of any browser tab live with AI, then keep the MP3 and the SRT/VTT subtitles named exactly after the video.**

### Downloads

| File | What it is |
| --- | --- |
| `doble-parsi-1.3.0-chrome.zip` | Main extension package. Unzip it, then load it in Chrome/Edge via **Load unpacked**. |
| `doble-parsi-1.3.0.crx` | Signed package (optional). |

### Install in one minute

1. Download and unzip `doble-parsi-1.3.0-chrome.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder. Updating from 1.2.0? Press the reload icon on the extension card instead.
5. Open the popup, paste your Gemini API key, choose a language, press **Start dubbing** or **Show subtitles on the video**.

Requires Chrome or Edge 116+.

### What's new in v1.3.0

| # | Reported problem | What changed |
| --- | --- | --- |
| 1 | The model list should be in *API key and language* | The *Subtitle translation model* list, the *Find the models that work on my key* button and its status now sit right under the API key and *Test the key and connection*. |
| 2 | *Show subtitles* usually showed nothing until *Find the models…* was pressed | The same model probe now runs **automatically** before the first translation, picks the thriftiest working model, remembers it for 12 hours per key, retries once with a fresh probe if a remembered model fails, and skips models whose free-tier quota is zero. |
| 3 | Subtitles could not be exported after closing the popup; the save button vanished | The subtitle state and cues survive the service worker going to sleep (`chrome.storage.session`). A **Save these subtitles** button was also added to the YouTube quick panel. |
| 4 | Saved subtitles were scrambled in PotPlayer and other players | Every right-to-left line in a saved SRT/VTT is wrapped in `RLM + RLE … PDF + RLM`, Latin words get `LRE … PDF`, punctuation stays at the correct end, and both formats start with a UTF-8 BOM. |

Also fixed while reviewing the project:

- The model label read "Text translation model" because the key was defined twice in the dictionary.
- A blank line inside a cue could end an SRT block early.
- *Start / Stop dubbing* in the popup stayed disabled if the worker did not answer.
- The Persian part of these release notes had an unclosed RTL block and an outdated model hint.
- 16 new unit tests; `npm run verify` (lint, 126 tests, build) passes.

### Earlier highlights

- **v1.2.0 — the original audio can be silenced completely.** A dedicated *Original video audio* volume (0–100 %, true silence at 0, plus a Mute button) now controls playback. A separate *Dub voice* volume (0–150 %) lifts a quiet dub.
- **v1.2.0 — main buttons moved to the top.** *Start dubbing* and *Show subtitles* sit right under the status bar, with a Volume card below them. No scrolling.
- **v1.2.0 — quick-panel button on the YouTube player.** A new button next to YouTube's gear opens a mini panel: Start/Stop dubbing, Show/Hide subtitles, original and dub volume. It needs one content script limited to `https://www.youtube.com/*`; no other permission was added.

- **Subtitles on the video itself** — the translation sits on the picture, in a Shadow DOM, so the site's CSS cannot reach it. It follows resizing, scrolling and fullscreen with observers, not a timer.
- **One line, draggable** — only the translation is shown; grab the handle and move it, it snaps to nine anchor points and remembers the spot.
- **Six themes** — Aurora, Neon, Cinema, Ribbon, Slate and Paper. Pick one from the visual chips and the video updates instantly, mid-session.
- **Right-to-left done properly** — a Persian line reads right-to-left, and Latin runs inside it are wrapped in Unicode isolates so the sentence does not scramble.
- **Progressive sentence highlight** — the spoken part colours in as it plays, drawn with the CSS Custom Highlight API, so the text stays selectable.
- **Automatic contrast** — a tiny probe of the frame behind the line flips the plate light or dark, and disables itself on a cross-origin video.
- **The site's own captions come first** — a timed caption track is translated instead of the audio: exact timing, no tab capture, no dubbing cost. Discovery goes through the player's caption list, the page's network trace, and the browser's own WebVTT parser.
- **Nothing to configure** — the model detects the source language. One dropdown picks the target language (Persian by default), and an optional box says in what tone to translate.
- **Subtitle-only sessions** — one button gives you an exactly timed translated subtitle without any dubbing, exportable as SRT or VTT.
- **Translation memory** — translated lines are kept in IndexedDB per line and per video. Re-watching sends zero requests; the popup shows the size and clears it.
- **A failed translation says so** — the caption path uses a JSON schema so numbering never drifts, and a model that cannot be reached is reported instead of silently showing the untranslated original.

- **A key test and a model finder** — one button checks the API key and the connection and says exactly what came back: works, key rejected, out of quota (with the retry delay the service asked for), or model missing. A second button probes the models one by one and lists only the ones that actually answered on *your* key, the thriftiest first, because not every model is reachable on the free tier.
- **Token usage and quota, counted locally** — a card shows today's input, output, audio-in, audio-out and text tokens, the billed turns, the sessions and the peak context. Enter the daily budget from AI Studio and you get a progress bar, the percentage and what is left. The counter resets at midnight Pacific, the same rule the Gemini API uses for its per-day limits, and the remaining time is shown. Google exposes no endpoint for the remaining quota, so these are the extension's own numbers, read from the `usageMetadata` block that both the live socket and the subtitle requests return — approximate, with a link to Google's authoritative dashboard.
- **Fewer, larger requests instead of more parallel ones** — a rate limit is not beaten by more concurrency, it is beaten by asking less often. Batches went from 40 to 80 lines, so the same subtitle costs half the requests. On a 429 the client drops to a single request in flight, waits exactly as long as the service asked in `retryDelay`, and stops after the second refusal rather than grinding on. What was already translated is kept and the popup says how many lines are still missing.

- **One switch for the original wording** — flip it and the video shows the source line instead of the translation, in its own reading direction, on the very next frame. Both versions travel with the cue, so nothing is fetched or translated again.
- **Your own colours** — pick the plate colour, its opacity and the colour the spoken part lights up in. Every theme accepts them, including the two that normally carry no plate at all, and switching the option off hands the colours back to the theme.
- **Themes you can actually read** — the six samples are stacked one per row with a full sample sentence instead of three cramped columns, and they preview in the colours that will really appear on the video.
- **Collapsible sections** — every block in the popup folds. They all start closed so the window stays short, and whichever ones you open are remembered for next time.

- **A new video clears the old subtitle by itself** — the stage fingerprints what is playing and drops the previous cues the moment anything real about it changes, so a stale subtitle can no longer sit on top of the next clip. Switching on a site that never reloads the page is caught too. A notification counter jumping in the tab title is not mistaken for a new video. With "carry on with the next video" left on, the new clip is fetched and translated on its own, and because re-watching comes from translation memory, going back costs nothing.

- **Two paths, side by side** — the dub button and the subtitle button sit together under the main action, the second one in its own colour. Run either alone or both at once: dubbing gives you the voice, the subtitle path gives you exactly timed text, and neither needs the other.
- **Captions are found even when the player is late with them** — a player that has just started does not have its caption list ready, and a single look used to be reported as "this video has no captions" while it plainly had some. The list is now waited for inside the page, the player is nudged into loading its own caption module, and the whole discovery is repeated a handful of times over a few seconds. None of that costs an API request, the popup says which attempt it is on, and a player that is ready is never made to wait.
- **No captions at all? It translates live** — when a video really ships no caption track, the audio path takes over by itself: the tab's sound is captured, translated as it plays and written on the picture, with the dub voice switched off. You get live subtitles without a dub, and the switch can be turned off if you would rather keep the quota.

- **The player's own captions are switched on for you** — YouTube only builds its caption list once CC is on, which is why a video with subtitles could keep insisting it had none. Pressing the subtitle button now turns the player's CC on, takes the caption file and turns CC straight back off before translating, so its own subtitles flash by for a moment instead of sitting there the whole time. Captions you had already enabled are left alone.

### Security audit

| Area | Result |
| --- | --- |
| Remote code | None. No CDN, no remote script, no `eval`. CSP is `script-src 'self' 'wasm-unsafe-eval'`. |
| Network destinations | Exactly one: the AI live endpoint declared in `host_permissions`. No analytics or telemetry. |
| API key handling | Stored locally with `chrome.storage.local`, sent only to that endpoint over TLS, never synced or logged. |
| Host access | No `<all_urls>`, no `tabs` permission. Page access via `activeTab` after you click the icon, plus one content script (the quick-panel button) limited to `https://www.youtube.com/*`. |
| Injected script | Two, on demand only: a metadata reader that returns the title and caption list, and the subtitle stage inside its own closed Shadow DOM. Neither writes to the page. |
| File writes | Only through `chrome.downloads`. Paths are sanitised twice and `..` segments dropped, so writes stay inside the downloads folder. |
| Bundled encoder | A pre-built WebAssembly MP3 encoder under MPL-2.0, in a worker with no network access, receiving PCM only. |
| Third-party runtime dependencies | None. The build, lint and test tooling is plain Node.js. |
| Data retention | Nothing leaves your machine except the audio sent for translation. The session snapshot and the on-video subtitle cues live in `storage.session` and clear on browser restart. |
| Model cache | Models that answered on your key are kept in `storage.local` under a 16-hex SHA-256 fingerprint of the key, never the key itself; the list expires after 12 hours. |
| Artifact integrity | Built by the release workflow and published with a SHA-256 checksum file. |

Full details: [README](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.md) · [CHANGELOG](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [SECURITY](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

---

<div dir="rtl">

## دوبله پارسی نسخهٔ <span dir="ltr">v1.3.0</span>

**صدای هر تب مرورگر را زنده و با هوش مصنوعی دوبله کن، بعد فایل <span dir="ltr">MP3</span> و زیرنویس <span dir="ltr">SRT/VTT</span> را دقیقاً هم‌نام همان ویدئو تحویل بگیر.**

### فایل‌های دانلود

| فایل | چیست |
| --- | --- |
| <span dir="ltr">`doble-parsi-1.3.0-chrome.zip`</span> | فایل اصلی اکستنشن. آن را دانلود و از حالت فشرده خارج کن، سپس در کروم با <span dir="ltr">**Load unpacked**</span> بارگذاری کن. |
| <span dir="ltr">`doble-parsi-1.3.0.crx`</span> | بستهٔ امضاشده (اختیاری). |

### نصب در یک دقیقه

۱. فایل <span dir="ltr">`doble-parsi-1.3.0-chrome.zip`</span> را دانلود و از حالت فشرده خارج کن.
۲. در مرورگر <span dir="ltr">`chrome://extensions`</span> (یا <span dir="ltr">`edge://extensions`</span>) را باز کن.
۳. گزینهٔ <span dir="ltr">**Developer mode**</span> را روشن کن.
۴. روی <span dir="ltr">**Load unpacked**</span> بزن و پوشهٔ خارج‌شده را انتخاب کن. اگر از نسخهٔ <span dir="ltr">1.2.0</span> به‌روزرسانی می‌کنی، کافی است دکمهٔ بارگذاری دوباره روی کارت افزونه را بزنی.
۵. پاپ‌آپ را باز کن، کلید <span dir="ltr">API</span> جِمینای را بچسبان، زبان را انتخاب کن و **شروع دوبله** یا **نمایش زیرنویس روی ویدئو** را بزن.

به کروم یا اِج نسخهٔ ۱۱۶ و بالاتر نیاز دارد.

### تازه‌های نسخهٔ <span dir="ltr">v1.3.0</span>

| # | مشکل گزارش‌شده | چه تغییری کرد |
| --- | --- | --- |
| ۱ | فهرست کشویی مدل باید در بخش «کلید <span dir="ltr">API</span> و زبان» باشد | فهرست «مدل ترجمهٔ زیرنویس»، دکمهٔ «یافتن مدل‌هایی که روی کلید من کار می‌کنند» و پیام وضعیتش حالا درست زیر کلید <span dir="ltr">API</span> و دکمهٔ «تست کلید و اتصال» هستند. |
| ۲ | با «نمایش زیرنویس» در اکثر مواقع زیرنویسی دیده نمی‌شد، مگر بعد از زدن «یافتن مدل‌ها…» | همان بررسی مدل‌ها حالا پیش از اولین ترجمه **خودکار** انجام می‌شود، کم‌مصرف‌ترین مدلِ کارکننده انتخاب و برای همان کلید ۱۲ ساعت به خاطر سپرده می‌شود، اگر مدل ذخیره‌شده شکست بخورد یک بار دیگر بررسی و تکرار می‌شود، و مدل‌هایی که سهمیهٔ رایگانشان صفر است کنار گذاشته می‌شوند. |
| ۳ | با بستن پاپ‌آپ، خروجی گرفتن از زیرنویس ممکن نبود و دکمهٔ ذخیره حذف می‌شد | وضعیت و کیوهای زیرنویس با خوابیدن سرویس‌ورکر از بین نمی‌روند (<span dir="ltr">`chrome.storage.session`</span>). دکمهٔ **ذخیرهٔ این زیرنویس** به پنل سریع یوتیوب هم اضافه شد. |
| ۴ | زیرنویس دانلودشده در <span dir="ltr">PotPlayer</span> و پخش‌کننده‌های دیگر به‌هم‌ریخته بود | هر سطر راست‌به‌چپ در فایل <span dir="ltr">SRT/VTT</span> با <span dir="ltr">`RLM + RLE … PDF + RLM`</span> پیچیده می‌شود، کلمه‌های انگلیسی <span dir="ltr">`LRE … PDF`</span> می‌گیرند، علامت‌ها در طرف درست می‌مانند و هر دو فرمت با <span dir="ltr">BOM</span> یونیکد شروع می‌شوند. |

اشکال‌های دیگری که در بازبینی پروژه رفع شد:

- برچسب مدل «مدل ترجمهٔ متن» نوشته می‌شد، چون کلیدش در دیکشنری دو بار تعریف شده بود.
- سطر خالی داخل یک کیو می‌توانست بلوک <span dir="ltr">SRT</span> را زودتر ببندد.
- دکمهٔ «شروع/توقف دوبله» در پاپ‌آپ اگر سرویس‌ورکر جواب نمی‌داد غیرفعال می‌ماند.
- بخش فارسی همین یادداشت ریلیز یک بلوک راست‌چینِ بسته‌نشده و راهنمای قدیمی مدل داشت.
- ۱۶ تست واحد تازه؛ <span dir="ltr">`npm run verify`</span> (لینت، ۱۲۶ تست و بیلد) سالم می‌گذرد.

### قابلیت‌های نسخه‌های قبل

- **<span dir="ltr">v1.2.0</span> — صدای اصلی کامل قطع می‌شود.** ولوم مستقل «صدای اصلی ویدئو» (۰ تا ۱۰۰٪، صفر = سکوت واقعی، به‌علاوهٔ دکمهٔ قطع) روی پخش اعمال می‌شود. ولوم جدای «صدای دوبله» (۰ تا ۱۵۰٪) دوبلهٔ کم‌صدا را بلند می‌کند.
- **<span dir="ltr">v1.2.0</span> — دکمه‌های اصلی بالای افزونه.** «شروع دوبله» و «نمایش زیرنویس» زیر نوار وضعیت نشسته‌اند و کارت ولوم زیر آن‌هاست؛ بدون اسکرول.
- **<span dir="ltr">v1.2.0</span> — دکمهٔ میانبر روی پخش‌کنندهٔ یوتیوب.** دکمهٔ تازه‌ای کنار چرخ‌دندهٔ یوتیوب مینی‌پنلی باز می‌کند: شروع/توقف دوبله، نمایش/پنهان‌کردن زیرنویس، ولوم صدای اصلی و دوبله. به یک <span dir="ltr">content script</span> محدود به <span dir="ltr">`https://www.youtube.com/*`</span> نیاز دارد؛ دسترسی دیگری اضافه نشد.
- **زیرنویس روی خودِ ویدئو** — ترجمه روی تصویر می‌نشیند، داخل یک <span dir="ltr">Shadow DOM</span>، پس <span dir="ltr">CSS</span> سایت به آن نمی‌رسد. تغییر اندازه، اسکرول و تمام‌صفحه را با <span dir="ltr">observer</span> دنبال می‌کند نه با تایمر.
- **یک خط، قابل جابه‌جایی** — فقط ترجمه نشان داده می‌شود؛ دستگیره را بگیر و بکش، به ۹ لنگر می‌چسبد و جایش را یادش می‌ماند.
- **۶ قالب** — شفق، نئون، سینما، روبان، تخته و کاغذ. از تراشه‌های تصویری یکی را بزن؛ همان لحظه و وسط جلسه عوض می‌شود.
- **راست‌چینِ درست** — خط فارسی راست‌چین خوانده می‌شود و تکه‌های لاتین داخلش با جداسازهای یونیکد پیچیده می‌شوند تا جمله به‌هم نریزد.
- **هایلایت پیش‌روندهٔ جمله** — بخش گفته‌شده همراه پخش رنگ می‌گیرد، با <span dir="ltr">CSS Custom Highlight API</span>، پس متن قابل انتخاب می‌ماند.
- **تطبیق خودکار با روشنایی صحنه** — یک نمونهٔ ریز از فریمِ پشت زیرنویس، پلاک را تیره یا روشن می‌کند و روی ویدئوی <span dir="ltr">cross-origin</span> خودش خاموش می‌شود.
- **اول زیرنویس خودِ سایت** — زیرنویس زمان‌بندی‌شده به‌جای صدا ترجمه می‌شود: زمان‌بندی دقیق، بدون گرفتن صدای تب و بدون هزینهٔ دوبله. کشف از فهرست پخش‌کننده، ردِ شبکه‌ای صفحه و پارسر <span dir="ltr">WebVTT</span> خودِ مرورگر می‌گذرد.
- **چیزی برای تنظیم نیست** — زبان مبدأ را مدل تشخیص می‌دهد. یک فهرست کشویی زبان مقصد را انتخاب می‌کند (فارسی پیش‌فرض) و یک کادر اختیاری می‌گوید با چه لحنی ترجمه شود.
- **جلسهٔ فقط زیرنویس** — یک دکمه، زیرنویس ترجمه‌شده با زمان‌بندی دقیق و بدون هیچ دوبله‌ای، با خروجی <span dir="ltr">SRT</span> یا <span dir="ltr">VTT</span>.
- **حافظهٔ ترجمه** — خطوط ترجمه‌شده در <span dir="ltr">IndexedDB</span> می‌مانند، تک‌خط و کل ویدئو. بازتماشا صفر درخواست دارد؛ پاپ‌آپ اندازه را نشان می‌دهد و پاکش می‌کند.
- **ترجمهٔ ناموفق سکوت نمی‌کند** — مسیر زیرنویس از طرح <span dir="ltr">JSON</span> استفاده می‌کند تا شماره‌گذاری به‌هم نریزد، و مدلی که در دسترس نباشد گزارش می‌شود، نه اینکه بی‌صدا متن ترجمه‌نشده نشان داده شود.

- **تست کلید و یابندهٔ مدل** — یک دکمه کلید و اتصال را بررسی می‌کند و دقیقاً می‌گوید چه جوابی آمد: سالم است، کلید رد شد، سهمیه پر است (با همان زمان تلاش مجددی که سرویس خواسته) یا مدل وجود ندارد. دکمهٔ دوم مدل‌ها را یکی‌یکی امتحان می‌کند و فقط آن‌هایی را فهرست می‌کند که واقعاً روی کلید *تو* جواب دادند، کم‌مصرف‌ترین بالای فهرست — چون روی سطح رایگان همهٔ مدل‌ها در دسترس نیستند.
- **مصرف توکن و سهمیه، شمارش محلی** — یک کارت مصرف امروز را نشان می‌دهد: توکن ورودی، خروجی، صوت ورودی، صوت خروجی، توکن متنی، نوبت‌های محاسبه‌شده، جلسه‌ها و بیشترین کانتکست. سقف روزانه را از <span dir="ltr">AI Studio</span> وارد می‌کنی و نوار پیشرفت، درصد مصرف و باقی‌مانده را می‌گیری. شمارنده نیمه‌شب پسیفیک صفر می‌شود، همان قاعده‌ای که <span dir="ltr">Gemini API</span> برای سقف روزانه دارد، و زمان باقی‌مانده نمایش داده می‌شود. گوگل هیچ سرویسی برای «باقی‌ماندهٔ سهمیه» ندارد، پس این‌ها شمارش خودِ افزونه است، از همان بلوک <span dir="ltr">`usageMetadata`</span> که هم سوکت زنده و هم درخواست‌های زیرنویس برمی‌گردانند — تقریبی، با لینک به داشبورد رسمی گوگل.
- **درخواست کمتر و بزرگ‌تر، نه موازی‌سازی بیشتر** — سقف نرخ با موازی‌سازی بیشتر شکسته نمی‌شود، با کمتر پرسیدن شکسته می‌شود. بسته‌ها از ۴۰ خط به ۸۰ خط رسیدند، پس همان زیرنویس نصف درخواست می‌برد. روی <span dir="ltr">۴۲۹</span> کلاینت به یک درخواست همزمان می‌آید، دقیقاً به اندازهٔ <span dir="ltr">`retryDelay`</span>ِ سرویس صبر می‌کند و بعد از دومین رد شدن دست می‌کشد، به‌جای سمج بودن. هرچه ترجمه شده نگه داشته می‌شود و پاپ‌آپ می‌گوید چند خط باقی مانده.

- **یک سوییچ برای متن اصلی** — بزنش و ویدئو به‌جای ترجمه همان خط زبان اصلی را نشان می‌دهد، با جهت خواندن خودش، از همان فریم بعدی. هر دو نسخه همراه کیو می‌آیند، پس چیزی دوباره گرفته یا ترجمه نمی‌شود.
- **رنگ‌های خودت** — رنگ پلاک، شفافیتش و رنگی که بخش گفته‌شده با آن روشن می‌شود را انتخاب کن. همهٔ قالب‌ها قبولش می‌کنند، حتی آن دو قالبی که معمولاً هیچ پلاکی ندارند، و خاموش کردن این گزینه رنگ‌ها را به خودِ قالب برمی‌گرداند.
- **قالب‌هایی که واقعاً دیده می‌شوند** — شش نمونه به‌جای سه ستون فشرده، هر کدام در یک ردیف و با یک جملهٔ نمونهٔ کامل، و پیش‌نمایششان با همان رنگ‌هایی است که واقعاً روی ویدئو می‌آید.
- **بخش‌های جمع‌شو** — هر بلوک پاپ‌آپ باز و بسته می‌شود. همه بسته شروع می‌کنند تا پنجره کوتاه بماند، و هر کدام را که باز بگذاری بار بعد باز می‌آید.

- **ویدئوی تازه، زیرنویس قبلی را خودش پاک می‌کند** — صحنه از ویدئوی درحال‌پخش اثر انگشت می‌گیرد و همین که چیز واقعی‌ای عوض شود کیوهای قبلی را دور می‌ریزد، پس زیرنویس کهنه دیگر روی کلیپ بعدی نمی‌ماند. جابه‌جایی در سایتی که صفحه را هرگز بارگذاری دوباره نمی‌کند هم گرفته می‌شود. بالا و پایین شدن شمارندهٔ اعلان در عنوان تب هم با ویدئوی تازه اشتباه گرفته نمی‌شود. اگر «ادامهٔ خودکار برای ویدئوی بعدی» روشن بماند، کلیپ تازه خودش گرفته و ترجمه می‌شود، و چون بازتماشا از حافظهٔ ترجمه می‌آید، برگشتن به عقب هیچ هزینه‌ای ندارد.

- **دو مسیر، کنار هم** — دکمهٔ دوبله و دکمهٔ زیرنویس زیر هم و زیر کنش اصلی نشسته‌اند، دومی با رنگ خودش. هر کدام را تنها یا هر دو را با هم روشن کن: دوبله صدا می‌دهد، مسیر زیرنویس متنِ دقیقاً زمان‌بندی‌شده، و هیچ‌کدام به دیگری نیاز ندارد.
- **زیرنویس پیدا می‌شود، حتی وقتی پخش‌کننده دیر آماده‌اش می‌کند** — پخش‌کننده‌ای که تازه راه افتاده فهرست زیرنویسش آماده نیست، و یک نگاهِ تنها باعث می‌شد گزارش شود «این ویدئو زیرنویس ندارد» در حالی که داشت. حالا داخل خودِ صفحه منتظر فهرست می‌مانیم، پخش‌کننده را وادار می‌کنیم ماژول زیرنویس خودش را بارگذاری کند، و کل کشف چند بار در طول چند ثانیه تکرار می‌شود. هیچ‌کدام از این‌ها یک درخواست <span dir="ltr">API</span> هم هزینه ندارد، پاپ‌آپ می‌گوید در تلاش چندم است، و پخش‌کننده‌ای که آماده باشد هرگز منتظر نمی‌ماند.
- **هیچ زیرنویسی ندارد؟ زنده ترجمه می‌کند** — وقتی ویدئو واقعاً زیرنویس آماده ندارد، مسیر صوتی خودش تحویل می‌گیرد: صدای تب گرفته می‌شود، همان لحظه ترجمه و روی تصویر نوشته می‌شود، با صدای دوبلهٔ خاموش. یعنی زیرنویس زنده بدون دوبله، و اگر ترجیح می‌دهی سهمیه را نگه داری می‌توانی خاموشش کنی.

- **زیرنویس خودِ پخش‌کننده برایت روشن می‌شود** — یوتیوب فهرست زیرنویسش را تا وقتی CC روشن نشود نمی‌سازد، و همین باعث می‌شد ویدئویی که زیرنویس دارد اصرار کند ندارد. زدن دکمهٔ زیرنویس حالا CC پخش‌کننده را روشن می‌کند، فایل زیرنویس را می‌گیرد و پیش از ترجمه بلافاصله خاموشش می‌کند، پس زیرنویس خودش فقط یک لحظه رد می‌شود نه در تمام مدت. زیرنویسی که خودت روشن گذاشته بودی دست‌نخورده می‌ماند.

### خلاصهٔ ممیزی امنیتی

| بخش | نتیجه |
| --- | --- |
| کد راه دور | ندارد. نه <span dir="ltr">CDN</span>، نه اسکریپت بیرونی، نه <span dir="ltr">`eval`</span>. سیاست امنیتی <span dir="ltr">`script-src 'self' 'wasm-unsafe-eval'`</span> است. |
| مقصدهای شبکه | فقط یکی: همان سرویس هوش مصنوعی که در <span dir="ltr">`host_permissions`</span> اعلام شده. نه آنالیتیکس، نه تلمتری. |
| نگهداری کلید <span dir="ltr">API</span> | محلی در <span dir="ltr">`chrome.storage.local`</span>، فقط روی <span dir="ltr">TLS</span> به همان سرویس فرستاده می‌شود، بدون همگام‌سازی و بدون لاگ. |
| دسترسی به سایت‌ها | نه <span dir="ltr">`<all_urls>`</span>، نه دسترسی <span dir="ltr">`tabs`</span>. دسترسی به صفحه با <span dir="ltr">`activeTab`</span> و بعد از کلیک تو، به‌علاوهٔ یک <span dir="ltr">content script</span> (دکمهٔ پنل سریع) محدود به <span dir="ltr">`https://www.youtube.com/*`</span>. |
| کد تزریق‌شده | دو مورد، فقط در لحظهٔ نیاز: خوانندهٔ متادیتا که عنوان و فهرست زیرنویس را برمی‌گرداند، و صحنهٔ زیرنویس داخل <span dir="ltr">Shadow DOM</span> بستهٔ خودش. هیچ‌کدام در صفحه نمی‌نویسند. |
| نوشتن فایل | فقط از راه <span dir="ltr">`chrome.downloads`</span>. مسیرها دو بار پاک‌سازی می‌شوند و بخش‌های <span dir="ltr">`..`</span> حذف می‌شوند، پس نوشتن داخل پوشهٔ دانلود می‌ماند. |
| انکودر همراه بسته | انکودر <span dir="ltr">MP3</span> از پیش ساخته‌شده با مجوز <span dir="ltr">MPL-2.0</span>، در ورکر بدون دسترسی شبکه، که فقط <span dir="ltr">PCM</span> می‌گیرد. |
| وابستگی‌های شخص ثالث | ندارد. ابزار بیلد، لینت و تست همه نود خالص است. |
| نگهداری داده | هیچ چیز از دستگاه تو بیرون نمی‌رود جز صدایی که برای ترجمه می‌رود. وضعیت جلسه و کیوهای زیرنویسِ روی ویدئو در <span dir="ltr">`storage.session`</span> هستند و با شروع مرورگر پاک می‌شوند. |
| حافظهٔ مدل‌ها | مدل‌هایی که روی کلید تو جواب داده‌اند در <span dir="ltr">`storage.local`</span> و زیر اثر انگشت ۱۶ رقمی <span dir="ltr">SHA-256</span> از کلید نگه داشته می‌شوند، نه خود کلید؛ این فهرست بعد از ۱۲ ساعت منقضی می‌شود. |
| اصالت فایل‌ها | با ورک‌فلوی ریلیز ساخته و همراه فایل چک‌سام <span dir="ltr">SHA-256</span> منتشر می‌شوند. |

جزئیات کامل: [<span dir="ltr">README فارسی</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.fa.md) · [<span dir="ltr">CHANGELOG</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [<span dir="ltr">SECURITY</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

</div>
