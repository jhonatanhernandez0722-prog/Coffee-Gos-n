"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bell, Save, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";

const bellSoundStorageKey = "coffee_gosen_bell_sound_enabled";
const bellSoundPath = "/Campana%20Tibetana%20Mini.mp3";
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export default function ConfiguracionPage() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(bellSoundStorageKey) !== "false";
  });
  const [notice, setNotice] = useState("");
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = window.sessionStorage.getItem("coffee_gosen_user");
    const user = storedUser ? JSON.parse(storedUser) as { role?: string } : null;
    return user?.role === "ADMIN";
  });
  const [cash, setCash] = useState("");
  const [nequi, setNequi] = useState("");
  const [reason, setReason] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [balanceNotice, setBalanceNotice] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/financial-reports/opening-balance`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar el saldo inicial."); return result as { cash: number; nequi: number }; })
      .then((result) => { setCash(String(result.cash)); setNequi(String(result.nequi)); })
      .catch((requestError: Error) => setBalanceError(userFacingError(requestError, "No fue posible cargar el saldo inicial.")));
  }, [isAdmin]);

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

  async function correctOpeningBalance(event: FormEvent) {
    event.preventDefault(); setBalanceError(""); setBalanceNotice("");
    if (Number(cash) < 0 || Number(nequi) < 0 || !Number.isFinite(Number(cash)) || !Number.isFinite(Number(nequi))) { setBalanceError("Escribe valores válidos para efectivo y Nequi."); return; }
    if (reason.trim().length < 5) { setBalanceError("Explica brevemente el motivo de la corrección."); return; }
    if (!window.confirm("¿Confirmas corregir únicamente los saldos iniciales de efectivo y Nequi?")) return;
    setSavingBalance(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/financial-reports/opening-balance/correction`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ cash: Number(cash), nequi: Number(nequi), reason: reason.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible corregir el saldo inicial.");
      setCash(String(result.cash)); setNequi(String(result.nequi)); setReason(""); setBalanceNotice("Saldo inicial corregido y registrado en el historial.");
    } catch (requestError) { setBalanceError(userFacingError(requestError, "No fue posible corregir el saldo inicial.")); } finally { setSavingBalance(false); }
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
      {isAdmin && <section className="mt-6 max-w-2xl border border-amber-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 place-items-center bg-amber-50 text-amber-700"><ShieldCheck size={21} /></span>
          <div><h2 className="font-semibold">Corrección de saldo inicial</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Solo modifica el efectivo y Nequi con los que se abrió la caja. No cambia ventas, compras, inventario, créditos ni egresos.</p></div>
        </div>
        {balanceError && <p role="alert" className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{balanceError}</p>}
        {balanceNotice && <p role="status" className="mt-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{balanceNotice}</p>}
        <form onSubmit={correctOpeningBalance} className="mt-6 border-t border-[var(--line)] pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Efectivo inicial<input required min="0" step="0.01" type="number" value={cash} onChange={(event) => setCash(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>
            <label className="text-sm font-semibold">Nequi inicial<input required min="0" step="0.01" type="number" value={nequi} onChange={(event) => setNequi(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">Total inicial: <strong>{money((Number(cash) || 0) + (Number(nequi) || 0))}</strong></p>
          <label className="mt-5 block text-sm font-semibold">Motivo de la corrección<textarea required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Ej. Se digitó mal el efectivo de apertura" className="mt-2 w-full border border-[var(--line)] px-3 py-3 font-normal" /></label>
          <button type="submit" disabled={savingBalance} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} />{savingBalance ? "Guardando..." : "Guardar corrección"}</button>
        </form>
      </section>}
    </AdminPage>
  );
}