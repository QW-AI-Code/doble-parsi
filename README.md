<div align="center">

<img src="assets/icons/icon128.png" width="88" height="88" alt="Doble Parsi" />

# Doble Parsi — دوبله پارسی

[![version](https://img.shields.io/badge/version-1.0.0-3b6dff)](https://github.com/QW-AI-Code/doble-parsi/releases/tag/v1.0.0)
[![license](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)
[![build](https://github.com/QW-AI-Code/doble-parsi/actions/workflows/build.yml/badge.svg)](https://github.com/QW-AI-Code/doble-parsi/actions/workflows/build.yml)
[![manifest](https://img.shields.io/badge/manifest-v3-8b5cf6)](manifest.json)

**Dub the audio of any browser tab live with AI, then keep the MP3 and the SRT/VTT subtitles named exactly after the video.**

**English** · [فارسی](README.fa.md)

</div>

---

## What's new — v1.0.0

- **Live tab dubbing** — capture the active tab's sound, translate it as it plays and hear the dub with a delay of a couple of seconds.
- **The original speaker's voice** — the live translation model reproduces the speaker's own voice, so there is no voice picker to get wrong.
- **31 dubbing languages** — Persian is the default; Arabic, Turkish, Azerbaijani, English, German, French, Chinese, Japanese and 23 more are one dropdown away.
- **MP3 export** — dub only, or dub mixed with the original track, at 96 / 128 / 192 kbps.
- **SRT / VTT subtitles** — timed from the live transcript, with an adjustable delay offset and an optional second file in the source language.
- **Files named after the video** — the real video title is read from the page, cleaned up, and used for both the folder and the file names.
- **Tidy downloads** — every session lands in `Downloads/Doble Parsi/<video name>/`, and the `.srt` extension is never rewritten by the browser.
- **Bilingual interface** — Persian (RTL) and English (LTR) switch instantly, with the Vazirmatn font bundled so nothing loads from the internet.
- **Click-free audio path** — a ring-buffer player worklet plus Kaiser-windowed sinc resampling replaced the old per-chunk playback, and the encoder is fed proper 16-bit samples, so the recording no longer contains crackle or white noise.
- **Self-healing sessions** — the socket reconnects and resumes on its own, and the session closes and still saves your files if the tab goes away.

## Features

- **Tab audio capture** — `tabCapture` grabs the active tab's stream inside an offscreen document, so nothing is injected into the page and playback keeps running.
- **Real-time AI dubbing** — mono 16 kHz PCM goes up over one WebSocket, 24 kHz PCM comes back down, and both directions are transcribed.
- **Voice reproduction** — the translation model imitates the original speaker; a voice setting would be ignored by the service, so it is not offered.
- **31 target languages** — a single dropdown, labelled in the interface language you picked.
- **Live dub playback** — the dub plays over the page audio through a continuous ring buffer with a 180 ms anti-jitter prebuffer and 2 ms fades, so chunk borders are silent.
- **Automatic ducking** — the original track drops to your chosen level while the dub speaks and eases back up 420 ms after it stops.
- **MP3 recording** — encoded off the main thread, mono, at the audio context's own rate; the recording tap sits before the playback gain, so muting live playback does not produce a silent file.
- **Clean recording levels** — a soft limiter starting at −1 dBFS and an explicit 16-bit conversion keep the encoder from clipping or misreading the buffer.
- **Subtitle builder** — cues close on sentence ends, on 140 characters, on 7 seconds, or after 900 ms of silence; overlaps are repaired and short cues get a 700 ms floor.
- **Subtitle formats** — SRT (with a BOM so Persian shows correctly everywhere), WebVTT, or both at once.
- **Source-language subtitles** — an optional `<name>.original.srt` next to the dubbed one, timed without the dub offset.
- **Delay compensation** — one field shifts every cue earlier by 0 to 6000 ms (default 1200 ms) to line the text up with the picture.
- **Video-accurate naming** — the title is taken from media session metadata, then `og:title`, then the player heading, then the video element, then the tab title.
- **Title clean-up** — unread-notification counters like `(3)`, play glyphs, site brands taken from a known list *and* from the host name, and trailing junk like `1080p` are stripped; illegal characters are replaced and the name is clamped to 90 characters.
- **Enforced download path** — the final relative path is forced during Chrome's filename event, so you never get a random UUID name or a rewritten extension.
- **Live session panel** — dub caption, source caption, cue counter, recorded-audio meter, elapsed timer and a `REC` badge on the toolbar icon.
- **Transcript tools** — copy the whole dub transcript to the clipboard, or jump straight to the downloads folder.
- **Bilingual UI with real RTL** — direction, layout, toggle labels and Persian digits all follow the chosen language.
- **Offline typography** — Vazirmatn ships inside the extension; no font, script or style is fetched at runtime.
- **Settings that persist and migrate** — everything is stored locally and older stored settings are upgraded silently on load.
- **Resilient connection** — audio recorded before the socket is ready is queued, `goAway` warnings trigger an early reconnect, and resumption handles continue the same session.
- **Automatic stop** — closing the tab or ending the captured stream stops the session and still writes the outputs.
- **Interruption handling** — when the model cuts its turn short, the byte carry and resampler state reset so the next sample cannot land on a wrong offset.
- **High-quality resampling** — 32-tap, 512-subphase windowed sinc in both directions, with continuous state across chunks.
- **Honest error reporting** — every failure and warning (silent recording, clipping, dropped audio, empty subtitles, API errors) is shown in your language instead of being swallowed.
- **Advanced controls** — override the model id, set the ducking level, or turn off video-based naming.

## Install

### Easy installation in Chrome / Edge (Recommended)

1. **Download the extension:** Download `doble-parsi-1.0.0-chrome.zip` from the top of the [Releases page](https://github.com/QW-AI-Code/doble-parsi/releases).
2. **Unzip the file:** Right-click the downloaded zip file and select **Extract All...** (or Unzip). You will get a regular folder containing the extension files (such as `manifest.json`, `src/`, etc.).
3. **Open Extensions page in Chrome:** In your Chrome browser address bar, type `chrome://extensions` and press Enter. (For Microsoft Edge, go to `edge://extensions`).
4. **Enable Developer mode:** Look at the top-right corner of the page and turn ON the toggle switch for **Developer mode**.
5. **Load the extension:** Click the **Load unpacked** button in the top-left corner. In the file picker window, select the unzipped folder and click **Select Folder**.
6. **Pin the extension icon:** Click the puzzle piece icon (Extensions) next to your browser address bar and click the Pin icon next to **Doble Parsi** so it's always accessible.

That's it! The extension is now installed and ready to use.

### From source

```bash
git clone https://github.com/QW-AI-Code/doble-parsi.git
cd doble-parsi
npm install
npm run build
```

`npm run build` writes the loadable folder to `dist/doble-parsi/` and the packaged archive to `dist/doble-parsi-1.0.0-chrome.zip`. Load the folder with **Load unpacked**.

## How to use

1. **Get your free Gemini API key:** Head over to [Google AI Studio](https://aistudio.google.com/apikey) and create a free API key. You only need to do this once. The key stays completely private inside your own browser and is never sent anywhere else.
2. **Open your video or audio tab:** Go to YouTube, Aparat, Coursera, a podcast, an online meeting, or any tab you want translated and hit play.
3. **Open Doble Parsi:** Click the extension icon in your browser toolbar, paste your API key in the top box (it saves automatically), and select your desired dubbing language (Persian is selected by default).
4. **Choose what you want:** Turn on live playback to hear the dub in real time, enable MP3 export if you want the audio file saved, and enable subtitles (SRT / VTT) if you want text transcripts timed to the video.
5. **Click "Start dubbing":** The status turns blue (*Dubbing*), a `REC` badge appears on the extension icon, and you will hear the real-time dub playing over the original video with automatic volume ducking.
6. **Click "Stop and save":** When you're done watching, click the button again. The extension cleanly wraps up the session, generates the audio and subtitle files, and saves them directly to your computer.
7. **Find your downloads:** Everything is saved neatly in your Downloads folder inside a dedicated folder named after the video:

```
Downloads/
└── Doble Parsi/
    └── Interstellar Docking Scene/
        ├── Interstellar Docking Scene.mp3
        ├── Interstellar Docking Scene.srt
        └── Interstellar Docking Scene.original.srt   ← source language, optional
```

Tip: keep the dubbed tab in the foreground. Chrome throttles background tabs, which can starve the audio pipeline.

## Settings

| Setting | What it does |
| --- | --- |
| **Gemini API key** | Your key for the live translation service. Stored locally with `chrome.storage.local`, never synced, never sent anywhere except the AI endpoint. |
| **Dubbing language** | The language you want to hear and read. 31 options, Persian by default. |
| **Live dub playback** | Plays the dub through your speakers while you watch. Turn it off to record silently. |
| **Duck original audio** | Lowers the original track while the dub speaks. Only active when live playback is on. |
| **Save MP3 file** | Writes an MP3 of the session when you stop. |
| **File content** | *Dub + original (mix)* keeps both, *Dub only* keeps just the dubbed voice. |
| **Quality** | MP3 bitrate: 96, 128 (default) or 192 kbps. |
| **Save subtitles** | Writes a timed subtitle file built from the dub transcript. |
| **Format** | `SRT`, `VTT`, or both. |
| **Delay offset (ms)** | Shifts every cue earlier to compensate for dubbing latency. Default 1200 ms, range 0–6000. |
| **Also save source-language subtitles** | Adds a second `.original.srt` / `.vtt` with the original speech. |
| **Match the original video name** | On: files carry the video's own name. Off: a timestamp is appended. |
| **Translation model** | The live model id. Change it only if the default stops working. |
| **Original volume while dubbing** | The ducking floor, 0 to 0.6 (default 0.12). |
| **فا / EN** | Interface language and direction. Persian is the default. |

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `tabCapture` | The whole point: it provides the audio stream of the tab you are dubbing. |
| `offscreen` | Audio capture, playback, MP3 encoding and subtitle building run in an offscreen document, because a service worker cannot own an audio graph. |
| `activeTab` | Grants one-off access to the tab you started dubbing on, only after you click the extension. |
| `scripting` | Runs one small function in that tab to read the real video title (media session, `og:title`, player heading). It reads metadata and changes nothing. |
| `downloads` | Saves the MP3 and subtitle files. |
| `storage` | Keeps your settings in `local` and the live session snapshot in `session`. |
| `https://generativelanguage.googleapis.com/*` | The only remote host: the live translation endpoint. |

There is no `tabs` permission, no `<all_urls>`, no content script and no web-accessible resource.

## Security audit

| Area | Result |
| --- | --- |
| Remote code | None. No CDN, no remote script, no `eval`, no `new Function`. CSP is `script-src 'self' 'wasm-unsafe-eval'`. |
| Network destinations | Exactly one: the AI live endpoint declared in `host_permissions`. No analytics, no telemetry, no error reporting. |
| API key handling | Stored in `chrome.storage.local` on this device, hidden behind a password field, sent only to the AI endpoint over TLS. Never synced, never logged. |
| Host access | No `<all_urls>`. Page access is limited to `activeTab`, granted only when you click the extension. |
| Injected script | One function, metadata only. It reads titles, writes nothing and stays out of the page after it returns. |
| File writes | Only through `chrome.downloads`. Paths are sanitised twice, control and illegal characters removed, `..` segments dropped, so writes cannot leave the downloads folder. |
| Bundled encoder | A pre-built WebAssembly MP3 encoder under MPL-2.0, running in a dedicated worker with no network access. It only ever receives PCM samples. Its licence text ships in `src/vendor/`. |
| Third-party runtime dependencies | None. `dependencies` and `devDependencies` are empty; the build, lint and test tooling is plain Node.js. |
| DOM handling | Every UI string is set with `textContent`; there is no `innerHTML` assignment anywhere. |
| Data retention | Nothing leaves your machine except the audio stream sent for translation. The session snapshot lives in `storage.session` and is cleared on browser start; the transcript is only in memory. |
| Supply chain | `npm install` pulls nothing. Release artifacts are built by a pinned workflow and published with a SHA-256 checksum file. |

## Troubleshooting & FAQ

**“This page cannot be captured.”** You are on a `chrome://`, extension or `view-source:` page. Switch to a normal site.

**Nothing happens / “Could not reach the AI service.”** The key is wrong, expired, or your network blocks the endpoint. Paste the key again and retry.

**The MP3 is silent.** Live playback was off while the file content was set to *mix*. Set **File content** to *Dub only*, or turn live playback back on.

**The subtitles are ahead of or behind the picture.** Raise or lower **Delay offset**. 1200 ms suits most videos; heavy accents and fast speech need more.

**Files land with a random name.** Reload the extension after updating so the new permissions apply, and keep **Match the original video name** on.

**The dub cuts out for a moment.** The connection stalled. It reconnects on its own; a warning after the session tells you how much audio did not fit.

**Can I dub a meeting?** Yes, any tab with audio works, including web meetings. Recording other people may need their consent where you live.

**Does it work without internet?** No. Translation happens in the cloud. Everything else (encoding, subtitles, fonts) is local.

**Is my audio stored anywhere?** Not by this extension. It streams to the AI endpoint and is never written to disk except in the MP3 you asked for.

**Which browsers?** Chromium 116 and newer: Chrome, Edge, Brave, Vivaldi, Opera.

## Project layout

```
manifest.json            Manifest V3, localised strings, permissions
package.json             version, scripts (lint / test / build)
_locales/{en,fa}/        manifest-level strings for both languages
assets/icons/            16 / 32 / 48 / 128 px icons
assets/fonts/            Vazirmatn (bundled, no network)
src/
  popup.*                interface: markup, styles, logic
  i18n.js                runtime Persian/English dictionary
  languages.js           dubbing target languages
  filenames.js           title clean-up, naming, download paths
  defaults.js            settings and migrations
  live-client.js         WebSocket client for the live AI session
  offscreen.*            audio engine: capture, playback, recording
  service-worker.js      coordinator, download naming
  captions.js            cue builder, SRT/VTT writers
  pcm.js                 PCM helpers, limiter, 16-bit conversion
  resampler.js           windowed-sinc resampler
  mp3-recorder.js        MP3 encoding off the main thread
  audio/                 AudioWorklets: capture tap, ring-buffer player
  vendor/                pre-built MP3 encoder (MPL-2.0) and its licence
scripts/                 build, packaging and lint tooling
test/                    unit tests (node --test)
docs/screenshots/        images used by both READMEs
.github/                 release notes and CI workflows
```

## Publish your own copy

```bash
git init && git add . && git commit -m "chore: release 1.0.0"
git branch -M main
git remote add origin https://github.com/<user>/doble-parsi.git
git push -u origin main
git tag v1.0.0 && git push origin v1.0.0
```

Pushing the tag runs `release.yml`, which builds the extension, writes `checksums.txt`, adds a `.crx` if a signing key is stored in secrets, and publishes a GitHub release whose body comes from `.github/release-notes.md`.

## Contributing

Issues and pull requests are welcome. Before opening a PR run:

```bash
npm run verify   # lint + tests + build
```

Rules that keep the project consistent: user-facing strings go into **both** languages, a new permission must be explained in **both** READMEs and in the release notes, and any version bump has to be applied to `manifest.json`, `package.json`, both READMEs, `CHANGELOG.md` and `.github/release-notes.md` at the same time.

## License

Released under the [MIT License](LICENSE) © 2026 QW-AI-Code. The bundled MP3 encoder is covered by MPL-2.0; its licence text sits next to it in `src/vendor/`.

## Support

- Bugs and ideas: [GitHub issues](https://github.com/QW-AI-Code/doble-parsi/issues)
- Security reports: see [SECURITY.md](SECURITY.md)
- Author: [QW-AI-Code](https://github.com/QW-AI-Code)
