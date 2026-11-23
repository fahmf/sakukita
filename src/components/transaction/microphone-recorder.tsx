"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

export function MicrophoneRecorder({ onTranscript, onBusy }: {
  onTranscript: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "sending">("idle");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(0);
  const [clip, setClip] = useState<Blob | null>(null);
  const current = useRef<MediaRecorder | null>(null);
  const release = useRef<(() => void) | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    release.current?.();
    request.current?.abort();
  }, []);

  async function record() {
    if (release.current || request.current) return;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      release.current = null;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      const recorder = current.current;
      current.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
    release.current = cleanup;
    setPhase("opening");
    setMessage("Menunggu akses mikrofon…");
    onBusy(true);
    try {
      // Resume during the tap for mobile browsers that require a user gesture.
      context = new AudioContext();
      void context.resume().catch(() => {});
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (release.current !== cleanup) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Unsupported recording format");
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      current.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        if (current.current !== recorder) return;
        cleanup();
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
        const usable = audio.size > 0 && audio.size <= 512 * 1024;
        setClip(usable ? audio : null);
        setPhase("idle");
        setMessage(usable ? "Rekaman siap. Tekan Transkripsikan untuk melihat teksnya." : "Rekaman tidak dapat dipakai. Coba rekam ulang.");
        onBusy(false);
      };
      recorder.onerror = () => {
        if (current.current !== recorder) return;
        cleanup();
        setMessage("Rekaman terputus. Periksa mikrofon lalu coba lagi.");
        setPhase("idle");
        onBusy(false);
      };
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const meter = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        setLevel(Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 450)));
        frame = requestAnimationFrame(meter);
      };
      recorder.start();
      setClip(null);
      setPhase("recording");
      setMessage("Merekam. Tekan Selesai berbicara saat selesai. Maksimal 25 detik.");
      meter();
      timer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 25_000);
    } catch (err) {
      if (release.current !== cleanup) return;
      cleanup();
      setPhase("idle");
      const name = err instanceof Error ? err.name : "";
      setMessage(name === "NotAllowedError" ? "Akses mikrofon ditolak. Izinkan mikrofon untuk situs ini dan aplikasi peramban di pengaturan perangkat."
        : name === "NotFoundError" ? "Perangkat tidak menemukan mikrofon."
        : name === "NotReadableError" ? "Mikrofon sedang digunakan atau tidak dapat dibuka."
        : "Mikrofon gagal dibuka. Periksa perangkat atau ketik transaksi.");
      onBusy(false);
    }
  }

  async function transcribe() {
    if (!clip || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    onBusy(true);
    setPhase("sending");
    setMessage("Sedang mentranskripsikan rekaman…");
    try {
      const response = await fetch("/api/transcribe-voice", { method: "POST", body: clip, signal: controller.signal });
      if (response.redirected) throw new Error("Masuk kembali untuk mentranskripsikan rekaman.");
      const result = await response.json();
      if (!response.ok || !result.transcript) throw new Error(result.error || "Gagal membaca transkrip.");
      if (controller.signal.aborted) return;
      onTranscript(result.transcript);
      setClip(null);
      setMessage("Teks sudah tersedia. Periksa kalimat sebelum mengisi formulir.");
    } catch (err) {
      if (controller.signal.aborted) return;
      setMessage(err instanceof Error && !(err instanceof SyntaxError) && !(err instanceof TypeError)
        ? err.message : "Gagal terhubung ke layanan suara. Coba lagi.");
    } finally {
      if (!controller.signal.aborted) {
        onBusy(false);
        setPhase("idle");
      }
      request.current = null;
    }
  }

  const recording = phase === "recording";
  return (
    <div className="space-y-2">
      <button type="button" disabled={phase === "opening" || phase === "sending"} aria-pressed={recording}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-mint-strong/40 bg-mint-soft font-semibold text-mint-strong disabled:opacity-50"
        onClick={recording ? () => { if (current.current?.state === "recording") current.current.stop(); } : record}>
        <Mic className="size-4" /> {recording ? "Selesai berbicara" : clip ? "Rekam ulang" : "Mulai bicara"}
      </button>
      {recording && <div role="meter" aria-label="Volume mikrofon" aria-valuenow={level} aria-valuemin={0} aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-mint-strong" style={{ width: level + "%" }} />
      </div>}
      {clip && <button type="button" disabled={phase !== "idle"} onClick={transcribe}
        className="min-h-11 w-full rounded-xl bg-mint-strong font-semibold text-on-mint disabled:opacity-50">Transkripsikan</button>}
      <p className="text-xs text-muted-foreground">Saat Anda menekan Transkripsikan, rekaman dikirim ke Google Gemini untuk diubah menjadi teks.</p>
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
