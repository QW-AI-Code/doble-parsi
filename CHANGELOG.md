# Changelog

All notable changes to **Doble Parsi** are documented here, in English first and
Persian second. This project follows [Semantic Versioning](https://semver.org).
Every release must update this file, both READMEs, `.github/release-notes.md`,
`manifest.json` and `package.json` with the same version.

---

## [1.3.0] — 2026-11-27

### Added

- **Automatic model discovery for "Show subtitles"** (`src/model-cache.js`, `resolveTextModel` in the service worker). Before the first caption translation the worker probes which models answer on the key (the same probe as *Find the models that work on my key*), uses the thriftiest one in *Automatic* mode and passes the other verified models to the translator as fallbacks. The result is cached in `chrome.storage.local` for 12 hours under a 16-hex SHA-256 fingerprint of the key. The probe is lazy: a track served from translation memory or a same-language track costs nothing. If a remembered model fails with `err.api`, `err.translateFailed` or `err.quota`, the probe is forced once and the build is retried.
- **Zero-quota fallback** in `TrackTranslator`: a 429 whose message says `limit: 0` before any batch succeeded switches to the next candidate model instead of waiting and failing.
- **Worker-restart persistence** — the stage cues are written to `chrome.storage.session` (`dubleParsiTrack`) next to the existing state snapshot, and a `restoring` promise brings `stagePhase`, `track`, the saved files and the cues back when the worker wakes up. Message handling and the tab listeners wait for it.
- **Save from the YouTube quick panel** — a *Save these subtitles* button (`dp-mini-save`) appears while a caption track is on the video.
- **RTL-safe subtitle files** — `forFile` / `rtlLineForFile` in `src/bidi.js` and `subtitleFile` in `src/captions.js`: right-to-left lines get `RLM RLE … PDF RLM`, Latin runs `LRE … PDF`, sentence punctuation stays outside the Latin run, and SRT and VTT both start with a UTF-8 BOM.
- 16 unit tests in `test/release-1.3.0.test.mjs` and `test/worker-restore.test.mjs`.

### Changed

- **The subtitle model list, the model finder button and its status moved to the "API key and language" section** of the popup; the list is filled from the shared model cache automatically.
- Both the caption-track export (service worker) and the dubbing-session export (offscreen document) now use `subtitleFile`.
- Version 1.3.0 in `manifest.json`, `package.json`, both READMEs, `SECURITY.md` and the release notes.

### Fixed

- **"Show subtitles" failed most of the time** until *Find the models…* was pressed by hand — now automatic (see Added).
- **Exporting subtitles was impossible after closing the popup** and the *Save these subtitles* button disappeared, because the sleeping service worker lost the cues and the stage state.
- **Saved Persian subtitles were displayed wrongly in PotPlayer and other players** (punctuation at the wrong end, English words out of place).
- The model label read "Text translation model": `field.textModel` was defined twice in each dictionary.
- A blank line inside a cue could terminate an SRT block early; empty lines are dropped from cue text.
- *Start / Stop dubbing* in the popup stayed disabled when the worker did not answer.
- `.github/release-notes.md` had an unclosed RTL `div` and an outdated model hint.

---

## [1.2.0] — 2026-10-31

### Added

- **Independent volume for the original audio** (`originalVolume`, 0–1) applied to playback only. The playback chain is now `sourceNode → originalGain → originalMonitorGain (user volume) → destination`, so the MP3 mix branch stays unaffected.
- **Independent volume for the dub voice** (`dubVolume`, 0–1.5) on `dubPlaybackGain`.
- **Live volume updates** — `dp-volume-set` (popup) and `dp-mini-volume` (on-video panel) reach the offscreen document as `dp-off-volume` and are applied without restarting the session.
- **YouTube quick-panel button** (`src/overlay/yt-controls.js`) — a button inserted before YouTube's settings (gear) button opens a mini panel: start/stop dubbing, show/hide subtitles, original-audio volume with a mute toggle, and dub volume. Styles live in a Shadow DOM, key events are stopped from reaching YouTube's shortcuts, and a `MutationObserver` re-attaches it after YouTube re-renders the player. It works in fullscreen.
- **Service-worker endpoints for the panel** — `dp-mini-get`, `dp-mini-start`, `dp-mini-stop`, `dp-mini-stage`, `dp-mini-volume`; errors come back already localised.
- **Volume card in the popup** with percentage read-outs and a Mute button; it stays in sync when the volume is changed from the on-video panel.
- Unit tests for `clampVolume`, settings migration (version 10) and the quick-panel wiring.

### Changed

- **Start dubbing / Show subtitles moved to the top** of the popup, directly under the status bar and above all collapsible sections.
- **Manifest** — version 1.2.0; a `content_scripts` entry and a `host_permissions` entry for `https://www.youtube.com/*` (nothing else; still no `<all_urls>` and no `tabs`). The manifest test and `scripts/lint.mjs` were updated to describe exactly this set.

### Removed

- **Extra volume controls.** The *Duck original audio* switch and the *Original volume while dubbing* slider (Advanced settings) are gone, along with the automatic ducking behind them. The two volume sliders (original audio and dub voice) are the only volume controls, in the popup and in the on-video panel.

### Fixed

- **The release workflow now always publishes to the Releases panel.** It no longer re-runs lint and tests (the separate `build` workflow does), so a failing check cannot stop the release. It publishes with the preinstalled `gh` CLI, creates the release or refreshes it if the tag already exists, and attaches the ZIP and checksums.
- **The quick-panel button is now unmistakable and stays next to the gear.** It uses the extension's own colour icon (embedded, no new permission) instead of a speaker glyph that looked like YouTube's volume button, has YouTube's standard 48 px button size, shows a green dot while dubbing, and is put back right beside the gear whenever YouTube re-arranges the controls.

- **The original audio could not really be lowered or cut.** It was only attenuated while the dub was speaking, with `setTargetAtTime`, which approaches a target but never lands on it, and there was no way to lower it otherwise. Gain changes now use an exact linear ramp, and the user volume is a separate node so that 0 is genuine silence.

### Notes

- Chrome allows tab capture only after the extension was invoked on that tab (`activeTab`). If *Start dubbing* from the on-video panel reports this, press it once from the popup on that tab; afterwards the panel button works as well.

---

## [1.0.1] — 2026-09-18

### Added

- **On-video subtitle stage** — a `div` with a Shadow DOM and a `<style>` child, injected on demand through `activeTab` into every frame, so an embedded player inside an iframe is covered too. Site CSS cannot reach it, it uses no `!important`, and the critical positioning is also written as inline styles so a missing stylesheet cannot hide the text. Position tracking uses `ResizeObserver`, `IntersectionObserver` and `fullscreenchange` instead of a polling timer, and the host re-parents into the fullscreen element so it stays visible there.
- **Six subtitle themes** — `aurora`, `neon`, `cinema`, `ribbon`, `slate` and `paper`, chosen from visual preview chips in the popup and applied live, mid-session.
- **Progressive sentence highlight** — the spoken portion of a cue is painted with the CSS Custom Highlight API over one text node, with a two-text-node fallback where the API is missing. No per-frame DOM rebuild, and the text stays selectable.
- **Drag with magnetic snapping** — a pointer-captured handle moves the subtitle, snapping to nine anchor points; the position persists to settings.
- **Automatic contrast** — a 24×8 probe of the frame behind the cue flips the plate between light and dark. A tainted, cross-origin video disables the feature instead of throwing.
- **Right-to-left localisation** (`src/bidi.js`) — the base direction is taken from the first strong character, and Latin runs inside a right-to-left line are wrapped in `U+2066`/`U+2069` isolates. Unicode isolates rather than `<span dir="ltr">` wrappers, because the karaoke highlight needs the cue to stay one text node. The isolates are applied for display only and never reach the exported file.
- **Site caption tracks** — three discovery layers in order: the player's own caption list, the page's network trace via `performance.getEntriesByType("resource")`, and `video.textTracks` in `hidden` mode read by the browser's WebVTT parser. json3, TTML, WebVTT and SRT are all parsed; rolling duplicate lines are stripped and short auto-caption fragments are grouped into sentences.
- **Subtitle-only sessions** — a second button starts the stage without tab capture or dubbing, and exports the resulting cues as SRT or VTT with the video's real timecodes, written from the service worker through a base64 data URL.
- **Translation memory** — IndexedDB with two stores: per-line translations that carry across videos, and a whole-track record for instant re-watching. Keys are hashed with the source text stored alongside, so a hash collision can never surface a wrong translation. LRU trimming caps the store at 40 000 lines and 80 tracks.
- **Automatic source language, and a tone of your choosing** — the model detects the source language, so no source-language picker is offered. A single dropdown sets the target language, and a free-text box is appended to the system instruction as a style directive, capped and flattened before it is sent. The tone is part of the memory key, because a casual translation is not the same entry as a formal one.
- **Structured caption translation** — a text model called with `responseMimeType: application/json` and a `responseSchema`, batched by both line count and character budget, three requests in flight, exponential backoff on 429 and 5xx.
- **Model names that cannot rot** — the default is the dateless alias `gemini-flash-latest`. On a 404 the client walks a fallback list and, if that is exhausted, asks the service for the models this key can actually use and picks a suitable one. The user never needs to know a model name.
- **API key test** — a single `generateContent` ping distinguishes a working key from a rejected key, an exhausted quota (with the `retryDelay` the service returned) and a missing model, walking the candidate models until one answers.
- **Model probing for the subtitle path** — `ListModels` announces what the service has, but not what a free-tier key may call. Each candidate is pinged with a one-token request and only the models that answered are offered, thriftiest first; probing stops at the first quota refusal so it cannot burn what is left.
- **Token and quota monitor**, ported from the Android app's `core/TokenUsage.kt`: the `usageMetadata` block of every answer (live socket and subtitle request alike) is parsed in both camelCase and snake_case, split per modality, bucketed per Pacific day in `chrome.storage.local`, capped at 14 days, and compared against a daily budget the user copies from AI Studio. A 429 stores the message and its retry time. The Pacific day boundary is computed through `Intl` rather than a fixed offset, so daylight saving is handled.
- **Rate-limit behaviour instead of blind retries** — batches carry 80 lines instead of 40, halving the request count for the same subtitle. A 429 drops the in-flight count to one, holds every worker on a shared pace gate for exactly the delay the service asked for, and aborts after the second refusal. Whatever was translated is kept and reported as partial with the number of missing lines, instead of being silently presented as finished.
- **Both action buttons together** — the subtitle button was inside a section that is collapsed by default, which hid the second path completely. It now sits directly under the dub button in its own colour, with one line explaining that the two are independent.
- **Live translation when a video has no captions** — the audio engine is started with the dub voice muted and no audio file, so the tab's sound is transcribed and translated onto the picture as live subtitles. It is a switch, because unlike the caption path this one spends Live API quota.
- **Carry on with the next video** — with the switch on, a video change is followed by fetching and translating the new clip by itself, after a short pause and one retry, because a player that has just started does not have its caption list ready yet. The automatic attempt stands down if you started a session yourself in the meantime, and it never fires when no session was running.

- **Rolling live captions** — dub fragments are joined up to a sentence boundary and capped in length before they reach the video, so the on-video line reads as a sentence instead of flickering word by word.

- **Original-language switch** — the cue carries the translation and the source text, both already bidi-prepared by the service worker, so flipping the switch swaps the line on the next frame with the correct reading direction and no further request. A cue without a source falls back to the translation instead of going blank, and the karaoke highlight pauses while the original is shown, because its progress is measured against the translated line.
- **Custom plate and highlight colours** — `--dp-plate-user` and `--dp-spoken-user` are set on the shadow host and every theme rule reads them through `var(--dp-plate-user, <theme value>)`, so a chosen colour wins over the theme and clearing it hands control straight back. The browser colour picker has no alpha, so the plate colour is combined with a separate opacity slider into an `rgba()` value.
- **Readable theme picker** — the chips are stacked one per row with a full sample sentence, and they preview the custom colours rather than only the theme's own.
- **Collapsible popup sections** — each block is a `<details>` element, closed by default, and the set of open sections is stored in the settings.

### Fixed

- **A failed translation was invisible.** Every failed batch fell back to the source text and no error was raised, so a broken model or a rejected key showed up as a perfectly healthy *untranslated* subtitle. Batch results are now counted and, if no batch succeeded at all, the error is raised and reported in the popup.
- **YouTube never built its caption list until CC was on.** This was the real reason a video with captions kept reporting that it had none: `captionTracks` simply does not exist in the player response until the viewer switches captions on, so no amount of waiting or retrying could find what was not there yet. The subtitle button now turns the player's own CC on before the search, the caption file is fetched, and CC is switched back off immediately — before translation, so the player's own subtitles are only visible for a moment rather than for the whole job. It uses the same control you would click, falling back to the player's `setOption("captions", "track", …)` API, and it only restores what it changed itself: captions you had already enabled stay on. The whole behaviour can be switched off.
- **Untranslated captions reported as missing.** A player that has just started does not have `captionTracks` in its player response yet, and the discovery looked once and gave up, so a video with perfectly good captions was announced as having none — until a few manual retries happened to hit the right moment. The injected reader now waits for the caption list inside the page, in short steps, and asks the player to load its own captions module halfway through, which makes it issue the `timedtext` request that the network-trace layer can then see. The pipeline repeats the whole three-layer discovery five times over roughly seven seconds and tells the popup which attempt is running. The page also distinguishes "the player is not ready" from "the list is empty", so a genuinely caption-free video is still recognised quickly. All of this reads from the page only and costs no API request, and a player that is already ready is answered on the first, undelayed attempt.
- **The subtitle of the previous video stayed on the next one.** On a site that navigates without reloading — YouTube being the obvious case — the URL changes through `pushState`, the same `<video>` element is reused and the injected script keeps running, so its cue list survived into the next clip. Nothing cleared it: the service worker's `tabs.onUpdated` handler only reset its own state and never told the page, and an MV3 worker may well be asleep at that moment anyway. The detection now lives in the stage itself, which is the only part guaranteed to be alive. It builds a fingerprint from four independent signals — the video id in the URL (or the path), the page title with the notification counter and the site suffix stripped, `currentSrc`, which is fresh per video in an MSE player, and the duration rounded to seconds — and drops the cues as soon as it differs. The check runs on the media events the platform already fires (`emptied`, `loadstart`, `loadedmetadata`, `durationchange`), on the Navigation API with `popstate` and `hashchange` as fallbacks, and as a string comparison every 400 ms in the render loop for players that announce nothing at all. A false positive is harmless: the same video comes straight back from translation memory without a request. The service worker drops its stored cues on the same signal, so "save these subtitles" can no longer write the previous video's file.
- **Changing a setting did not reach the video until the whole track was rebuilt.** `pushStageConfig` only sent the new config to tab ids held in memory, and an MV3 service worker is terminated after a short idle, which empties both `stagedTabs` and `state.stageTabId`. The message then had no target at all and `tellStage` swallowed the failure, so a theme change looked like it had been ignored and the user had to press the button again and pay for a new translation. The active tab is now always a target, so a live change arrives whether or not the worker was restarted.
- **A truncated answer now splits the batch instead of giving up.** Large batches mean fewer requests, but if the translation comes out longer than the output-token ceiling the reply is cut off mid-JSON, and that used to land the whole batch back on the untranslated source text. The `finishReason: MAX_TOKENS` signal halves the batch and retries each half. Splitting only continues while there is evidence that smaller batches do get through: if a batch fails all the way down and nothing has succeeded yet, the size is not the problem, so the attempt stops instead of burning the remaining quota on it.
- **A partial translation is no longer cached as if it were complete.** When the quota ran out mid-way the half-finished track was written to the translation memory, and the next attempt took the fast path and returned that same half-finished result — the missing lines could never be completed. Only a fully translated track is stored now, and because the successful lines are still in the per-line memory, a later attempt pays only for what is actually missing.
- **Rolling caption de-duplication** compared against the trimmed remainder of the previous cue instead of its full text, so only one step of a rolling track was de-duplicated and later lines repeated in full.
- **The numbering base of a translation reply** was picked from the first index hit, and a one-based reply also hits zero-based slots by accident, which duplicated a line. The base is now chosen by counting matches.
- **The Aurora theme never animated.** Its drift keyframes animated a custom property registered with `@property`, and that registration is ignored inside a shadow-root stylesheet. The element is rotated directly instead.

### Changed

- **One line on the video, not two.** The second box that repeated the source text took a large part of the picture for little use and was removed. The source language is still available as an optional second subtitle file.
- **Settings version 5** — the stage, the site-caption path, the translation memory and the tone box are added and default to on; the manual source-language choice and the source-line switch are dropped and migrate away silently.
- **Lint** — a new rule checks that every file listed in `STAGE_FILES` exists and, because those files are injected as classic scripts, contains no `import` or `export`.

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

## [<span dir="ltr">1.3.0</span>] — ۶ آذر ۱۴۰۵

### افزوده شد

- **یافتن خودکار مدل برای «نمایش زیرنویس»** (<span dir="ltr">`src/model-cache.js`</span> و <span dir="ltr">`resolveTextModel`</span> در سرویس‌ورکر). پیش از اولین ترجمهٔ زیرنویس، سرویس‌ورکر بررسی می‌کند کدام مدل‌ها روی کلید جواب می‌دهند (همان بررسیِ «یافتن مدل‌هایی که روی کلید من کار می‌کنند»)، در حالت «خودکار» کم‌مصرف‌ترین را به کار می‌برد و بقیهٔ مدل‌های تأییدشده را به‌عنوان جایگزین به مترجم می‌دهد. نتیجه ۱۲ ساعت در <span dir="ltr">`chrome.storage.local`</span> و زیر اثر انگشت ۱۶ رقمی <span dir="ltr">SHA-256</span> از کلید نگه داشته می‌شود. بررسی تنبل است: زیرنویسی که از حافظهٔ ترجمه یا هم‌زبان باشد هیچ هزینه‌ای ندارد. اگر مدل ذخیره‌شده با <span dir="ltr">`err.api`</span>، <span dir="ltr">`err.translateFailed`</span> یا <span dir="ltr">`err.quota`</span> شکست بخورد، بررسی یک بار اجباری تکرار و ساخت زیرنویس دوباره امتحان می‌شود.
- **گذر از سهمیهٔ صفر** در <span dir="ltr">`TrackTranslator`</span>: خطای <span dir="ltr">429</span> با پیام <span dir="ltr">`limit: 0`</span>، تا وقتی هیچ بسته‌ای موفق نشده، به‌جای صبر و شکست، مدل نامزد بعدی را امتحان می‌کند.
- **ماندگاری پس از خواب سرویس‌ورکر** — کیوهای صحنه کنار وضعیت جلسه در <span dir="ltr">`chrome.storage.session`</span> (<span dir="ltr">`dubleParsiTrack`</span>) نوشته می‌شوند و وعدهٔ <span dir="ltr">`restoring`</span> با بیدار شدن سرویس‌ورکر <span dir="ltr">`stagePhase`</span>، <span dir="ltr">`track`</span>، فایل‌های ذخیره‌شده و کیوها را برمی‌گرداند. پیام‌ها و شنونده‌های تب منتظر آن می‌مانند.
- **ذخیره از پنل سریع یوتیوب** — دکمهٔ «ذخیرهٔ این زیرنویس» (<span dir="ltr">`dp-mini-save`</span>) وقتی زیرنویس سایت روی ویدئو است دیده می‌شود.
- **فایل زیرنویس راست‌چینِ امن** — <span dir="ltr">`forFile`</span> و <span dir="ltr">`rtlLineForFile`</span> در <span dir="ltr">`src/bidi.js`</span> و <span dir="ltr">`subtitleFile`</span> در <span dir="ltr">`src/captions.js`</span>: سطر راست‌به‌چپ <span dir="ltr">`RLM RLE … PDF RLM`</span> می‌گیرد، تکهٔ لاتین <span dir="ltr">`LRE … PDF`</span>، علامت پایان جمله بیرون از تکهٔ لاتین می‌ماند و هر دو فرمت <span dir="ltr">SRT</span> و <span dir="ltr">VTT</span> با <span dir="ltr">BOM</span> یونیکد شروع می‌شوند.
- ۱۶ تست واحد در <span dir="ltr">`test/release-1.3.0.test.mjs`</span> و <span dir="ltr">`test/worker-restore.test.mjs`</span>.

### تغییر کرد

- **فهرست مدل زیرنویس، دکمهٔ یافتن مدل و پیام وضعیتش به بخش «کلید <span dir="ltr">API</span> و زبان»** در پاپ‌آپ منتقل شدند و فهرست خودکار از حافظهٔ مشترک مدل‌ها پر می‌شود.
- خروجی زیرنویس سایت (سرویس‌ورکر) و خروجی جلسهٔ دوبله (سند <span dir="ltr">offscreen</span>) هر دو از <span dir="ltr">`subtitleFile`</span> استفاده می‌کنند.
- نسخهٔ <span dir="ltr">1.3.0</span> در <span dir="ltr">`manifest.json`</span>، <span dir="ltr">`package.json`</span>، هر دو ردمی، <span dir="ltr">`SECURITY.md`</span> و یادداشت ریلیز.

### رفع شد

- **«نمایش زیرنویس» در بیشتر مواقع زیرنویسی نشان نمی‌داد** تا وقتی «یافتن مدل‌ها…» دستی زده می‌شد — حالا خودکار است.
- **بعد از بستن پاپ‌آپ، خروجی گرفتن از زیرنویس ممکن نبود** و دکمهٔ «ذخیرهٔ این زیرنویس» حذف می‌شد، چون سرویس‌ورکرِ خوابیده کیوها و وضعیت صحنه را از دست می‌داد.
- **زیرنویس فارسیِ ذخیره‌شده در <span dir="ltr">PotPlayer</span> و پخش‌کننده‌های دیگر درست نمایش داده نمی‌شد** (علامت‌ها در طرف اشتباه و کلمه‌های انگلیسی نابه‌جا).
- برچسب مدل «مدل ترجمهٔ متن» نوشته می‌شد، چون <span dir="ltr">`field.textModel`</span> در هر دیکشنری دو بار تعریف شده بود.
- سطر خالی داخل یک کیو می‌توانست بلوک <span dir="ltr">SRT</span> را زودتر ببندد؛ سطرهای خالی از متن کیو حذف می‌شوند.
- دکمهٔ «شروع/توقف دوبله» در پاپ‌آپ اگر سرویس‌ورکر جواب نمی‌داد غیرفعال می‌ماند.
- در <span dir="ltr">`.github/release-notes.md`</span> یک <span dir="ltr">`div`</span> راست‌چینِ بسته‌نشده و راهنمای قدیمی مدل وجود داشت.

---

## [<span dir="ltr">1.2.0</span>] — ۹ آبان ۱۴۰۵

### افزوده شد

- **ولوم مستقل صدای اصلی** (<span dir="ltr">`originalVolume`</span>، ۰ تا ۱) که فقط روی پخش اعمال می‌شود. زنجیرهٔ پخش حالا <span dir="ltr">`sourceNode → originalGain → originalMonitorGain (ولوم کاربر) → destination`</span> است، پس شاخهٔ میکس <span dir="ltr">MP3</span> بی‌تأثیر می‌ماند.
- **ولوم مستقل صدای دوبله** (<span dir="ltr">`dubVolume`</span>، ۰ تا ۱٫۵) روی <span dir="ltr">`dubPlaybackGain`</span>.
- **به‌روزرسانی زندهٔ ولوم** — <span dir="ltr">`dp-volume-set`</span> (پاپ‌آپ) و <span dir="ltr">`dp-mini-volume`</span> (پنل روی ویدئو) با نام <span dir="ltr">`dp-off-volume`</span> به سند <span dir="ltr">offscreen</span> می‌رسند و بدون شروع دوبارهٔ جلسه اعمال می‌شوند.
- **دکمهٔ پنل سریع یوتیوب** (<span dir="ltr">`src/overlay/yt-controls.js`</span>) — دکمه‌ای که پیش از دکمهٔ تنظیمات (چرخ‌دنده) یوتیوب قرار می‌گیرد و مینی‌پنلی باز می‌کند: شروع/توقف دوبله، نمایش/پنهان‌کردن زیرنویس، ولوم صدای اصلی با کلید قطع، و ولوم دوبله. ظاهر در <span dir="ltr">Shadow DOM</span> است، رویدادهای کلید به میانبرهای یوتیوب نمی‌رسند و یک <span dir="ltr">`MutationObserver`</span> بعد از بازرسم پخش‌کننده دوباره آن را می‌چسباند. در تمام‌صفحه هم کار می‌کند.
- **نقاط پایانی سرویس‌ورکر برای پنل** — <span dir="ltr">`dp-mini-get`</span>، <span dir="ltr">`dp-mini-start`</span>، <span dir="ltr">`dp-mini-stop`</span>، <span dir="ltr">`dp-mini-stage`</span>، <span dir="ltr">`dp-mini-volume`</span>؛ خطاها از قبل بومی‌شده برمی‌گردند.
- **کارت ولوم صدا در پاپ‌آپ** با نمایش درصد و دکمهٔ قطع؛ اگر ولوم از پنل روی ویدئو عوض شود هم‌گام می‌ماند.
- تست‌های واحد برای <span dir="ltr">`clampVolume`</span>، مهاجرت تنظیمات (نسخهٔ ۱۰) و اتصال پنل سریع.

### تغییر کرد

- **«شروع دوبله» و «نمایش زیرنویس» به بالای پاپ‌آپ رفتند** — درست زیر نوار وضعیت و بالاتر از همهٔ بخش‌های جمع‌شو.
- **مانیفست** — نسخهٔ ۱٫۲٫۰؛ یک ورودی <span dir="ltr">`content_scripts`</span> و یک ورودی <span dir="ltr">`host_permissions`</span> برای <span dir="ltr">`https://www.youtube.com/*`</span> (چیز دیگری نه؛ همچنان نه <span dir="ltr">`<all_urls>`</span> و نه <span dir="ltr">`tabs`</span>). تست مانیفست و <span dir="ltr">`scripts/lint.mjs`</span> دقیقاً با همین مجموعه به‌روز شدند.

### رفع شد

- **صدای اصلی واقعاً کم یا قطع نمی‌شد.** فقط هنگام صحبت دوبله و با <span dir="ltr">`setTargetAtTime`</span> کم می‌شد، که به هدف نزدیک می‌شود ولی هرگز دقیقاً روی آن نمی‌نشیند، و در غیر آن حالت راهی برای کم‌کردنش نبود. حالا تغییر گین با رمپ خطی دقیق انجام می‌شود و ولوم کاربر گرهٔ جدا دارد، پس صفر سکوت واقعی است.

### نکته

- کروم ضبط صدای تب را فقط پس از فراخوانی افزونه روی همان تب (<span dir="ltr">`activeTab`</span>) اجازه می‌دهد. اگر «شروع دوبله» از پنل روی ویدئو همین را گزارش کرد، یک بار آن را از پاپ‌آپ همان تب بزن؛ بعد از آن دکمهٔ پنل هم کار می‌کند.

---

## [<span dir="ltr">1.0.1</span>] — ۲۷ شهریور ۱۴۰۵

### افزوده شد

- **صحنهٔ زیرنویس روی ویدئو** — یک <span dir="ltr">`div`</span> با <span dir="ltr">Shadow DOM</span> و یک فرزند <span dir="ltr">`<style>`</span>، که در لحظهٔ نیاز و از راه <span dir="ltr">`activeTab`</span> در همهٔ فریم‌ها تزریق می‌شود، پس پخش‌کنندهٔ توکار داخل <span dir="ltr">iframe</span> هم پوشش دارد. <span dir="ltr">CSS</span> سایت به آن نمی‌رسد، هیچ <span dir="ltr">`!important`</span> ندارد، و موقعیت‌دهی حیاتی به‌صورت سبک درون‌خطی هم نوشته می‌شود تا نبودِ ورقهٔ سبک نتواند متن را پنهان کند. موقعیت با <span dir="ltr">`ResizeObserver`</span> و <span dir="ltr">`IntersectionObserver`</span> و <span dir="ltr">`fullscreenchange`</span> دنبال می‌شود نه با حلقهٔ نظارت، و میزبان در تمام‌صفحه به داخل عنصر تمام‌صفحه منتقل می‌شود تا دیده بماند.
- **۶ قالب زیرنویس** — <span dir="ltr">`aurora`</span>، <span dir="ltr">`neon`</span>، <span dir="ltr">`cinema`</span>، <span dir="ltr">`ribbon`</span>، <span dir="ltr">`slate`</span> و <span dir="ltr">`paper`</span>، با انتخاب از تراشه‌های پیش‌نمایش در پاپ‌آپ و اعمال زنده وسط جلسه.
- **هایلایت پیش‌روندهٔ جمله** — بخش گفته‌شدهٔ کیو با <span dir="ltr">CSS Custom Highlight API</span> روی یک گرهٔ متنی رنگ می‌شود، و اگر مرورگر این <span dir="ltr">API</span> را نداشت به دو گرهٔ متنی برمی‌گردد. نه بازسازی <span dir="ltr">DOM</span> در هر فریم، نه از دست رفتن قابلیت انتخاب متن.
- **کشیدن با چسبیدن مغناطیسی** — دستگیره‌ای با <span dir="ltr">pointer capture</span> زیرنویس را جابه‌جا می‌کند و به ۹ لنگر می‌چسبد؛ موقعیت در تنظیمات ذخیره می‌شود.
- **تطبیق خودکار با روشنایی صحنه** — نمونهٔ <span dir="ltr">۲۴×۸</span> از فریمِ پشت کیو، پلاک را بین تیره و روشن عوض می‌کند. ویدئوی <span dir="ltr">cross-origin</span> که بوم را آلوده می‌کند، این قابلیت را خاموش می‌کند نه اینکه خطا بدهد.
- **بومی‌سازی راست‌چین** (<span dir="ltr">`src/bidi.js`</span>) — جهت پاراگراف از نخستین کاراکتر قوی گرفته می‌شود و تکه‌های لاتینِ داخل خط راست‌چین با جداسازهای <span dir="ltr">`U+2066`</span> و <span dir="ltr">`U+2069`</span> پیچیده می‌شوند. جداساز یونیکد به‌جای پیچیدن در <span dir="ltr">`<span dir="ltr">`</span>، چون هایلایت کارائوکه لازم دارد کیو یک گرهٔ متنی بماند. این جداسازها فقط برای نمایش‌اند و هرگز به فایل خروجی نمی‌رسند.
- **زیرنویس واقعی سایت** — سه لایهٔ کشف به ترتیب: فهرست زیرنویس خودِ پخش‌کننده، ردِ شبکه‌ای صفحه از راه <span dir="ltr">`performance.getEntriesByType("resource")`</span>، و <span dir="ltr">`video.textTracks`</span> در حالت <span dir="ltr">`hidden`</span> که پارسر <span dir="ltr">WebVTT</span> مرورگر می‌خواند. هر چهار قالب <span dir="ltr">json3</span> و <span dir="ltr">TTML</span> و <span dir="ltr">WebVTT</span> و <span dir="ltr">SRT</span> پارس می‌شوند، خطوط تکراری زیرنویس غلتان حذف و تکه‌های کوتاه زیرنویس خودکار به جمله تبدیل می‌شوند.
- **جلسهٔ فقط زیرنویس** — دکمهٔ دوم صحنه را بدون گرفتن صدای تب و بدون دوبله شروع می‌کند و کیوها را با تایم‌کد واقعی ویدئو به <span dir="ltr">SRT</span> یا <span dir="ltr">VTT</span> می‌دهد، از خودِ سرویس‌ورکر و با یک <span dir="ltr">data URL</span> پایه‌۶۴.
- **حافظهٔ ترجمه** — <span dir="ltr">IndexedDB</span> با دو انبار: ترجمهٔ تک‌خط که بین ویدئوها مشترک است، و یک رکورد برای کل زیرنویس یک ویدئو برای بازتماشای فوری. کلیدها هش می‌شوند و متن مبدأ کنارش ذخیره می‌شود، پس برخورد هش هرگز به ترجمهٔ غلط تبدیل نمی‌شود. پاک‌سازی <span dir="ltr">LRU</span> سقف را روی ۴۰٬۰۰۰ خط و ۸۰ ویدئو نگه می‌دارد.
- **زبان مبدأ خودکار، و لحن به انتخاب تو** — زبان مبدأ را مدل تشخیص می‌دهد، پس فهرست انتخاب زبان مبدأ ارائه نشده است. یک فهرست کشویی زبان مقصد را تعیین می‌کند و یک کادر متن آزاد به‌عنوان دستور سبک به دستور سیستمی اضافه می‌شود، پس از کوتاه و یکدست‌شدن. لحن بخشی از کلید حافظه است، چون ترجمهٔ محاوره‌ای همان رکورد ترجمهٔ رسمی نیست.
- **ترجمهٔ ساختارمند زیرنویس** — یک مدل متنی با <span dir="ltr">`responseMimeType: application/json`</span> و <span dir="ltr">`responseSchema`</span> صدا زده می‌شود، با بسته‌بندی بر پایهٔ تعداد خط و بودجهٔ کاراکتر، سه درخواست همزمان و عقب‌نشینی نمایی روی <span dir="ltr">429</span> و <span dir="ltr">5xx</span>.
- **نام مدلی که نمی‌پوسد** — پیش‌فرض، نام مستعار بی‌تاریخ <span dir="ltr">`gemini-flash-latest`</span> است. روی <span dir="ltr">404</span> کلاینت فهرست نامزدها را طی می‌کند و اگر تمام شد، از سرویس می‌پرسد این کلید به چه مدل‌هایی دسترسی دارد و مناسب‌ترین را برمی‌دارد. کاربر لازم نیست هیچ نام مدلی بداند.
- **تست کلید API** — یک درخواست کوچک <span dir="ltr">`generateContent`</span> تفاوت کلید سالم، کلید ردشده، سهمیهٔ تمام‌شده (با همان <span dir="ltr">`retryDelay`</span>ِ سرویس) و مدل ناموجود را روشن می‌کند و نامزدها را تا رسیدن به جواب طی می‌کند.
- **امتحان مدل‌ها برای مسیر زیرنویس** — <span dir="ltr">`ListModels`</span> می‌گوید سرویس چه دارد، نه اینکه کلید سطح رایگان چه چیزی را می‌تواند صدا بزند. هر نامزد با یک درخواست یک‌توکنی امتحان می‌شود و فقط مدل‌هایی که جواب دادند پیشنهاد می‌شوند، کم‌مصرف‌ترین اول؛ با نخستین رد شدن سهمیه، امتحان متوقف می‌شود تا باقی‌ماندهٔ سهمیه نسوزد.
- **مانیتور توکن و سهمیه**، پورت‌شده از <span dir="ltr">`core/TokenUsage.kt`</span>ِ نسخهٔ اندروید: بلوک <span dir="ltr">`usageMetadata`</span>ِ هر پاسخ (هم سوکت زنده و هم درخواست زیرنویس) در هر دو نگارش <span dir="ltr">camelCase</span> و <span dir="ltr">snake_case</span> پارس می‌شود، به‌تفکیک مودالیتی جدا می‌شود، روزبه‌روز به وقت پسیفیک در <span dir="ltr">`chrome.storage.local`</span> می‌نشیند، ۱۴ روز نگه داشته می‌شود و با سقف روزانه‌ای که کاربر از <span dir="ltr">AI Studio</span> وارد می‌کند مقایسه می‌شود. <span dir="ltr">۴۲۹</span> پیام و زمان تلاش مجددش را ذخیره می‌کند. مرز روز پسیفیک با <span dir="ltr">`Intl`</span> حساب می‌شود نه با آفست ثابت، پس ساعت تابستانی درست درمی‌آید.
- **رفتار درست با سقف نرخ، نه تلاش کورکورانه** — بسته‌ها ۸۰ خط دارند نه ۴۰، پس تعداد درخواست همان زیرنویس نصف می‌شود. <span dir="ltr">۴۲۹</span> تعداد درخواست همزمان را به یک می‌آورد، همهٔ کارگرها را روی یک دروازهٔ نرخ مشترک دقیقاً به اندازهٔ تأخیر خواسته‌شده نگه می‌دارد و بعد از دومین رد شدن دست می‌کشد. هرچه ترجمه شده نگه داشته و به‌صورت «نیمه‌کاره با ذکر تعداد خطوط باقی‌مانده» گزارش می‌شود، نه اینکه بی‌صدا تمام‌شده جا بزند.
- **هر دو دکمهٔ کنش با هم** — دکمهٔ زیرنویس داخل بخشی بود که پیش‌فرض بسته است، و همین مسیر دوم را کامل پنهان می‌کرد. حالا مستقیم زیر دکمهٔ دوبله و با رنگ خودش نشسته، با یک خط توضیح که این دو مستقل‌اند.
- **ترجمهٔ زنده برای ویدئوی بی‌زیرنویس** — موتور صوتی با صدای دوبلهٔ بی‌صدا و بدون فایل صوتی روشن می‌شود، پس صدای تب رونویسی و ترجمه و به‌صورت زیرنویس زنده روی تصویر نوشته می‌شود. یک سوییچ است، چون این مسیر برخلاف مسیر زیرنویس سهمیهٔ <span dir="ltr">Live API</span> مصرف می‌کند.
- **ادامهٔ خودکار برای ویدئوی بعدی** — با روشن بودن این سوییچ، پس از عوض شدن ویدئو کلیپ تازه خودش گرفته و ترجمه می‌شود، با یک مکث کوتاه و یک تلاش دوم، چون پخش‌کننده‌ای که تازه راه افتاده فهرست زیرنویسش آماده نیست. تلاش خودکار اگر خودت وسطش جلسه‌ای شروع کرده باشی کنار می‌کشد، و وقتی هیچ جلسه‌ای در جریان نبوده اصلاً اجرا نمی‌شود.

- **متن زندهٔ غلتان** — تکه‌های دوبله تا مرز جمله به هم می‌چسبند و طولشان سقف می‌خورد، پس خط روی ویدئو مثل یک جمله خوانده می‌شود نه کلمه‌به‌کلمه لرزان.

- **سوییچ زبان اصلی** — کیو هم ترجمه را دارد و هم متن مبدأ، هر دو از پیش در سرویس‌ورکر برای جهت دوسویه آماده شده‌اند، پس زدن سوییچ خط را در فریم بعدی با جهت خواندن درست عوض می‌کند و هیچ درخواست تازه‌ای لازم نیست. کیویی که متن مبدأ ندارد به ترجمه برمی‌گردد نه اینکه خالی شود، و هایلایت کارائوکه هنگام نمایش متن اصلی متوقف می‌شود، چون پیشرفتش بر اساس خط ترجمه‌شده اندازه‌گیری می‌شود.
- **رنگ دلخواه پلاک و هایلایت** — <span dir="ltr">`--dp-plate-user`</span> و <span dir="ltr">`--dp-spoken-user`</span> روی میزبان سایه می‌نشینند و هر قاعدهٔ قالب آن‌ها را با <span dir="ltr">`var(--dp-plate-user, <مقدار قالب>)`</span> می‌خواند، پس رنگ انتخابی بر قالب می‌چربد و برداشتنش کنترل را همان لحظه به قالب برمی‌گرداند. رنگ‌گزین مرورگر آلفا ندارد، پس رنگ پلاک با یک لغزندهٔ شفافیت جدا به یک مقدار <span dir="ltr">`rgba()`</span> تبدیل می‌شود.
- **فهرست قالب خوانا** — تراشه‌ها هر کدام در یک ردیف و با یک جملهٔ نمونهٔ کامل‌اند و رنگ دلخواه را هم پیش‌نمایش می‌دهند، نه فقط رنگ خودِ قالب.
- **بخش‌های جمع‌شوی پاپ‌آپ** — هر بلوک یک عنصر <span dir="ltr">`<details>`</span> است، پیش‌فرض بسته، و مجموعهٔ بخش‌های باز در تنظیمات ذخیره می‌شود.

### اصلاح شد

- **شکست ترجمه دیده نمی‌شد.** هر بستهٔ شکست‌خورده به متن مبدأ برمی‌گشت و هیچ خطایی بالا نمی‌رفت، پس مدل خراب یا کلید ردشده به‌شکل یک زیرنویس کاملاً سالمِ *ترجمه‌نشده* ظاهر می‌شد. نتیجهٔ بسته‌ها حالا شمرده می‌شود و اگر هیچ بسته‌ای موفق نشود، خطا بالا می‌رود و در پاپ‌آپ گزارش می‌شود.
- **یوتیوب تا وقتی CC روشن نبود فهرست زیرنویسش را نمی‌ساخت.** این دلیل واقعیِ آن بود که ویدئویی با زیرنویس مدام گزارش می‌کرد زیرنویس ندارد: <span dir="ltr">`captionTracks`</span> تا وقتی بیننده زیرنویس را روشن نکند اصلاً در پاسخ پخش‌کننده وجود ندارد، پس هیچ صبر و تکراری نمی‌توانست چیزی را پیدا کند که هنوز نبود. دکمهٔ زیرنویس حالا پیش از جست‌وجو CC خودِ پخش‌کننده را روشن می‌کند، فایل زیرنویس گرفته می‌شود و CC بلافاصله خاموش می‌شود — پیش از ترجمه، پس زیرنویس خودِ پخش‌کننده فقط یک لحظه دیده می‌شود نه در تمام مدت کار. از همان دکمه‌ای استفاده می‌کند که خودت می‌زدی و در صورت نشدن به <span dir="ltr">`setOption("captions", "track", …)`</span> پخش‌کننده برمی‌گردد، و فقط چیزی را که خودش عوض کرده برمی‌گرداند: زیرنویسی که خودت روشن گذاشته بودی روشن می‌ماند. کل این رفتار قابل خاموش‌کردن است.
- **زیرنویس موجود، «ناموجود» گزارش می‌شد.** پخش‌کننده‌ای که تازه راه افتاده هنوز <span dir="ltr">`captionTracks`</span> را در پاسخ پخش‌کننده ندارد، و کشف یک بار نگاه می‌کرد و رد می‌شد؛ پس ویدئویی با زیرنویس کاملاً سالم «بدون زیرنویس» اعلام می‌شد — تا اینکه چند تلاش دستی تصادفاً به لحظهٔ درست می‌خورد. خوانندهٔ تزریق‌شده حالا داخل خودِ صفحه و با گام‌های کوتاه منتظر فهرست زیرنویس می‌ماند و در میانهٔ راه از پخش‌کننده می‌خواهد ماژول زیرنویس خودش را بارگذاری کند، که همین باعث می‌شود درخواست <span dir="ltr">`timedtext`</span> زده شود و لایهٔ ردِ شبکه‌ای ببیندش. خط تولید کل کشف سه‌لایه را پنج بار در حدود هفت ثانیه تکرار می‌کند و به پاپ‌آپ می‌گوید در تلاش چندم است. صفحه هم «پخش‌کننده آماده نیست» را از «فهرست خالی است» جدا می‌کند، پس ویدئویی که واقعاً زیرنویس ندارد هم سریع شناخته می‌شود. همهٔ این‌ها فقط از صفحه می‌خوانند و هیچ درخواست <span dir="ltr">API</span> هزینه نمی‌کنند، و پخش‌کننده‌ای که از قبل آماده باشد در نخستین تلاشِ بی‌تأخیر جواب می‌گیرد.
- **زیرنویس ویدئوی قبلی روی ویدئوی بعدی می‌ماند.** در سایتی که بدون بارگذاری دوباره جابه‌جا می‌شود — و یوتیوب نمونهٔ روشنش است — نشانی با <span dir="ltr">`pushState`</span> عوض می‌شود، همان عنصر <span dir="ltr">`<video>`</span> دوباره استفاده می‌شود و اسکریپت تزریق‌شده زنده می‌ماند، پس فهرست کیوهایش به کلیپ بعدی می‌رسید. هیچ چیز پاکش نمی‌کرد: شنوندهٔ <span dir="ltr">`tabs.onUpdated`</span> در سرویس‌ورکر فقط وضعیت خودش را صفر می‌کرد و هرگز به صفحه چیزی نمی‌گفت، و ورکر <span dir="ltr">MV3</span> در آن لحظه ممکن است کلاً خواب باشد. تشخیص حالا در خودِ صحنه است که تنها بخشِ همیشه‌زنده است. از چهار نشانهٔ مستقل اثر انگشت می‌سازد — شناسهٔ ویدئو در نشانی (یا مسیر صفحه)، عنوان صفحه پس از حذف شمارندهٔ اعلان و نام سرویس، <span dir="ltr">`currentSrc`</span> که در پخش‌کنندهٔ <span dir="ltr">MSE</span> برای هر ویدئو تازه است، و مدت ویدئو گرد‌شده به ثانیه — و همین که تفاوتی ببیند کیوها را دور می‌ریزد. بررسی روی همان رویدادهایی که خودِ پلتفرم می‌فرستد انجام می‌شود (<span dir="ltr">`emptied`</span>، <span dir="ltr">`loadstart`</span>، <span dir="ltr">`loadedmetadata`</span>، <span dir="ltr">`durationchange`</span>)، روی <span dir="ltr">Navigation API</span> با <span dir="ltr">`popstate`</span> و <span dir="ltr">`hashchange`</span> به‌عنوان پشتیبان، و به‌صورت یک مقایسهٔ رشته هر ۴۰۰ میلی‌ثانیه در حلقهٔ رندر برای پخش‌کننده‌هایی که هیچ چیز اعلام نمی‌کنند. خطای مثبت کاذب بی‌خطر است: همان ویدئو مستقیم از حافظهٔ ترجمه برمی‌گردد، بی‌هیچ درخواستی. سرویس‌ورکر هم با همین سیگنال کیوهای ذخیره‌شده‌اش را دور می‌ریزد، پس «ذخیرهٔ این زیرنویس» دیگر فایل ویدئوی قبلی را نمی‌نویسد.
- **تغییر تنظیمات تا بازسازی کل زیرنویس به ویدئو نمی‌رسید.** تابع <span dir="ltr">`pushStageConfig`</span> تنظیمات تازه را فقط به شناسه‌های تبی می‌فرستاد که در حافظه داشت، و سرویس‌ورکر <span dir="ltr">MV3</span> بعد از کمی بی‌کاری کشته می‌شود و با آن هم <span dir="ltr">`stagedTabs`</span> خالی می‌شود و هم <span dir="ltr">`state.stageTabId`</span>. پس پیام هیچ هدفی نداشت و <span dir="ltr">`tellStage`</span> خطا را می‌بلعید؛ در نتیجه عوض کردن قالب مثل بی‌اثر بودن دیده می‌شد و کاربر مجبور بود دکمه را دوباره بزند و هزینهٔ ترجمهٔ تازه بدهد. حالا تبِ فعال همیشه یکی از هدف‌هاست، پس تغییر زنده می‌رسد، چه ورکر تازه راه افتاده باشد و چه نه.
- **پاسخ بریده‌شده حالا بسته را نصف می‌کند، نه اینکه دست بکشد.** بستهٔ بزرگ یعنی درخواست کمتر، ولی اگر ترجمه بلندتر از سقف توکن خروجی دربیاید پاسخ وسط <span dir="ltr">JSON</span> بریده می‌شود، و قبلاً همین کل بسته را به متن مبدأ ترجمه‌نشده برمی‌گرداند. نشانهٔ <span dir="ltr">`finishReason: MAX_TOKENS`</span> بسته را نصف می‌کند و هر نیمه را دوباره می‌فرستد. تقسیم فقط تا وقتی ادامه می‌یابد که مدرکی باشد بسته‌های کوچک‌تر عبور می‌کنند: اگر بسته‌ای تا انتها شکست بخورد و تا آن لحظه هیچ بسته‌ای موفق نشده باشد، مشکل اندازه نیست، پس تلاش متوقف می‌شود و سهمیهٔ باقی‌مانده صرفش نمی‌شود.
- **ترجمهٔ نیمه‌کاره دیگر به‌جای کامل کش نمی‌شود.** وقتی سهمیه وسط کار تمام می‌شد، همان زیرنویس نیمه‌کاره در حافظهٔ ترجمه نوشته می‌شد و تلاش بعدی از مسیر سریع همان نیمه‌کاره را برمی‌گرداند — پس خطوط جامانده هرگز کامل نمی‌شدند. حالا فقط زیرنویس کاملاً ترجمه‌شده ذخیره می‌شود، و چون خطوط موفق در حافظهٔ تک‌خطی هستند، تلاش بعدی فقط هزینهٔ همان خطوط باقی‌مانده را می‌دهد.
- **حذف تکرار در زیرنویس غلتان** با باقی‌ماندهٔ کوتاه‌شدهٔ کیوی قبلی مقایسه می‌شد نه با متن کاملش، پس فقط یک پله پاک می‌شد و خطوط بعدی کامل تکرار می‌شدند.
- **پایهٔ شماره‌گذاری پاسخ ترجمه** از اولین برخورد انتخاب می‌شد و پاسخ یک‌مبنا روی خانه‌های صفرمبنا هم برخورد اتفاقی دارد، که یک خط را تکرار می‌کرد. پایه حالا با شمردن برخوردها انتخاب می‌شود.
- **قالب شفق هیچ‌وقت انیمیشن نداشت.** کلیدفریم‌هایش یک متغیر ثبت‌شده با <span dir="ltr">`@property`</span> را انیمیت می‌کردند و آن ثبت داخل ورقهٔ سبک یک <span dir="ltr">Shadow DOM</span> نادیده گرفته می‌شود. حالا خودِ عنصر می‌چرخد.

### تغییر کرد

- **یک خط روی ویدئو، نه دو خط.** جعبهٔ دومی که متن مبدأ را تکرار می‌کرد بخش بزرگی از تصویر را می‌گرفت و کاربرد کمی داشت، پس حذف شد. زبان اصلی همچنان به‌صورت فایل زیرنویس دوم اختیاری در دسترس است.
- **نسخهٔ ۵ تنظیمات** — صحنه، مسیر زیرنویس سایت، حافظهٔ ترجمه و کادر لحن اضافه شدند و پیش‌فرض روشن‌اند؛ انتخاب دستی زبان مبدأ و سوییچ خط زبان اصلی حذف و بی‌صدا مهاجرت می‌کنند.
- **لینت** — قاعدهٔ تازه بررسی می‌کند که هر فایل فهرست‌شده در <span dir="ltr">`STAGE_FILES`</span> وجود دارد و چون این فایل‌ها به‌صورت اسکریپت کلاسیک تزریق می‌شوند، هیچ <span dir="ltr">`import`</span> و <span dir="ltr">`export`</span> ندارند.

---

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

[1.3.0]: https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.3.0
[1.2.0]: https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.2.0
[1.0.1]: https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.0.1
[1.0.0]: https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.0.0
