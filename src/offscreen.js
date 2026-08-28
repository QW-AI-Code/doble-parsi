/**
 * سند offscreen: گرفتن صدای تب، ارسال به Gemini Live، پخش دوبله،
 * ضبط MP3 و ساخت زیرنویس.
 *
 * گراف صوتی:
 *
 *   sourceNode ─┬─> originalGain ─┬─> destination
 *               │                 └─> originalRecordGain ─┐
 *               └─> apiTap ─> silentSink                  │
 *                                                         ├─> recordBus ─> recordTap
 *   dubPlayer(ring buffer) ─┬─> dubRecordGain ────────────-┘
 *                           └─> dubPlaybackGain ─> destination
 *
 * دو نکته‌ی مهم:
 *  • تپ ضبط دوبله **قبل** از بهره‌ی پخش زنده گرفته می‌شود. وگرنه اگر «پخش زنده»
 *    خاموش بود، همان بهره روی صفر می‌رفت و فایل MP3 کاملاً سکوت درمی‌آمد.
 *  • صدای دوبله از یک بافر حلقه‌ای پیوسته پخش می‌شود، نه با یک
 *    AudioBufferSourceNode جدا برای هر تکه؛ مرز تکه‌ها دیگر کلیک نمی‌سازد.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { LiveDubClient } from "./live-client.js";
import { Mp3Recorder } from "./mp3-recorder.js";
import { CaptionTrack, toSrt, toVtt } from "./captions.js";
import { buildOutputPath, timestampTag } from "./filenames.js";
import { findLanguage } from "./languages.js";
import { SincResampler } from "./resampler.js";
import { Int16StreamReader, floatToInt16 } from "./pcm.js";

const API_INPUT_RATE = 16000;
const SEND_CHUNK_FRAMES = 1600;      // ≈۱۰۰ میلی‌ثانیه
const TICK_MS = 250;
const DUCK_RELEASE_MS = 420;
const PREBUFFER_MS = 180;            // بافر ضدلرزش پخش دوبله
const MAX_DRAIN_MS = 12000;          // سقف انتظار برای تخلیه‌ی دنباله‌ی دوبله

/** هدروم باس ضبط: جمع دوبله و صدای اصلی نباید به کلیپ سخت برسد */
const MIX_DUB_GAIN = 0.92;
const MIX_ORIGINAL_GAIN = 0.72;

const session = {
  active: false,          // در حال گرفتن ورودی و ارسال به مدل
  recording: false,       // تپ ضبط زنده است (در زمان تخلیه هم روشن می‌ماند)
  settings: null,
  meta: null,
  startedAt: 0,
  stream: null,
  audioCtx: null,
  nodes: {},
  client: null,
  recorder: null,
  apiResampler: null,
  dubResampler: null,
  dubRate: 0,
  dubReader: null,
  sendBuffer: [],
  sendCount: 0,
  dubTrack: null,
  sourceTrack: null,
  duckTimer: null,
  ticker: null,
  lastDubText: "",
  lastSourceText: "",
  hadAudio: false,
  dubActive: false,
  droppedFrames: 0,
  drainWaiters: [],
  errorPayload: null
};

class CodedError extends Error {
  constructor(code, vars) {
    super(code);
    this.code = code;
    this.vars = vars;
  }
  get payload() {
    return { code: this.code, vars: this.vars };
  }
}

function toPayload(error, fallback = "err.unknown") {
  if (error instanceof CodedError) return error.payload;
  if (error && typeof error === "object" && error.code) return { code: error.code, vars: error.vars };
  return { code: fallback };
}

function elapsedMs() {
  return session.startedAt ? Math.max(0, performance.now() - session.startedAt) : 0;
}

function emit(event) {
  chrome.runtime.sendMessage({ type: "dp-event", event }).catch(() => {});
}

async function createContext() {
  // نرخ ۴۸ کیلوهرتز: نسبت صحیح ۲:۱ با خروجی ۲۴ کیلوهرتزی مدل و نرخ بومی LAME.
  // latencyHint=playback بافر سخت‌افزاری بزرگ‌تری می‌گیرد و در برابر
  // پرش‌های ترد اصلی (که همان تِرَق است) بسیار مقاوم‌تر است.
  try {
    return new AudioContext({ sampleRate: 48000, latencyHint: "playback" });
  } catch {
    return new AudioContext();
  }
}

async function startSession(request) {
  if (session.active || session.recording) throw new CodedError("err.busy");

  const settings = request.settings;
  const meta = { title: request.sourceTitle ?? "", url: request.sourceUrl ?? "" };
  if (!settings.apiKey?.trim()) throw new CodedError("err.noKey");
  if (!settings.livePlayback && !settings.saveMp3 && !settings.saveSubtitle) {
    throw new CodedError("err.noOutput");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: request.streamId } },
    video: false
  });

  const audioCtx = await createContext();
  await audioCtx.audioWorklet.addModule(chrome.runtime.getURL("src/audio/tap-worklet.js"));
  await audioCtx.audioWorklet.addModule(chrome.runtime.getURL("src/audio/dub-player-worklet.js"));
  if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => {});

  const wantsMix = settings.mp3Source === "mix";
  const sourceNode = audioCtx.createMediaStreamSource(stream);

  // ── صدای اصلی تب ─────────────────────────────────────────────
  const originalGain = audioCtx.createGain();
  originalGain.gain.value = 1;
  sourceNode.connect(originalGain);
  originalGain.connect(audioCtx.destination);

  const silentSink = audioCtx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(audioCtx.destination);

  // ── پخش‌کننده‌ی دوبله (بافر حلقه‌ای) ──────────────────────────
  const dubPlayer = new AudioWorkletNode(audioCtx, "dub-player", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { prebufferMs: PREBUFFER_MS, fadeMs: 2, maxBufferMs: 9000 }
  });

  const dubPlaybackGain = audioCtx.createGain();
  dubPlaybackGain.gain.value = settings.livePlayback ? 1 : 0;
  dubPlayer.connect(dubPlaybackGain);
  dubPlaybackGain.connect(audioCtx.destination);

  // ── باس ضبط ──────────────────────────────────────────────────
  let recordBus = null;
  let recordTap = null;
  let recorder = null;
  let dubRecordGain = null;
  let originalRecordGain = null;

  if (settings.saveMp3) {
    recordBus = audioCtx.createGain();
    recordBus.gain.value = 1;

    dubRecordGain = audioCtx.createGain();
    dubRecordGain.gain.value = wantsMix ? MIX_DUB_GAIN : 1;
    dubPlayer.connect(dubRecordGain);          // مستقل از بهره‌ی پخش زنده
    dubRecordGain.connect(recordBus);

    if (wantsMix) {
      originalRecordGain = audioCtx.createGain();
      originalRecordGain.gain.value = MIX_ORIGINAL_GAIN;
      originalGain.connect(originalRecordGain); // بعد از ducking، پس میکس متعادل است
      originalRecordGain.connect(recordBus);
    }

    recorder = new Mp3Recorder({
      sampleRate: audioCtx.sampleRate,
      bitrate: settings.mp3Bitrate ?? 128000
    });
    await recorder.init();

    recordTap = new AudioWorkletNode(audioCtx, "dub-tap");
    recordBus.connect(recordTap);
    recordTap.connect(silentSink);
    recordTap.port.onmessage = (event) => {
      if (!session.recording) return;
      session.recorder?.append(new Float32Array(event.data));
    };
  }

  // ── تپ ارسال به مدل ──────────────────────────────────────────
  const apiTap = new AudioWorkletNode(audioCtx, "dub-tap");
  sourceNode.connect(apiTap);
  apiTap.connect(silentSink);

  const wantSourceCaptions = Boolean(settings.saveSubtitle) && Boolean(settings.bilingualSubtitle);
  const dubTrack = new CaptionTrack();
  const sourceTrack = new CaptionTrack();

  Object.assign(session, {
    active: true,
    recording: Boolean(recorder),
    settings,
    meta,
    startedAt: performance.now(),
    stream,
    audioCtx,
    nodes: {
      sourceNode, originalGain, originalRecordGain, dubPlayer, dubPlaybackGain,
      dubRecordGain, recordBus, silentSink, apiTap, recordTap
    },
    recorder,
    apiResampler: new SincResampler(audioCtx.sampleRate, API_INPUT_RATE),
    dubResampler: null,
    dubRate: 0,
    dubReader: new Int16StreamReader(),
    sendBuffer: [],
    sendCount: 0,
    dubTrack,
    sourceTrack,
    lastDubText: "",
    lastSourceText: "",
    hadAudio: false,
    dubActive: false,
    droppedFrames: 0,
    drainWaiters: [],
    errorPayload: null
  });

  dubPlayer.port.onmessage = (event) => handlePlayerMessage(event.data);

  apiTap.port.onmessage = (event) => {
    if (!session.active) return;
    const resampled = session.apiResampler.process(new Float32Array(event.data));
    if (!resampled.length) return;
    session.sendBuffer.push(resampled);
    session.sendCount += resampled.length;
    while (session.sendCount >= SEND_CHUNK_FRAMES) {
      const chunk = new Float32Array(SEND_CHUNK_FRAMES);
      let filled = 0;
      while (filled < SEND_CHUNK_FRAMES) {
        const head = session.sendBuffer[0];
        const take = Math.min(head.length, SEND_CHUNK_FRAMES - filled);
        chunk.set(head.subarray(0, take), filled);
        filled += take;
        if (take === head.length) session.sendBuffer.shift();
        else session.sendBuffer[0] = head.subarray(take);
      }
      session.sendCount -= SEND_CHUNK_FRAMES;
      session.client?.sendAudio(floatToInt16(chunk).buffer);
    }
  };

  // مدل ترجمهٔ زنده خودش صدای گویندهٔ اصلی را تقلید می‌کند
  const language = findLanguage(settings.targetLang);

  const client = new LiveDubClient({
    apiKey: settings.apiKey.trim(),
    translateModel: settings.translateModel || "gemini-3.5-live-translate-preview",
    targetLanguageCode: language.code,
    dubTranscription: true,
    sourceTranscription: wantSourceCaptions,
    onReady: () => emit({ kind: "ready" }),
    onError: (payload) => {
      session.errorPayload = payload;
      emit({ kind: "error", error: payload });
    },
    onAudio: (bytes, rate) => handleDubAudio(bytes, rate),
    onInterrupted: () => resetDubStream(),
    onDubText: (text) => {
      session.lastDubText = text.trim() || session.lastDubText;
      session.dubTrack.push(text, elapsedMs());
      emit({ kind: "caption", channel: "dub", text: text.trim() });
    },
    onSourceText: (text) => {
      session.lastSourceText = text.trim() || session.lastSourceText;
      if (wantSourceCaptions) session.sourceTrack.push(text, elapsedMs());
      emit({ kind: "caption", channel: "source", text: text.trim() });
    }
  });
  session.client = client;
  client.connect();

  session.ticker = setInterval(() => {
    if (!session.active) return;
    const now = elapsedMs();
    session.dubTrack.tick(now);
    session.sourceTrack.tick(now);
    emit({
      kind: "tick",
      elapsedMs: now,
      cueCount: session.dubTrack.cueCount,
      audioMs: session.recorder?.durationMs ?? 0
    });
  }, TICK_MS);

  stream.getAudioTracks()[0]?.addEventListener("ended", () => {
    emit({ kind: "source-ended" });
  });

  return { sampleRate: audioCtx.sampleRate };
}

function handlePlayerMessage(message) {
  if (message?.type === "status") {
    session.droppedFrames = message.droppedFrames ?? session.droppedFrames;
    if (message.active !== session.dubActive) {
      session.dubActive = Boolean(message.active);
      applyDuck(session.dubActive);
    }
    return;
  }
  if (message?.type === "drained") {
    session.droppedFrames = message.droppedFrames ?? session.droppedFrames;
    const waiters = session.drainWaiters;
    session.drainWaiters = [];
    for (const resolve of waiters) resolve();
  }
}

/** صدای تازه‌ی مدل: بایت ⇒ Float ⇒ نرخ کانتکست ⇒ بافر حلقه‌ای */
function handleDubAudio(bytes, rate) {
  if (!session.audioCtx || (!session.active && !session.recording)) return;

  const samples = session.dubReader.push(bytes);
  if (!samples.length) return;
  session.hadAudio = true;

  const target = session.audioCtx.sampleRate;
  if (!session.dubResampler || session.dubRate !== rate) {
    session.dubRate = rate;
    session.dubResampler = new SincResampler(rate, target);
  }

  const converted = session.dubResampler.process(samples);
  if (!converted.length) return;

  const payload = converted.buffer.byteLength === converted.length * 4
    ? converted.buffer
    : converted.slice().buffer;
  session.nodes.dubPlayer?.port.postMessage({ type: "push", samples: payload }, [payload]);
}

/** قطع شدن نوبت مدل: حالت بازنمونه‌بردار و بایت باقی‌مانده را پاک می‌کند */
function resetDubStream() {
  session.dubReader?.reset();
  session.dubResampler?.reset();
}

function applyDuck(speaking) {
  if (!session.settings?.duckOriginal || !session.settings?.livePlayback) return;
  const ctx = session.audioCtx;
  const gain = session.nodes.originalGain?.gain;
  if (!ctx || !gain) return;

  if (session.duckTimer) {
    clearTimeout(session.duckTimer);
    session.duckTimer = null;
  }

  if (speaking) {
    const level = Math.max(0, Math.min(1, session.settings.duckLevel ?? 0.12));
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setTargetAtTime(level, ctx.currentTime, 0.05);
    return;
  }

  session.duckTimer = setTimeout(() => {
    session.duckTimer = null;
    const context = session.audioCtx;
    if (!context || session.dubActive) return;
    session.nodes.originalGain?.gain.setTargetAtTime(1, context.currentTime, 0.12);
  }, DUCK_RELEASE_MS);
}

/** منتظر می‌ماند تا دنباله‌ی صدای دوبله کامل پخش (و ضبط) شود */
function drainDubPlayer() {
  const player = session.nodes.dubPlayer;
  if (!player) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    session.drainWaiters.push(done);
    player.port.postMessage({ type: "drain" });
    setTimeout(done, MAX_DRAIN_MS);
  });
}

/**
 * دانلود یک خروجی.
 * پسوند را جداگانه هم می‌فرستیم تا سرویس‌ورکر بتواند نام نهایی را
 * به کروم تحمیل کند و پسوند (srt/vtt/mp3) دست‌نخورده بماند.
 */
async function downloadBlob(blob, filename, extension) {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "dp-download", blobUrl, filename, extension
    });
    if (!response?.ok) throw new CodedError(response?.error?.code ?? "err.download", response?.error?.vars);
    return { filename: response.filename ?? filename, bytes: blob.size };
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
}

async function stopSession(request = {}) {
  if (!session.active && !session.recording) return { files: [], errors: [] };
  session.active = false;

  if (session.ticker) clearInterval(session.ticker);
  session.ticker = null;

  const settings = session.settings;
  // عنوان تازه‌خوانده‌شده اولویت دارد؛ هنگام شروع ممکن است ویدئو هنوز
  // بارگذاری نشده و عنوان صفحه ناقص بوده باشد.
  const meta = {
    title: String(request.sourceTitle ?? "").trim() || session.meta?.title || "",
    url: request.sourceUrl || session.meta?.url || ""
  };
  const totalMs = elapsedMs();
  const errors = [];

  session.client?.close();
  session.client = null;

  // ورودی مدل بسته می‌شود، ولی مسیر ضبط زنده می‌ماند تا دنباله‌ی دوبله برسد
  try {
    session.nodes.apiTap?.port.postMessage({ type: "close" });
    session.nodes.apiTap?.disconnect();
  } catch {}

  if (session.recording) {
    // ۱) دنباله‌ی فیلتر بازنمونه‌بردار را هم به بافر می‌ریزیم (پیش از تخلیه)
    try {
      const tail = session.dubResampler?.flush();
      if (tail?.length) {
        const buffer = tail.slice().buffer;
        session.nodes.dubPlayer?.port.postMessage({ type: "push", samples: buffer }, [buffer]);
      }
    } catch {}
    // ۲) صبر می‌کنیم تمام صدای بافرشده‌ی دوبله پخش و ضبط شود
    await drainDubPlayer();
    // ۳) بسته‌ی نیم‌بند تپ ضبط را بیرون می‌کشیم و به انکودر می‌رسانیم
    try {
      session.nodes.recordTap?.port.postMessage({ type: "flush" });
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 240));
  }

  session.recording = false;

  if (session.duckTimer) clearTimeout(session.duckTimer);
  session.duckTimer = null;

  try {
    session.nodes.recordTap?.port.postMessage({ type: "close" });
    session.nodes.recordTap?.disconnect();
    session.nodes.dubPlayer?.disconnect();
  } catch {}
  for (const track of session.stream?.getTracks() ?? []) track.stop();

  const files = [];
  const tag = timestampTag();
  const useOriginalName = settings.useOriginalFilename !== false;
  // مسیر خروجی: Doble Parsi/<نام ویدئو>/<نام ویدئو>.<پسوند>
  const nameFor = (extension, suffix) => buildOutputPath({
    title: meta.title, url: meta.url, extension, suffix, tag, useOriginalName
  });

  if (settings.saveMp3 && session.recorder) {
    const recorder = session.recorder;
    try {
      const blob = await recorder.finish();
      if (blob && blob.size > 1024 && !recorder.isSilent) {
        files.push(await downloadBlob(blob, nameFor("mp3"), "mp3"));
        if (recorder.clippedFrames > recorder.totalFrames * 0.01) {
          errors.push({ code: "err.clip" });
        }
        if (session.droppedFrames > 0) {
          const seconds = (session.droppedFrames / (session.audioCtx?.sampleRate ?? 48000)).toFixed(1);
          errors.push({ code: "err.dropped", vars: { seconds } });
        }
      } else if (recorder.isSilent) {
        errors.push({ code: "err.mp3Silent" });
      } else {
        errors.push({ code: "err.mp3Empty" });
      }
    } catch (error) {
      errors.push(toPayload(error, "err.mp3Failed"));
    }
  }

  if (settings.saveSubtitle) {
    const offset = Number(settings.subtitleOffsetMs ?? 0);
    const jobs = [
      { track: session.dubTrack, kind: "dub", offset },
      ...(settings.bilingualSubtitle ? [{ track: session.sourceTrack, kind: "source", offset: 0 }] : [])
    ];
    for (const job of jobs) {
      const cues = job.track.finalize(job.offset);
      if (!cues.length) {
        errors.push({ code: job.kind === "dub" ? "err.subEmptyDub" : "err.subEmptySource" });
        continue;
      }
      const formats = settings.subtitleFormat === "both"
        ? ["srt", "vtt"]
        : [settings.subtitleFormat === "vtt" ? "vtt" : "srt"];
      for (const format of formats) {
        try {
          const text = format === "vtt" ? toVtt(cues) : toSrt(cues);
          // نوع MIME عمداً octet-stream است: با نوع‌های متنی، کروم پسوند را
          // بازنویسی می‌کرد و فایل زیرنویس بدون .srt ذخیره می‌شد.
          const blob = new Blob([format === "srt" ? `\uFEFF${text}` : text], {
            type: "application/octet-stream"
          });
          files.push(await downloadBlob(
            blob,
            nameFor(format, job.kind === "dub" ? "" : "original"),
            format
          ));
        } catch (error) {
          errors.push(toPayload(error, "err.subFailed"));
        }
      }
    }
  }

  const transcript = session.dubTrack?.plainText() ?? "";

  try {
    await session.audioCtx?.close();
  } catch {}

  Object.assign(session, {
    active: false, recording: false, settings: null, meta: null, startedAt: 0, stream: null,
    audioCtx: null, nodes: {}, recorder: null, apiResampler: null, dubResampler: null,
    dubRate: 0, dubReader: null, sendBuffer: [], sendCount: 0, dubTrack: null, sourceTrack: null,
    hadAudio: false, dubActive: false, droppedFrames: 0, drainWaiters: []
  });

  return { files, errors, totalMs, transcript };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type === "dp-off-start") {
    startSession(message)
      .then((data) => respond({ ok: true, data }))
      .catch(async (error) => {
        try { await stopSession(); } catch {}
        respond({ ok: false, error: toPayload(error, "err.startFailed") });
      });
    return true;
  }
  if (message?.type === "dp-off-stop") {
    stopSession(message)
      .then((data) => respond({ ok: true, data }))
      .catch((error) => respond({ ok: false, error: toPayload(error, "err.stopFailed") }));
    return true;
  }
  if (message?.type === "dp-off-ping") {
    respond({ ok: true, active: session.active });
    return false;
  }
  return false;
});
