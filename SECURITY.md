# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.0 | ✅ |
| < 1.0.0 | ❌ |

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

1. Open a private report through GitHub Security Advisories on the
   [repository](https://github.com/QW-AI-Code/doble-parsi/security/advisories/new), or
2. contact the author through the profile at [QW-AI-Code](https://github.com/QW-AI-Code).

Include the extension version, your browser version, reproduction steps and the
impact you believe it has. Expect a first reply within 7 days and, for confirmed
issues, a patch release within 30 days. Please give us that window before
disclosing publicly.

## What this extension does with your data

- **Your API key** is stored with `chrome.storage.local` on your own device. It is
  never synced, never logged and never sent anywhere except the AI endpoint.
- **Tab audio** is streamed over TLS to the single declared endpoint,
  `https://generativelanguage.googleapis.com`, for translation. It is not stored by
  the extension.
- **Transcripts** live in memory for the duration of a session. The session
  snapshot in `chrome.storage.session` is cleared when the browser restarts.
- **Files** are written only through `chrome.downloads`, inside your downloads
  folder, under `Doble Parsi/`.
- **No telemetry.** No analytics, no crash reporting, no remote configuration.

## Hardening in place

- Manifest V3 with a strict CSP: `script-src 'self' 'wasm-unsafe-eval'`. No remote
  code, no `eval`, no `new Function`.
- No `<all_urls>`, no `tabs` permission, no content scripts, no web-accessible
  resources. Page access comes from `activeTab` only, after you click the icon.
- The one injected function reads title metadata and writes nothing.
- Download paths are sanitised twice: illegal and control characters are removed
  and `..` segments are dropped, so a crafted video title cannot escape the
  downloads folder.
- Zero runtime dependencies. The only bundled third-party artifact is a pre-built
  WebAssembly MP3 encoder under MPL-2.0, running in a worker with no network access.

## Out of scope

- Behaviour of the remote AI service itself.
- Legal use of recordings. Recording other people may require their consent where
  you live.
- Forks and modified builds.
