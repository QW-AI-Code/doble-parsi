/**
 * کلاینت Gemini Live (BidiGenerateContent) برای دوبله همزمان.
 * ورودی: PCM 16-bit مونو 16kHz — خروجی: PCM 16-bit مونو 24kHz + متن رونویسی.
 *
 * مدل gemini-3.5-live-translate-preview با پیکربندی سادهٔ translationConfig
 * کار می‌کند: خودش صدای گویندهٔ اصلی را تقلید می‌کند (voice replication) و
 * speechConfig را نادیده می‌گیرد. به همین دلیل انتخاب صدای گوینده حذف شد؛
 * هر صدایی هم که فرستاده می‌شد، سرور آن فیلد را دور می‌ریخت.
 *
 * ساخته‌شده توسط QW-AI-Code — https://github.com/QW-AI-Code
 */
import { isQuotaError, parseRetryDelay, parseUsage } from "./usage.js";
const ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const INPUT_MIME = "audio/pcm;rate=16000";
const DEFAULT_OUTPUT_RATE = 24000;
const MAX_PENDING_CHUNKS = 24;

function withModelPrefix(model) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function toBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  const step = 0x8000;
  for (let i = 0; i < view.length; i += step) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + step));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function rateOf(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType ?? "");
  if (!match) return DEFAULT_OUTPUT_RATE;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OUTPUT_RATE;
}

function secondsToMs(value) {
  const match = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number.parseFloat(match[1]) * 1000 : null;
}

export class LiveDubClient {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.ready = false;
    this.closed = false;
    this.reconnecting = false;
    this.reconnectTimer = null;
    this.resumptionHandle = undefined;
    this.pending = [];
    this.generation = 0;
  }

  get model() {
    return this.options.translateModel;
  }

  connect() {
    this.openSocket();
  }

  openSocket() {
    if (this.closed) return;
    const url = new URL(ENDPOINT);
    url.searchParams.set("key", this.options.apiKey);

    const socket = new WebSocket(url.toString());
    socket.binaryType = "arraybuffer";
    const generation = this.generation;
    this.socket = socket;
    this.ready = false;

    socket.addEventListener("open", () => {
      if (generation !== this.generation || socket !== this.socket) return;
      this.sendSetup();
    });

    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data, socket, generation).catch(() => {});
    });

    socket.addEventListener("error", () => {
      if (generation !== this.generation || socket !== this.socket) return;
      this.options.onError?.({ code: "err.socket" });
    });

    socket.addEventListener("close", (event) => {
      if (this.closed || generation !== this.generation || socket !== this.socket) return;
      this.ready = false;
      if (event.code === 1000) return;
      // تلاش خودکار برای اتصال مجدد
      this.scheduleReconnect("2s");
    });
  }

  sendSetup() {
    const { targetLanguageCode, sourceTranscription, dubTranscription } = this.options;

    const setup = { model: withModelPrefix(this.model) };

    // ترجمهٔ زنده: مدل صدای گویندهٔ اصلی را تقلید می‌کند
    setup.generationConfig = {
      responseModalities: ["AUDIO"],
      translationConfig: {
        targetLanguageCode,
        echoTargetLanguage: true
      }
    };

    if (sourceTranscription) setup.inputAudioTranscription = {};
    if (dubTranscription) setup.outputAudioTranscription = {};
    if (this.resumptionHandle) setup.sessionResumption = { handle: this.resumptionHandle };
    else setup.sessionResumption = {};

    this.sendJson({ setup });
  }

  /** ارسال تکه صوتی؛ اگر سوکت آماده نبود، صف می‌شود */
  sendAudio(int16Chunk) {
    if (this.closed) return;
    if (!this.ready) {
      this.pending.push(int16Chunk);
      if (this.pending.length > MAX_PENDING_CHUNKS) this.pending.shift();
      return;
    }
    this.sendAudioNow(int16Chunk);
  }

  sendAudioNow(int16Chunk) {
    this.sendJson({
      realtimeInput: { audio: { data: toBase64(int16Chunk), mimeType: INPUT_MIME } }
    });
  }

  sendJson(payload) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  async handleMessage(raw, socket, generation) {
    const text = typeof raw === "string"
      ? raw
      : raw instanceof ArrayBuffer
        ? new TextDecoder().decode(raw)
        : await raw.text();

    if (generation !== this.generation || socket !== this.socket) return;

    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }

    if (message.error?.message) {
      const detail = message.error.message;
      // سهمیه تنها سیگنال قطعیِ «تمام شد» روی سیم است
      if (isQuotaError({ code: message.error.status ?? message.error.code, message: detail })) {
        this.options.onQuota?.(detail, parseRetryDelay(message.error, detail));
        this.options.onError?.({ code: "err.quota", vars: { message: detail } });
      } else {
        this.options.onError?.({ code: "err.api", vars: { message: detail } });
      }
      return;
    }

    // هر پیام سرور می‌تواند شمارش توکن همراه داشته باشد
    const sample = parseUsage(message.usageMetadata ?? message.usage_metadata);
    if (sample) this.options.onUsage?.(sample);

    const resumption = message.sessionResumptionUpdate ?? message.session_resumption_update;
    const handle = resumption?.newHandle ?? resumption?.new_handle;
    if (resumption?.resumable && handle) this.resumptionHandle = handle;

    const goAway = message.goAway ?? message.go_away;
    if (goAway) {
      const left = secondsToMs(goAway.timeLeft ?? goAway.time_left);
      this.scheduleReconnect(null, left === null ? 0 : Math.max(0, left - 2000));
    }

    if (message.setupComplete ?? message.setup_complete) {
      this.ready = true;
      this.options.onReady?.();
      const queued = this.pending;
      this.pending = [];
      for (const chunk of queued) this.sendAudioNow(chunk);
      return;
    }

    const content = message.serverContent ?? message.server_content;
    if (!content) return;

    // قطع شدن نوبت مدل: بایت نیم‌بند و حالت فیلتر باید پاک شود، وگرنه
    // نمونه‌ی بعدی با آفست اشتباه خوانده می‌شود و صدا خش می‌افتد.
    if (content.interrupted ?? content.INTERRUPTED) {
      this.options.onInterrupted?.();
      return;
    }

    const sourceText = content.inputTranscription ?? content.input_transcription;
    if (sourceText?.text?.trim()) this.options.onSourceText?.(sourceText.text);

    const dubText = content.outputTranscription ?? content.output_transcription;
    if (dubText?.text?.trim()) this.options.onDubText?.(dubText.text);

    const parts = content.modelTurn?.parts ?? content.model_turn?.parts ?? [];
    for (const part of parts) {
      if (generation !== this.generation || socket !== this.socket) return;
      const inline = part.inlineData ?? part.inline_data;
      if (!inline?.data) continue;
      this.options.onAudio?.(fromBase64(inline.data), rateOf(inline.mimeType ?? inline.mime_type));
    }
  }

  scheduleReconnect(after, explicitDelay) {
    if (this.closed || this.reconnectTimer) return;
    const delay = typeof explicitDelay === "number" ? explicitDelay : (secondsToMs(after) ?? 1500);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectNow();
    }, Math.max(250, delay));
  }

  reconnectNow() {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    const previous = this.socket;
    this.socket = null;
    this.ready = false;
    this.generation += 1;
    try {
      previous?.close(1000, "reconnect");
    } catch {}
    this.openSocket();
    this.reconnecting = false;
  }

  close() {
    this.closed = true;
    this.ready = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.generation += 1;
    try {
      this.socket?.close(1000, "session finished");
    } catch {}
    this.socket = null;
    this.pending = [];
  }
}
