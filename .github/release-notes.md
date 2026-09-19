## Doble Parsi v1.0.1

**Dub the audio of any browser tab live with AI, then keep the MP3 and the SRT/VTT subtitles named exactly after the video.**

### Downloads

| File | What it is |
| --- | --- |
| `doble-parsi-1.0.1-chrome.zip` | Main extension package. Unzip it, then load it in Chrome/Edge via **Load unpacked**. |
| `doble-parsi-1.0.1.crx` | Signed package (optional). |

### Install in one minute

1. Download and unzip `doble-parsi-1.0.1-chrome.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.
5. Open the popup, paste your Gemini API key, choose a language, press **Start dubbing**.

Requires Chrome or Edge 116+.

### What's new

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
| Host access | No `<all_urls>`, no `tabs` permission, no content scripts. Page access via `activeTab` only, after you click the icon. |
| Injected script | Two, on demand only: a metadata reader that returns the title and caption list, and the subtitle stage inside its own closed Shadow DOM. Neither writes to the page. |
| File writes | Only through `chrome.downloads`. Paths are sanitised twice and `..` segments dropped, so writes stay inside the downloads folder. |
| Bundled encoder | A pre-built WebAssembly MP3 encoder under MPL-2.0, in a worker with no network access, receiving PCM only. |
| Third-party runtime dependencies | None. The build, lint and test tooling is plain Node.js. |
| Data retention | Nothing leaves your machine except the audio sent for translation. The session snapshot clears on browser restart. |
| Artifact integrity | Built by the release workflow and published with a SHA-256 checksum file. |

Full details: [README](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.md) · [CHANGELOG](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [SECURITY](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

---

<div dir="rtl">

## دوبله پارسی نسخهٔ <span dir="ltr">v1.0.1</span>

**صدای هر تب مرورگر را زنده و با هوش مصنوعی دوبله کن، بعد فایل <span dir="ltr">MP3</span> و زیرنویس <span dir="ltr">SRT/VTT</span> را دقیقاً هم‌نام همان ویدئو تحویل بگیر.**

### فایل‌های دانلود

| فایل | چیست |
| --- | --- |
| <span dir="ltr">`doble-parsi-1.0.1-chrome.zip`</span> | فایل اصلی اکستنشن. آن را دانلود و از حالت فشرده خارج کن، سپس در کروم با <span dir="ltr">**Load unpacked**</span> بارگذاری کن. |
| <span dir="ltr">`doble-parsi-1.0.1.crx`</span> | بستهٔ امضاشده (اختیاری). |

### نصب در یک دقیقه

۱. فایل <span dir="ltr">`doble-parsi-1.0.1-chrome.zip`</span> را دانلود و از حالت فشرده خارج کن.
۲. در مرورگر <span dir="ltr">`chrome://extensions`</span> (یا <span dir="ltr">`edge://extensions`</span>) را باز کن.
۳. گزینهٔ <span dir="ltr">**Developer mode**</span> را روشن کن.
۴. روی <span dir="ltr">**Load unpacked**</span> بزن و پوشهٔ خارج‌شده را انتخاب کن.
۵. پاپ‌آپ را باز کن، کلید <span dir="ltr">API</span> جِمینای را بچسبان، زبان را انتخاب کن و **شروع دوبله** را بزن.

به کروم یا اِج نسخهٔ ۱۱۶ و بالاتر نیاز دارد.

### تازه‌ها

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
| دسترسی به سایت‌ها | نه <span dir="ltr">`<all_urls>`</span>، نه دسترسی <span dir="ltr">`tabs`</span>، نه <span dir="ltr">content script</span>. دسترسی به صفحه فقط با <span dir="ltr">`activeTab`</span> و بعد از کلیک تو. |
| کد تزریق‌شده | دو مورد، فقط در لحظهٔ نیاز: خوانندهٔ متادیتا که عنوان و فهرست زیرنویس را برمی‌گرداند، و صحنهٔ زیرنویس داخل <span dir="ltr">Shadow DOM</span> بستهٔ خودش. هیچ‌کدام در صفحه نمی‌نویسند. |
| نوشتن فایل | فقط از راه <span dir="ltr">`chrome.downloads`</span>. مسیرها دو بار پاک‌سازی می‌شوند و بخش‌های <span dir="ltr">`..`</span> حذف می‌شوند، پس نوشتن داخل پوشهٔ دانلود می‌ماند. |
| انکودر همراه بسته | انکودر <span dir="ltr">MP3</span> از پیش ساخته‌شده با مجوز <span dir="ltr">MPL-2.0</span>، در ورکر بدون دسترسی شبکه، که فقط <span dir="ltr">PCM</span> می‌گیرد. |
| وابستگی‌های شخص ثالث | ندارد. ابزار بیلد، لینت و تست همه نود خالص است. |
| نگهداری داده | هیچ چیز از دستگاه تو بیرون نمی‌رود جز صدایی که برای ترجمه می‌رود. وضعیت جلسه با شروع مرورگر پاک می‌شود. |
| اصالت فایل‌ها | با ورک‌فلوی ریلیز ساخته و همراه فایل چک‌سام <span dir="ltr">SHA-256</span> منتشر می‌شوند. |

جزئیات کامل: [<span dir="ltr">README فارسی</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/README.fa.md) · [<span dir="ltr">CHANGELOG</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/CHANGELOG.md) · [<span dir="ltr">SECURITY</span>](https://github.com/QW-AI-Code/doble-parsi/blob/main/SECURITY.md)

</div>

<div align="center">

<img src="assets/icons/icon128.png" width="88" height="88" alt="Doble Parsi" />

# دوبله پارسی — زیرنویس یوتیوب، با لحن خودت

**نسخهٔ ۱.۰.۱**

</div>

<div dir="rtl">

## بذار از خودِ مشکل شروع کنم

یک ویدئوی خوب انگلیسی پیدا می‌کنی. زیرنویس دارد. روی «ترجمهٔ خودکار» یوتیوب می‌زنی و... خب، همه‌مان می‌دانیم چه می‌شود. جمله‌ها چوبی، اصطلاح‌ها لغت‌به‌لغت، شوخی‌ها از بین رفته، و نصف وقتت را داری صرف حدس زدن می‌کنی که «یعنی چی گفت؟».

مشکل این نیست که ترجمهٔ ماشینی بد است. مشکل این است که **هیچ کنترلی رویش نداری**. نمی‌توانی بگویی «این یکی محاوره‌ای باشد»، «این یکی رسمی»، «اصطلاح‌های فنی را دست نزن».

این افزونه برای همین است.

## حالا چه کار می‌کنی

یک ویدئوی یوتیوب باز می‌کنی، دکمهٔ سبز **«نمایش زیرنویس روی ویدئو»** را می‌زنی، و چند ثانیه بعد زیرنویس فارسی — با **زمان‌بندی دقیق خودِ ویدئو** — روی تصویر می‌آید.

چرا زمان‌بندی دقیق است؟ چون افزونه صدا را گوش نمی‌دهد و حدس نمی‌زند. **زیرنویس واقعی خودِ یوتیوب** را برمی‌دارد، با همان تایم‌کدهای خودش، و فقط متنش را ترجمه می‌کند. پس هیچ‌وقت جلو یا عقب نمی‌افتد، و جلو و عقب بردن ویدئو هم به‌هم نمی‌ریزد.

## لحن ترجمه دست خودت است

این مهم‌ترین قسمت است. یک کادر ساده هست که هر چه بنویسی، همان‌طور ترجمه می‌شود:

| اگر بنویسی | نتیجه چه می‌شود |
|---|---|
| `محاوره‌ای و خودی، مثل حرف زدن با دوست` | «خب ببین، قضیه اینه که…» |
| `رسمی و کتابی` | «بدین ترتیب، نکتهٔ اصلی آن است که…» |
| `مثل زیرنویس فیلم سینمایی، کوتاه و تیز` | جمله‌های کوتاه، بی‌اضافه |
| `اصطلاحات فنی را انگلیسی نگه دار` | `deploy` و `commit` سر جایشان می‌مانند |
| `طنز ویدئو را حفظ کن، خشک ترجمه نکن` | شوخی‌ها می‌مانند |

هر چه بخواهی. یک جمله فارسی بنویس، تمام. و همین لحن بخشی از حافظهٔ ترجمه است، یعنی اگر لحن را عوض کنی ترجمهٔ تازه می‌گیری، نه نسخهٔ قبلی.

## ۶ قالب، که واقعاً با هم فرق دارند

زیرنویس روی ویدئو، نه داخل پنجرهٔ افزونه. شش ظاهر مختلف دارد و هر کدام را با یک کلیک عوض می‌کنی — **همان لحظه روی ویدئو**، بدون ترجمهٔ دوباره:

- **شفق** — شیشهٔ مات با یک هالهٔ رنگی که آرام می‌چرخد
- **نئون** — بی‌جعبه، متن با هالهٔ درخشان
- **سینما** — بدون پلاک، دورخط تیز، مثل زیرنویس فیلم
- **روبان** — نوار گرادیانی رنگی
- **تخته** — پلاک مات با نوار تأکید کناری، خواناترین حالت روی ویدئوی پرجزئیات
- **کاغذ** — تنها قالب روشن، برای مستند و اسلاید و ویدئوی پس‌زمینه‌سفید

رنگ پس‌زمینه، شفافیتش و رنگ آن بخشی که همراه گوینده روشن می‌شود را هم خودت انتخاب می‌کنی. اندازه و عرض متن هم با لغزنده. و **جای زیرنویس را می‌توانی روی خودِ ویدئو بکشی** — نشانگر را ببر رویش، دستگیره را بگیر و هر جا که می‌خواهی بگذار. به نه نقطهٔ استاندارد خودش می‌چسبد و جایش را یادش می‌ماند.

## فارسی، درست چیده‌شده

این را کسی که فارسی کار می‌کند می‌فهمد: یک جملهٔ فارسی که وسطش `Windows 11` یا `Node.js` دارد، اگر فقط راست‌چین شود، عددها و پرانتزها سر مرز به‌هم می‌ریزند.

اینجا هر تکهٔ لاتین با جداساز استاندارد یونیکد جدا می‌شود، پس جملهٔ ترکیبی همان‌طور که باید خوانده می‌شود. و این جداسازها فقط برای نمایش‌اند — فایل `.srt` که ذخیره می‌کنی تمیز است.

یک سوییچ هم هست که با یک کلیک **متن اصلی** را نشان می‌دهد، اگر خواستی ببینی گوینده دقیقاً چه گفت.

## آن باگ آزاردهنده‌ای که حل شد

اگر نسخه‌های قبل را امتحان کرده بودی، حتماً به این خورده‌ای: ویدئویی که **مشخصاً زیرنویس داشت**، افزونه می‌گفت «زیرنویس ندارد». چند بار که می‌زدی، یک‌بار پیدا می‌کرد.

علتش را یکی از کاربرها پیدا کرد و راستش خودم ندیده بودمش: **یوتیوب فهرست زیرنویسش را تا وقتی CC روشن نشود اصلاً نمی‌سازد.** یعنی چیزی نبود که پیدا شود.

حالا افزونه خودش CC پخش‌کننده را یک لحظه روشن می‌کند، فایل زیرنویس را برمی‌دارد و **بلافاصله خاموشش می‌کند** — قبل از شروع ترجمه، تا زیرنویس خودِ یوتیوب فقط یک لحظه رد شود نه در تمام مدت. و اگر خودت CC را روشن گذاشته بودی، دست نمی‌زند.

## بازتماشا مجانی است

هر خطی که یک بار ترجمه شده، در حافظهٔ خودِ مرورگرت می‌ماند. یعنی:

- همان ویدئو را دوباره ببینی → **صفر درخواست**، فوری می‌آید
- جمله‌ای که در ویدئوی دیگری قبلاً دیده‌ای → مجانی

پس هرچه بیشتر استفاده کنی، ارزان‌تر می‌شود. پاپ‌آپ نشان می‌دهد چند خط و چند ویدئو در حافظه هست و با یک کلیک پاک می‌شود.

## سهمیه و کلید — فکرش شده

کلید API را از [Google AI Studio](https://aistudio.google.com/apikey) مجانی می‌گیری. ولی سطح رایگان سقف دارد، و این جایی است که کارهای زیادی برایش شده:

- **دکمهٔ تست کلید** — می‌گوید کلیدت سالم است یا نه، و اگر نه، *چرا*: رد شد، سهمیه پر است (با ثانیهٔ تلاش مجدد)، یا مدل وجود ندارد.
- **یافتن مدل‌های کارکننده** — همهٔ مدل‌ها روی کلید رایگان کار نمی‌کنند. این دکمه یکی‌یکی امتحان می‌کند و فقط آن‌هایی را نشان می‌دهد که واقعاً روی کلید *تو* جواب دادند، **کم‌مصرف‌ترین بالای فهرست**.
- **کارت مصرف توکن** — مصرف امروز، ورودی، خروجی، تعداد نوبت، بیشترین کانتکست. سقف روزانه‌ات را از AI Studio وارد می‌کنی و نوار پیشرفت و باقی‌مانده را می‌بینی. شمارنده نیمه‌شب پسیفیک صفر می‌شود، همان قاعدهٔ خودِ گوگل.
- **درخواست‌های کمتر** — هر بستهٔ ترجمه ۸۰ خط است، نه ۴۰. یعنی برای یک ویدئوی ۶۰۰ جمله‌ای ۸ درخواست، نه ۱۵.
- **و اگر سهمیه وسط کار تمام شد**، هرچه ترجمه شده نگه داشته می‌شود و می‌گوید چند خط ماند. بعداً دوباره بزنی، فقط همان باقی‌مانده هزینه دارد.

> راستش را بگویم: قبلاً اگر ترجمه شکست می‌خورد، افزونه **بی‌صدا متن انگلیسی را نشان می‌داد** و تو فکر می‌کردی ترجمه شده. این دیگر ممکن نیست — شکست را می‌گوید و علتش را هم.

## ویدئو زیرنویس نداشت؟

بعضی ویدئوها هیچ زیرنویسی ندارند. در آن صورت افزونه خودش سراغ صدا می‌رود: صدای تب را می‌گیرد، همان لحظه ترجمه می‌کند و روی تصویر می‌نویسد — **بدون صدای دوبله**، فقط زیرنویس زنده.

و اگر دوبله هم بخواهی، دکمهٔ آبی بالایش همان است. این دو **کاملاً مستقل‌اند**: هر کدام را تنها، یا هر دو را با هم.

## ویدئوی بعدی هم خودش

قبلاً وقتی ویدئوی بعدی را باز می‌کردی، زیرنویس ویدئوی قبلی روی آن می‌ماند. حالا افزونه خودش می‌فهمد ویدئو عوض شده، زیرنویس قبلی را برمی‌دارد و ویدئوی تازه را می‌گیرد و ترجمه می‌کند. (این هم قابل خاموش کردن است، اگر ترجیح می‌دهی سهمیه را نگه داری.)

## فایل هم می‌دهد

هر زیرنویسی که ساخته شد را می‌توانی به `SRT` یا `VTT` ذخیره کنی — **با تایم‌کد واقعی ویدئو**، پس در هر پلیری کار می‌کند. فایل زبان اصلی هم اختیاری است. همه در `Downloads/Doble Parsi/<نام ویدئو>/` و هم‌نام خودِ ویدئو.

## نصب، یک دقیقه

۱. فایل `doble-parsi-1.0.1-chrome.zip` را از همین ریلیز بگیر و از حالت فشرده خارج کن.
۲. در کروم یا اِج برو به `chrome://extensions`.
۳. **Developer mode** را روشن کن.
۴. **Load unpacked** را بزن و پوشهٔ خارج‌شده را انتخاب کن.
۵. پاپ‌آپ را باز کن، کلید جِمینای را بچسبان، **تست کلید** را بزن.
۶. یک ویدئوی یوتیوب باز کن و دکمهٔ سبز را بزن.

کروم یا اِج نسخهٔ ۱۱۶ و بالاتر لازم است.

**پیشنهاد اول:** بعد از وارد کردن کلید، **یافتن مدل‌های کارکننده** را بزن و یک مدل `flash-lite` انتخاب کن. کم‌مصرف‌ترین است و برای ترجمهٔ زیرنویس کاملاً کافی.

## چه چیزی نمی‌خواهد

این را عمداً می‌نویسم، چون افزونه‌های زیرنویس معمولاً دسترسی‌های عجیبی می‌خواهند:

- **نه دسترسی به «همهٔ سایت‌ها»** — هیچ `content_scripts` در مانیفست ثبت نشده. کد فقط بعد از کلیک تو و از راه `activeTab` وارد همان یک تب می‌شود.
- **یک مقصد شبکه، تمام** — فقط سرویس جِمینای. نه آنالیتیکس، نه تلمتری، نه سرور واسط.
- **کلید API روی همین مرورگر می‌ماند** — همگام‌سازی نمی‌شود، لاگ نمی‌شود، جایی جز گوگل نمی‌رود.
- **بدون هیچ وابستگی اجرایی** — نه CDN، نه اسکریپت بیرونی، نه `eval`.

جزئیات کامل در جدول ممیزی امنیتی همان [README](README.fa.md) است.

## چیزهایی که باید بدانی

ترجیح می‌دهم اول خودم بگویم تا بعداً غافلگیر شوی:

- **کلید API خودت لازم است.** مجانی است ولی سقف دارد. یک ویدئوی نیم‌ساعته چند هزار توکن می‌برد.
- **آن یک لحظه** که CC خودِ یوتیوب روشن می‌شود، زیرنویس انگلیسی‌اش کوتاه دیده می‌شود. حدود یک ثانیه، ولی دیده می‌شود.
- **ترجمهٔ زندهٔ صدا** (برای ویدئوی بی‌زیرنویس) هم دقتش کمتر است و هم سهمیهٔ بیشتری می‌برد. مسیر زیرنویس همیشه بهتر است.
- **کیفیت ترجمه به مدل بستگی دارد.** لحن دلخواه کمک زیادی می‌کند، ولی معجزه نیست.
- **فونت** از سیستم خودت می‌آید. اگر وزیرمتن نصب باشد قشنگ‌تر است.

## بازخورد

اگر جایی کار نکرد یا بد شد، در [Issues](../../issues) بنویس و بگو **کدام سایت** و **چه سناریویی**. مورد قبلی — همان باگ CC — را خودِ یک کاربر پیدا کرد و بهترین گزارشی بود که می‌شد داد.

</div>

---

## English — short version

**Doble Parsi 1.0.1** turns YouTube's own caption track into a subtitle you actually control.

YouTube's auto-translate gives you one flavour of machine translation and no say in it. This extension takes the video's real timed caption track — exact timecodes, no guessing from audio — and translates it with **a tone you write yourself**: "casual and friendly", "formal", "keep technical terms in English", whatever you type in one box.

The result sits **on the video**, not in a popup, in one of six themes you can switch mid-playback, with the plate colour, the highlight colour, the size and the position all yours. Persian is laid out right-to-left properly, with Latin runs isolated so a mixed sentence does not scramble. One switch flips to the original wording.

**The bug that mattered:** YouTube does not build its caption list until CC is on, which is why videos with subtitles kept reporting they had none. The extension now switches the player's CC on for a moment, takes the file and switches it straight back off before translating — and leaves captions you had enabled yourself alone.

Other things worth knowing:

- **Translation memory** — every translated line is kept locally, so re-watching costs nothing and a sentence you have met before is free in any other video.
- **Built for the free tier** — a key test that tells you *why* it failed, a probe that lists only the models your key can actually call (cheapest first), a token and quota monitor with your daily budget, and 80-line batches so one video costs 8 requests instead of 15. If the quota runs out mid-way, what was translated is kept and you are told how many lines remain.
- **No captions at all?** The audio path takes over and writes live subtitles on the picture, with the dub voice off. Dubbing is a separate button — run either alone or both together.
- **Export** to SRT or VTT with the video's real timecodes.
- **Permissions:** no `content_scripts`, no `<all_urls>`, one network destination, the key never leaves your browser except to Google.

Needs your own free [Gemini API key](https://aistudio.google.com/apikey) and Chrome or Edge 116+. Full details, including the security audit table, in the [README](README.md).

Bug reports with the **site** and the **scenario** are the most useful thing you can send — that is exactly how the CC bug above was found.

___
<div dir="rtl">

⚠️ **توجه:**  
از بخش **«نمایش زیرنویس روی ویدیو»**، روی دکمه‌ی **«یافتن مدل‌هایی که روی کلید من کار می‌کنند»** کلیک کنید. سپس از میان گزینه‌های موجود، مدل `gemini-3.1-flash-lite-preview` را انتخاب نمایید. سهمیهٔ روزانه (Quota) این مدل بسیار دیرتر تمام می‌شود و برای استفاده مداوم پایدارتر است؛ با این حال، می‌توانید سایر مدل‌ها را نیز بررسی کنید، اما توجه داشته باشید که ممکن است سریع‌تر به سقف محدودیت مصرف برسند.

</div>

