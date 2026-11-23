"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

// Speech recognition ships under both names and is absent from lib.dom.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

const errorMessages: Record<string, string> = {
  "not-allowed": "Izinkan akses mikrofon di pengaturan peramban, atau ketik transaksi.",
  "service-not-allowed": "Layanan suara tidak tersedia. Ketik transaksi di bawah.",
  "audio-capture": "Mikrofon tidak tersedia. Periksa perangkat atau ketik transaksi.",
  "no-speech": "Suara belum terdengar. Coba lagi atau ketik transaksi.",
  network: "Layanan suara gagal terhubung. Coba lagi atau ketik transaksi.",
};

export function VoiceEntry({ onApply, onCancel }: {
  onApply: (transcript: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const current = useRef<Recognition | null>(null);
  const browser = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Recognizer = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;

  useEffect(() => () => {
    const session = current.current;
    current.current = null;
    session?.abort();
  }, []);

  function start() {
    if (!Recognizer || current.current) return;
    try {
      const session = new Recognizer();
      current.current = session;
      session.lang = "id-ID";
      session.continuous = false;
      session.interimResults = true;
      let received = false;
      let failed = false;
      session.onresult = ({ results }) => {
        if (current.current !== session) return;
        const spoken = Array.from(results, result => result[0]?.transcript ?? "").join(" ").trim();
        if (spoken) {
          received = true;
          setText(spoken);
        }
      };
      session.onerror = ({ error }) => {
        if (current.current !== session) return;
        failed = true;
        setMessage(errorMessages[error] ?? "Pengenalan suara terhenti. Coba lagi atau ketik transaksi.");
      };
      session.onend = () => {
        if (current.current !== session) return;
        current.current = null;
        setListening(false);
        if (!failed) setMessage(received ? "" : errorMessages["no-speech"]);
      };
      setMessage("");
      setListening(true);
      session.start();
    } catch {
      current.current = null;
      setListening(false);
      setMessage("Mikrofon gagal dibuka. Coba lagi atau ketik transaksi.");
    }
  }

  return (
    <section className="space-y-4 overflow-y-auto pb-3">
      <p className="text-sm text-muted-foreground">
        Sebutkan satu transaksi, misalnya “Kemarin beli kopi dua puluh lima ribu pakai Tunai untuk rapat kantor”.
      </p>
      {Recognizer && (
        <button type="button" aria-pressed={listening}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-mint-strong/40 bg-mint-soft font-semibold text-mint-strong"
          onClick={listening ? () => current.current?.stop() : start}>
          <Mic className="size-4" /> {listening ? "Selesai berbicara" : text ? "Rekam ulang" : "Mulai bicara"}
        </button>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {message || (listening ? "Mendengarkan…" : Recognizer
          ? "Peramban dapat menggunakan layanan daring untuk mengenali suara."
          : "Peramban ini belum mendukung mikrofon untuk transkripsi. Ketik kalimat transaksi di bawah.")}
      </p>
      <label className="block space-y-1 text-sm font-medium">
        <span>Kalimat transaksi</span>
        <textarea rows={3} value={text} readOnly={listening} maxLength={500}
          onChange={event => setText(event.target.value)}
          placeholder="Beli kopi 25 ribu untuk rapat kantor"
          className="block w-full rounded-xl border bg-card p-3 text-base" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border px-4">Batal</button>
        <button type="button" disabled={listening || !text.trim()} onClick={() => onApply(text.trim())}
          className="min-h-11 flex-1 rounded-xl bg-mint-strong font-semibold text-on-mint disabled:opacity-50">
          Isi formulir
        </button>
      </div>
    </section>
  );
}
