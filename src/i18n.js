/**
 * i18n افزونه: فارسی (پیش‌فرض) + انگلیسی
 * Extension i18n: Persian (default) + English
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */

export const UI_LANGS = [
  { code: "fa", label: "فارسی", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" }
];

export const DEFAULT_UI_LANG = "fa";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** جدول رشته‌ها؛ برای تست هم‌ترازی کلیدها هم صادر می‌شود */
export const DICT = {
  fa: {
    "app.name": "دوبله پارسی",
    "app.tagline": "دوبله زنده صدای تب + خروجی MP3 و زیرنویس",
    "app.langSwitch": "تغییر زبان رابط",

    "status.ready": "آماده",
    "status.connecting": "در حال اتصال…",
    "status.saving": "در حال ذخیره خروجی‌ها…",
    "status.live": "در حال دوبله",

    "state.on": "روشن",
    "state.off": "خاموش",

    "field.apiKey": "کلید API جِمینای",
    "btn.apiTest": "تست کلید و اتصال",
    "api.testing": "در حال بررسی…",
    "api.ok": "کلید سالم است و {model} جواب داد ({ms} میلی‌ثانیه).",
    "api.badKey": "کلید پذیرفته نشد. کلید معتبر را از AI Studio بگیر.",
    "api.quota": "سهمیهٔ این کلید پر است. بعداً امتحان کن یا مدل کم‌مصرف‌تری انتخاب کن.",
    "api.quotaRetry": "سهمیه پر است؛ سرویس گفته {s} ثانیه بعد امتحان کن.",
    "api.missing": "مدل {model} روی این کلید وجود ندارد.",
    "api.offline": "به سرویس نرسیدیم. اتصال اینترنت را بررسی کن.",
    "api.noAnswer": "پاسخی نیامد. یک بار دیگر بزن.",
    "btn.modelProbe": "یافتن مدل‌هایی که روی کلید من کار می‌کنند",
    "hint.modelProbe": "هر بررسی چند توکن مصرف می‌کند؛ مدل‌های کم‌مصرف اول امتحان می‌شوند.",
    "api.probing": "در حال امتحان کردن مدل‌ها…",
    "api.modelsFound": "{n} مدل از {checked} مدل بررسی‌شده جواب داد. کم‌مصرف‌ترین بالای فهرست است.",
    "api.noModels": "هیچ مدلی جواب نداد. کلید یا سهمیه را بررسی کن.",
    "opt.autoModel": "خودکار (پیشنهادی)",
    "opt.thrifty": "کم‌مصرف",
    "field.textModel": "مدل ترجمهٔ زیرنویس",

    "section.usage": "مصرف توکن و سهمیه",
    "section.usageHistory": "روزهای قبل",
    "field.dailyLimit": "سقف روزانهٔ توکن (از AI Studio)",
    "usage.total": "مجموع امروز",
    "usage.input": "توکن ورودی",
    "usage.output": "توکن خروجی",
    "usage.audioIn": "صوت ورودی",
    "usage.audioOut": "صوت خروجی",
    "usage.text": "توکن متنی",
    "usage.turns": "نوبت‌های محاسبه‌شده",
    "usage.sessions": "جلسه‌ها",
    "usage.peak": "بیشترین کانتکست",
    "usage.summary": "{used} از {limit} توکن — {percent}٪ مصرف شده، {left} باقی مانده.",
    "usage.noLimit": "سقف روزانه را وارد کن تا درصد مصرف و باقی‌مانده را نشان بدهم.",
    "usage.reset": "بازنشانی شمارنده: {h} ساعت و {m} دقیقه دیگر (نیمه‌شب پسیفیک).",
    "usage.quotaHit": "سرویس سهمیهٔ پرشده اعلام کرد.",
    "usage.quotaRetry": "سهمیه پر است؛ {s} ثانیه دیگر دوباره امتحان کن.",
    "btn.refresh": "به‌روزرسانی",
    "btn.usageClear": "صفر کردن شمارنده",
    "btn.dashboard": "داشبورد رسمی گوگل",
    "hint.usage": "گوگل API رسمی برای «باقی‌ماندهٔ سهمیه» ندارد؛ این اعداد شمارش خودِ افزونه‌اند و تقریبی‌اند.",
    "err.quota": "سهمیهٔ کلید API پر شد: {message}",
    "err.quotaPartial": "سهمیه وسط کار تمام شد؛ {n} خط ترجمه‌نشده ماند. بعداً دوباره بزن تا کامل شود.",
    "hint.apiKey": "کلید فقط روی همین مرورگر ذخیره می‌شود.",
    "btn.show": "نمایش",
    "btn.hide": "پنهان",

    "field.targetLang": "زبان ترجمه",
    "field.tone": "لحن ترجمه (اختیاری)",
    "ph.tone": "مثلاً: محاوره‌ای و خودی، یا رسمی و کتابی",
    "hint.tone": "روی زیرنویس اثر می‌گذارد، نه روی صدای دوبلهٔ زنده.",
    "hint.targetLang": "زبان ویدئو خودکار تشخیص داده می‌شود؛ فقط بگو به چه زبانی ترجمه شود.",
    "err.badKey": "کلید API پذیرفته نشد. یک کلید معتبر جِمینای وارد کن.",

    "section.outputs": "خروجی‌ها",
    "sw.livePlayback": "پخش زنده دوبله",
    "sw.livePlayback.desc": "همزمان با تماشا، صدای دوبله را بشنو",
    "sw.duck": "کم‌کردن صدای اصلی",
    "sw.duck.desc": "وقتی گوینده حرف می‌زند، صدای اصلی پایین می‌آید",
    "sw.mp3": "ذخیره فایل MP3",
    "sw.mp3.desc": "صدای دوبله‌شده به‌صورت فایل صوتی دانلود می‌شود",
    "sw.subtitle": "ذخیره زیرنویس",
    "sw.subtitle.desc": "متن دوبله با زمان‌بندی، به‌صورت فایل زیرنویس",
    "sw.bilingual": "زیرنویس زبان اصلی هم ذخیره شود",
    "sw.bilingual.desc": "یک فایل جدا با متن زبان مبدأ",

    "field.mp3Source": "محتوای فایل",
    "opt.mix": "دوبله + صدای اصلی (میکس)",
    "opt.dub": "فقط صدای دوبله",
    "field.bitrate": "کیفیت",
    "opt.96": "۹۶ کیلوبیت",
    "opt.128": "۱۲۸ کیلوبیت",
    "opt.192": "۱۹۲ کیلوبیت",

    "field.subFormat": "فرمت",
    "opt.both": "هر دو",
    "field.offset": "جبران تاخیر (میلی‌ثانیه)",

    "section.keys": "کلید API و زبان",
    "sw.original": "نمایش متن زبان اصلی",
    "sw.original.desc": "به‌جای ترجمه، همان متن اصلی ویدئو روی تصویر",
    "sw.customColors": "رنگ دلخواه",
    "sw.customColors.desc": "رنگ پلاک و رنگ هایلایت را خودت انتخاب کن",
    "field.plateColor": "رنگ پس‌زمینه",
    "field.spokenColor": "رنگ بخش گفته‌شده",
    "field.plateOpacity": "شفافیت پس‌زمینه",
    "section.stage": "نمایش زیرنویس روی ویدئو",
    "hint.bothPaths": "این دو مستقل‌اند: هر کدام را تنها یا هر دو را با هم می‌توانی روشن کنی.",
    "stage.searching": "در حال گشتن برای زیرنویس ویدئو… ({n} از {total})",
    "btn.stageSearching": "در حال گشتن برای زیرنویس…",
    "sw.toggleCaptions": "روشن‌کردن موقت CC پخش‌کننده",
    "sw.toggleCaptions.desc": "یوتیوب فهرست زیرنویس را تا CC روشن نشود نمی‌سازد؛ یک لحظه روشن و بعد خاموش می‌شود",
    "sw.liveFallback": "اگر ویدئو زیرنویس نداشت، ترجمهٔ زنده",
    "sw.liveFallback.desc": "صدای تب گرفته و متنش زنده روی ویدئو نوشته می‌شود، بدون صدای دوبله",
    "err.liveFallback": "این ویدئو زیرنویس آماده ندارد، پس ترجمهٔ زنده از صدا روشن شد.",
    "sw.overlay": "زیرنویس روی خودِ ویدئو",
    "sw.overlay.desc": "متن روی تصویر دیده می‌شود، نه فقط داخل این پنجره",
    "field.theme": "قالب",
    "field.textSize": "اندازهٔ متن",
    "field.textWidth": "عرض متن",
    "sw.karaoke": "هایلایت پیش‌روندهٔ جمله",
    "sw.karaoke.desc": "همراه گوینده، بخش گفته‌شده رنگ می‌گیرد",
    "sw.contrast": "تطبیق با روشنایی صحنه",
    "sw.contrast.desc": "روی صحنهٔ روشن، پلاک خودش تیره/روشن می‌شود",
    "hint.drag": "موقعیت زیرنویس را می‌توانی روی خودِ ویدئو بکشی: نشانگر را ببر روی زیرنویس، دستگیره را بگیر و بکش. به لنگرهای نه‌گانه خودش می‌چسبد.",

    "sw.autoContinue": "ادامهٔ خودکار برای ویدئوی بعدی",
    "sw.autoContinue.desc": "با عوض شدن ویدئو، زیرنویس قبلی برداشته و ویدئوی تازه خودش ترجمه می‌شود",
    "sw.siteCaptions": "اول زیرنویس خودِ سایت",
    "sw.siteCaptions.desc": "اگر ویدئو زیرنویس زمان‌بندی‌شده دارد، همان ترجمه می‌شود — زمان‌بندی دقیق و بی‌نیاز به دوبله",
    "btn.stageStart": "نمایش زیرنویس روی ویدئو",
    "btn.stageStop": "برداشتن زیرنویس",
    "btn.stageWorking": "در حال ترجمه… {n}٪",
    "btn.stageSave": "ذخیرهٔ این زیرنویس",
    "stage.hint": "یک ویدئو باز کن و بزن — برای این مسیر نه صدا گرفته می‌شود و نه دوبله‌ای لازم است.",
    "stage.track": "{n} خط از زیرنویس خودِ سایت، با زمان‌بندی دقیق",
    "stage.memory": "{n} خط کامل از حافظهٔ ترجمه — هیچ درخواستی فرستاده نشد",
    "stage.mixed": "{n} خط آماده — {memory} خط از حافظه، {fresh} خط تازه ترجمه شد",
    "stage.original": "{n} خط متن اصلی — ویدئو همین حالا به زبان مقصد است",
    "stage.liveOnly": "این ویدئو زیرنویس آماده ندارد؛ متن دوبلهٔ زنده روی ویدئو نشان داده می‌شود.",
    "stage.badge.site": "زیرنویس سایت · {n}",
    "stage.badge.memory": "از حافظه · {n}",
    "stage.badge.original": "متن اصلی · {n}",
    "stage.badge.live": "دوبلهٔ زنده",


    "sw.memory": "حافظهٔ ترجمه",
    "sw.memory.desc": "هر خط یک بار ترجمه می‌شود؛ بازتماشا رایگان است",
    "memory.stat": "{lines} خط و {tracks} ویدئو در حافظه",
    "memory.empty": "حافظه خالی است",
    "btn.memoryClear": "پاک‌کردن",
    "btn.memoryCleared": "پاک شد ✓",

    "section.liveText": "متن زنده",
    "caption.waiting": "در انتظار صدا…",
    "meter.cues": "{n} خط زیرنویس",
    "meter.audio": "{time} صدا",

    "section.files": "فایل‌های ذخیره‌شده",
    "btn.copy": "کپی متن دوبله",
    "btn.copied": "کپی شد ✓",
    "btn.downloads": "پوشه دانلود",

    "btn.start": "شروع دوبله",
    "btn.stop": "پایان و ذخیره",
    "btn.wait": "لطفاً صبر کن…",

    "section.advanced": "تنظیمات پیشرفته",
    "field.fileName": "نام‌گذاری فایل‌ها",
    "sw.originalName": "هم‌نام با ویدئوی اصلی",
    "sw.originalName.desc": "فایل‌ها با نام خودِ ویدئو ذخیره می‌شوند، نه نام تصادفی",
    "hint.folders": "خروجی‌ها مرتب ذخیره می‌شوند: پوشهٔ دانلود ← «Doble Parsi» ← پوشه‌ای هم‌نام ویدئو ← فایل صوتی و زیرنویس.",
    "field.translateModel": "مدل ترجمه",
    "hint.model": "اگر مدل پیش‌فرض جواب نداد، مدل Live دیگری را امتحان کن.",
    "field.textModel": "مدل ترجمهٔ متن",
    "field.duckLevel": "سطح صدای اصلی هنگام دوبله",

    "foot.hint": "صدای تب فعال گرفته می‌شود؛ برای شروع، تب ویدیو را باز و پخش کن.",
    "foot.by": "ساخته‌شده توسط",
    "foot.rights": "همهٔ حقوق محفوظ است.",
    "foot.github": "گیت‌هاب سازنده",

    "err.busy": "یک جلسه دوبله همین حالا در حال اجراست.",
    "err.noTab": "تب فعالی پیدا نشد.",
    "err.badTab": "این صفحه قابل ضبط نیست. یک تب معمولی (مثل یوتیوب یا یک جلسه آنلاین) را باز کن.",
    "err.noKey": "اول کلید API جِمینای را وارد کن.",
    "err.noOutput": "حداقل یکی از خروجی‌ها را روشن کن: پخش زنده، MP3 یا زیرنویس.",
    "err.startFailed": "شروع دوبله ناموفق بود.",
    "err.stopFailed": "پایان جلسه با خطا مواجه شد.",
    "err.unknown": "خطای ناشناخته رخ داد.",
    "err.socket": "ارتباط با سرویس هوش مصنوعی برقرار نشد. کلید API و اتصال اینترنت را بررسی کن.",
    "err.api": "پاسخ سرویس: {message}",
    "err.download": "ذخیره فایل انجام نشد.",
    "err.mp3Failed": "ذخیره MP3 ناموفق بود.",
    "err.mp3Silent": "صدای ضبط‌شده سکوت بود. اگر «پخش زنده» خاموش است، حالت MP3 را روی «فقط صدای دوبله» بگذار.",
    "err.mp3Empty": "صدایی برای ذخیره در MP3 ضبط نشد.",
    "err.clip": "سطح صدا بالا بود و محدودکننده وارد عمل شد؛ اگر کیفیت راضی‌ات نکرد بیت‌ریت را ببر روی ۱۹۲.",
    "err.dropped": "مدل سریع‌تر از زمان واقعی صدا فرستاد و حدود {seconds} ثانیه از دوبله جا نشد.",
    "err.subFailed": "ذخیره زیرنویس ناموفق بود.",
    "err.subEmptyDub": "متنی برای زیرنویس دوبله ثبت نشد.",
    "err.subEmptySource": "متنی برای زیرنویس زبان اصلی ثبت نشد.",
    "err.stageInject": "زیرنویس روی این صفحه نشست. یک تب معمولی باز کن و دوباره بزن.",
    "err.noSiteTrack": "زیرنویس زمان‌بندی‌شده‌ای در این صفحه پیدا نشد.",
    "err.noTrackCues": "زیرنویسی برای ذخیره وجود ندارد.",
    "err.translateFailed": "ترجمهٔ زیرنویس ناموفق بود."
  },

  en: {
    "app.name": "Doble Parsi",
    "app.tagline": "Live tab dubbing + MP3 and subtitle output",
    "app.langSwitch": "Switch interface language",

    "status.ready": "Ready",
    "status.connecting": "Connecting…",
    "status.saving": "Saving output files…",
    "status.live": "Dubbing",

    "state.on": "On",
    "state.off": "Off",

    "field.apiKey": "Gemini API key",
    "btn.apiTest": "Test the key and connection",
    "api.testing": "Checking…",
    "api.ok": "The key works and {model} answered ({ms} ms).",
    "api.badKey": "The key was rejected. Get a valid one from AI Studio.",
    "api.quota": "This key is out of quota. Try later or pick a thriftier model.",
    "api.quotaRetry": "Out of quota; the service says to retry in {s} s.",
    "api.missing": "The model {model} does not exist on this key.",
    "api.offline": "Could not reach the service. Check your connection.",
    "api.noAnswer": "No answer came back. Press it again.",
    "btn.modelProbe": "Find the models that work on my key",
    "hint.modelProbe": "Each check costs a few tokens; the thriftiest models are tried first.",
    "api.probing": "Trying the models…",
    "api.modelsFound": "{n} of {checked} checked models answered. The thriftiest is at the top.",
    "api.noModels": "No model answered. Check the key or the quota.",
    "opt.autoModel": "Automatic (recommended)",
    "opt.thrifty": "low quota",
    "field.textModel": "Subtitle translation model",

    "section.usage": "Token usage and quota",
    "section.usageHistory": "Previous days",
    "field.dailyLimit": "Daily token budget (from AI Studio)",
    "usage.total": "Total today",
    "usage.input": "Input tokens",
    "usage.output": "Output tokens",
    "usage.audioIn": "Audio in",
    "usage.audioOut": "Audio out",
    "usage.text": "Text tokens",
    "usage.turns": "Billed turns",
    "usage.sessions": "Sessions",
    "usage.peak": "Peak context",
    "usage.summary": "{used} of {limit} tokens — {percent}% used, {left} left.",
    "usage.noLimit": "Enter a daily budget and the percentage and remainder appear here.",
    "usage.reset": "Counter resets in {h} h {m} min (midnight Pacific).",
    "usage.quotaHit": "The service reported an exhausted quota.",
    "usage.quotaRetry": "Out of quota; try again in {s} s.",
    "btn.refresh": "Refresh",
    "btn.usageClear": "Reset the counter",
    "btn.dashboard": "Google's usage dashboard",
    "hint.usage": "Google exposes no API for the remaining quota; these numbers are counted locally and are approximate.",
    "err.quota": "The API key ran out of quota: {message}",
    "err.quotaPartial": "The quota ran out mid-way; {n} lines stayed untranslated. Press again later to finish them.",
    "hint.apiKey": "The key is stored only in this browser.",
    "btn.show": "Show",
    "btn.hide": "Hide",

    "field.targetLang": "Translation language",
    "field.tone": "Translation tone (optional)",
    "ph.tone": "e.g. casual and friendly, or formal and literary",
    "hint.tone": "Applies to the subtitles, not to the live dub audio.",
    "hint.targetLang": "The video's language is detected automatically; just say what to translate into.",
    "err.badKey": "The API key was rejected. Enter a valid Gemini key.",

    "section.outputs": "Outputs",
    "sw.livePlayback": "Live dub playback",
    "sw.livePlayback.desc": "Hear the dub while you watch",
    "sw.duck": "Duck original audio",
    "sw.duck.desc": "Lower the original track while the dub speaks",
    "sw.mp3": "Save MP3 file",
    "sw.mp3.desc": "Download the dubbed audio as a file",
    "sw.subtitle": "Save subtitles",
    "sw.subtitle.desc": "Timed dub text as a subtitle file",
    "sw.bilingual": "Also save source-language subtitles",
    "sw.bilingual.desc": "A separate file with the original text",

    "field.mp3Source": "File content",
    "opt.mix": "Dub + original (mix)",
    "opt.dub": "Dub only",
    "field.bitrate": "Quality",
    "opt.96": "96 kbps",
    "opt.128": "128 kbps",
    "opt.192": "192 kbps",

    "field.subFormat": "Format",
    "opt.both": "Both",
    "field.offset": "Delay offset (ms)",

    "section.keys": "API key and language",
    "sw.original": "Show the original text",
    "sw.original.desc": "The video's own wording on the picture instead of the translation",
    "sw.customColors": "Custom colours",
    "sw.customColors.desc": "Pick the plate colour and the highlight colour yourself",
    "field.plateColor": "Background colour",
    "field.spokenColor": "Spoken-part colour",
    "field.plateOpacity": "Background opacity",
    "section.stage": "Subtitles on the video",
    "hint.bothPaths": "These two are independent: run either one alone, or both together.",
    "stage.searching": "Looking for the video's captions… ({n} of {total})",
    "btn.stageSearching": "Looking for captions…",
    "sw.toggleCaptions": "Briefly switch the player's CC on",
    "sw.toggleCaptions.desc": "YouTube only builds its caption list once CC is on; it is turned on for a moment and off again",
    "sw.liveFallback": "No captions? Translate live",
    "sw.liveFallback.desc": "The tab's audio is captured and written on the video as it plays, with no dub audio",
    "err.liveFallback": "This video ships no caption track, so live translation from the audio was started.",
    "sw.overlay": "Subtitles on the video itself",
    "sw.overlay.desc": "The text sits on the picture, not only inside this popup",
    "field.theme": "Theme",
    "field.textSize": "Text size",
    "field.textWidth": "Text width",
    "sw.karaoke": "Progressive sentence highlight",
    "sw.karaoke.desc": "The spoken part colours in as the line plays",
    "sw.contrast": "Match the scene brightness",
    "sw.contrast.desc": "On a bright shot the plate flips itself light or dark",
    "hint.drag": "You can drag the subtitle on the video: hover it, grab the handle and move. It snaps to nine anchor points.",

    "sw.autoContinue": "Carry on with the next video",
    "sw.autoContinue.desc": "When the video changes, the old subtitle is dropped and the new one is fetched by itself",
    "sw.siteCaptions": "Prefer the site's own captions",
    "sw.siteCaptions.desc": "If the video ships a timed caption track, that gets translated — exact timing, no dubbing needed",
    "btn.stageStart": "Show subtitles on the video",
    "btn.stageStop": "Remove the subtitles",
    "btn.stageWorking": "Translating… {n}%",
    "btn.stageSave": "Save these subtitles",
    "stage.hint": "Open a video and press it — this path captures no audio and needs no dub.",
    "stage.track": "{n} lines from the site's own captions, exactly timed",
    "stage.memory": "All {n} lines came from translation memory — no request was sent",
    "stage.mixed": "{n} lines ready — {memory} from memory, {fresh} freshly translated",
    "stage.original": "{n} lines of original text — the video is already in the target language",
    "stage.liveOnly": "This video ships no caption track, so the live dub text is shown on the video instead.",
    "stage.badge.site": "Site captions · {n}",
    "stage.badge.memory": "From memory · {n}",
    "stage.badge.original": "Original text · {n}",
    "stage.badge.live": "Live dub",


    "sw.memory": "Translation memory",
    "sw.memory.desc": "Every line is translated once; re-watching is free",
    "memory.stat": "{lines} lines and {tracks} videos in memory",
    "memory.empty": "Memory is empty",
    "btn.memoryClear": "Clear",
    "btn.memoryCleared": "Cleared ✓",

    "section.liveText": "Live text",
    "caption.waiting": "Waiting for audio…",
    "meter.cues": "{n} subtitle lines",
    "meter.audio": "{time} audio",

    "section.files": "Saved files",
    "btn.copy": "Copy dub transcript",
    "btn.copied": "Copied ✓",
    "btn.downloads": "Downloads folder",

    "btn.start": "Start dubbing",
    "btn.stop": "Stop and save",
    "btn.wait": "Hold on…",

    "section.advanced": "Advanced settings",
    "field.fileName": "File naming",
    "sw.originalName": "Match the original video name",
    "sw.originalName.desc": "Files keep the video's own name instead of a random one",
    "hint.folders": "Outputs stay tidy: Downloads → \"Doble Parsi\" → a folder named after the video → the audio and subtitle files.",
    "field.translateModel": "Translation model",
    "hint.model": "If the default model fails, try another Live model.",
    "field.textModel": "Text translation model",
    "field.duckLevel": "Original volume while dubbing",

    "foot.hint": "Audio is captured from the active tab, so open and play the video first.",
    "foot.by": "Built by",
    "foot.rights": "All rights reserved.",
    "foot.github": "Author on GitHub",

    "err.busy": "A dubbing session is already running.",
    "err.noTab": "No active tab found.",
    "err.badTab": "This page cannot be captured. Open a regular tab (YouTube, a meeting, etc.).",
    "err.noKey": "Enter your Gemini API key first.",
    "err.noOutput": "Turn on at least one output: live playback, MP3 or subtitles.",
    "err.startFailed": "Could not start dubbing.",
    "err.stopFailed": "Something went wrong while finishing the session.",
    "err.unknown": "An unknown error occurred.",
    "err.socket": "Could not reach the AI service. Check your API key and internet connection.",
    "err.api": "Service response: {message}",
    "err.download": "Saving the file failed.",
    "err.mp3Failed": "Saving the MP3 failed.",
    "err.mp3Silent": "The recording was silent. If live playback is off, set the MP3 mode to Dub only.",
    "err.mp3Empty": "No audio was captured for the MP3.",
    "err.clip": "Levels ran hot and the limiter kicked in; bump the bitrate to 192 if you hear artifacts.",
    "err.dropped": "The model sent audio faster than real time and about {seconds}s of the dub did not fit.",
    "err.subFailed": "Saving the subtitles failed.",
    "err.subEmptyDub": "No text was captured for the dub subtitles.",
    "err.subEmptySource": "No text was captured for the source-language subtitles.",
    "err.stageInject": "Subtitles cannot be shown on this page. Open a regular tab and try again.",
    "err.noSiteTrack": "No timed caption track was found on this page.",
    "err.noTrackCues": "There are no subtitles to save yet.",
    "err.translateFailed": "Translating the subtitles failed."
  }
};

let current = DEFAULT_UI_LANG;

export function setLang(lang) {
  current = DICT[lang] ? lang : DEFAULT_UI_LANG;
  return current;
}

export function getLang() {
  return current;
}

export function dirOf(lang = current) {
  return UI_LANGS.find((item) => item.code === lang)?.dir ?? "rtl";
}

/** اعداد فارسی فقط در حالت فارسی */
export function digits(value, lang = current) {
  const text = String(value);
  return lang === "fa" ? text.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : text;
}

export function t(key, vars, lang = current) {
  const table = DICT[lang] ?? DICT[DEFAULT_UI_LANG];
  let text = table[key] ?? DICT[DEFAULT_UI_LANG][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/**
 * پیام‌های خطا از سرویس‌ورکر/offscreen به‌صورت کد می‌آیند تا در هر دو زبان
 * درست نمایش داده شوند. رشته‌ی خام هم پشتیبانی می‌شود.
 */
export function message(payload, lang = current) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.code) return t(payload.code, payload.vars, lang);
  return "";
}

/** ترجمه‌ی همه‌ی گره‌های دارای data-i18n */
export function applyDom(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
    if (node.hasAttribute("aria-label")) node.setAttribute("aria-label", t(node.dataset.i18nTitle));
  }
  for (const node of root.querySelectorAll("[data-i18n-ph]")) {
    node.placeholder = t(node.dataset.i18nPh);
  }
}
