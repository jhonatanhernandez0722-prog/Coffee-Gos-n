"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRightLeft, Banknote, CalendarDays, Check, Smartphone, Trash2 } from "lucide-react";
import { apiUrl, userFacingError } from "@/lib/api";

type Method = "CASH" | "NEQUI";
type Transfer = { id: number; amount: number; from_method: Method; to_method: Method; occurred_on: string; description: string; created_at: string };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const methodLabels: Record<Method, string> = { CASH: "Efectivo", NEQUI: "Nequi" };
/** Fecha de hoy en la zona horaria del equipo (no en UTC). */
function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("coffee_gosen_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function MethodIcon({ method }: { method: Method }) {
  return method === "NEQUI" ? <Smartphone size={16} /> : <Banknote size={16} />;
}

/** Mueve dinero entre Efectivo y Nequi: resta en una cuenta y suma en la otra, sin cambiar el saldo total. */
export function TransferPanel() {
  const [fromMethod, setFromMethod] = useState<Method>("CASH");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [description, setDescription] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const toMethod: Method = fromMethod === "CASH" ? "NEQUI" : "CASH";

  async function loadTransfers() {
    const response = await fetch(`${apiUrl}/transfers`, { headers: authHeaders() });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los traslados.");
    setTransfers(result.transfers as Transfer[]);
  }
  useEffect(() => { Promise.resolve().then(loadTransfers).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los traslados."))); }, []);

  async function saveTransfer(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!(Number(amount) > 0)) return setError("El valor del traslado debe ser mayor que cero.");
    if (!occurredOn) return setError("Selecciona una fecha válida.");
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/transfers`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ amount: Number(amount), from_method: fromMethod, occurred_on: occurredOn, description: description.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible registrar el traslado.");
      setNotice(`Traslado de ${money(Number(amount))} de ${methodLabels[fromMethod]} a ${methodLabels[toMethod]} registrado.`);
      setAmount(""); setDescription(""); setOccurredOn(today());
      await loadTransfers();
    } catch (requestError) { setError(userFacingError(requestError, "No fue posible registrar el traslado.")); } finally { setSaving(false); }
  }
  async function removeTransfer(id: number) {
    if (!window.confirm("¿Eliminar este traslado? Se revierte en Efectivo y en Nequi.")) return;
    const response = await fetch(`${apiUrl}/transfers/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) { const result = await response.json(); setError(result.detail ?? "No fue posible eliminar el traslado."); return; }
    setTransfers((current) => current.filter((transfer) => transfer.id !== id)); setNotice("Traslado eliminado.");
  }

  return <section className="mt-6 border border-[var(--line)] bg-white">
    <div className="flex items-center gap-3 border-b border-[var(--line)] p-5 sm:p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-[var(--blue-light)] text-[var(--blue-main)]"><ArrowRightLeft size={20} /></span>
      <div><h2 className="text-lg font-bold">Traslado entre Efectivo y Nequi</h2><p className="text-sm text-[var(--muted)]">Consignar efectivo a Nequi o retirar de Nequi a la caja. No es un ingreso: el saldo total no cambia.</p></div>
    </div>
    <div className="grid items-start gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(380px,500px)_1fr]">
      <form onSubmit={saveTransfer}>
        {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16} />{notice}</p>}
        <fieldset><legend className="text-sm font-semibold">Dirección</legend><div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={fromMethod === "CASH"} onClick={() => setFromMethod("CASH")} className="choice"><Banknote size={16} />Efectivo → Nequi</button>
          <button type="button" aria-pressed={fromMethod === "NEQUI"} onClick={() => setFromMethod("NEQUI")} className="choice"><Smartphone size={16} />Nequi → Efectivo</button>
        </div></fieldset>
        <label className="mt-4 block text-sm font-semibold">Valor<input required inputMode="numeric" type="number" min="1" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej. 30000" className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal" /></label>
        <label className="mt-4 block text-sm font-semibold">Fecha<input required type="date" value={occurredOn} max={today()} onChange={(event) => setOccurredOn(event.target.value)} className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal" /></label>
        <label className="mt-4 block text-sm font-semibold">Descripción <span className="font-normal text-[var(--muted)]">(opcional)</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Ej. consignación de las ventas del día" className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal" /></label>
        <p className="mt-4 text-sm text-[var(--muted)]">Resta {money(Number(amount) || 0)} de <strong>{methodLabels[fromMethod]}</strong> y lo suma a <strong>{methodLabels[toMethod]}</strong>.</p>
        <button type="submit" disabled={saving} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 bg-[var(--blue-main)] px-5 text-base font-bold text-white transition hover:bg-[var(--blue-secondary)] disabled:opacity-60"><ArrowRightLeft size={19} />{saving ? "Guardando..." : "Registrar traslado"}</button>
      </form>
      <div>
        <h3 className="text-sm font-semibold">Traslados registrados</h3>
        {transfers.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Aún no hay traslados.</p> : <ul className="mt-2 divide-y divide-[var(--line)] border border-[var(--line)]">{transfers.map((transfer) => <li key={transfer.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><MethodIcon method={transfer.from_method} />{methodLabels[transfer.from_method]}<ArrowRightLeft size={14} className="text-[var(--muted)]" /><MethodIcon method={transfer.to_method} />{methodLabels[transfer.to_method]}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]"><CalendarDays size={13} />{transfer.occurred_on}</p>
            {transfer.description && <p className="mt-1 truncate text-sm text-[var(--muted)]">{transfer.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2"><strong className="font-heading text-lg tracking-tight">{money(Number(transfer.amount))}</strong><button title="Eliminar traslado" type="button" onClick={() => void removeTransfer(transfer.id)} className="grid size-10 place-items-center border border-red-200 bg-white text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>
        </li>)}</ul>}
      </div>
    </div>
  </section>;
}
