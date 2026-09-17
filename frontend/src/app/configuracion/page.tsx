"use client";

import { useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

const bellSoundStorageKey = "coffee_gosen_bell_sound_enabled";
const bellSoundPath = "/Campana%20Tibetana%20Mini.mp3";

export default function ConfiguracionPage() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(bellSoundStorageKey) !== "false";
  });
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function updateSoundEnabled(enabled: boolean) {
    setSoundEnabled(enabled);
    window.localStorage.setItem(bellSoundStorageKey, String(enabled));
    setNotice(enabled ? "Sonido de campana activado." : "Sonido de campana desactivado.");
    window.setTimeout(() => setNotice(""), 2500);
  }

  function previewSound() {
    const audio = new Audio(bellSoundPath);
    audioRef.current?.pause();
    audioRef.current = audio;
    audio.volume = 1;
    audio.playbackRate = [0.78, 0.92, 1.08, 1.24][Math.floor(Math.random() * 4)];
    audio.addEventListener("loadedmetadata", () => {
      const segmentLength = Math.min(2.4, audio.duration);
      const maxStart = Math.max(0, audio.duration - segmentLength);
      audio.currentTime = Math.random() * maxStart;
      void audio.play().catch(() => setNotice("El navegador bloqueó el sonido. Presiona de nuevo para probarlo."));
    }, { once: true });
  }

  return (
    <AdminPage title="Configuración" description="Personaliza las alertas sonoras de Coffee Gosen.">
      <section className="max-w-2xl border border-[var(--line)] bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 place-items-center bg-[var(--blue-light)] text-[var(--blue-main)]"><Bell size={21} /></span>
            <div>
              <h2 className="font-semibold">Sonido de la campana</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Reproduce un fragmento diferente del sonido cuando aparece una alerta nueva.</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={soundEnabled} aria-label="Activar sonido de la campana" onClick={() => updateSoundEnabled(!soundEnabled)} className={`relative inline-flex min-h-11 min-w-20 items-center border-2 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--blue-main)] ${soundEnabled ? "justify-end border-[var(--blue-main)] bg-[var(--blue-main)]" : "justify-start border-[var(--line)] bg-[var(--surface)]"}`}>
            <span className="grid size-7 place-items-center bg-white text-[var(--blue-main)] shadow-sm">{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</span>
          </button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
          <button type="button" onClick={previewSound} disabled={!soundEnabled} className="inline-flex min-h-11 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Volume2 size={16} /> Probar sonido</button>
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        </div>
      </section>
    </AdminPage>
  );
}