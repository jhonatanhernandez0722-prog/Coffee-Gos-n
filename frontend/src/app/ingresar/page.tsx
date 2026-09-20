"use client";

import { FormEvent, useEffect, useState } from "react";
import { Banknote, Check, Delete, History, Pencil, Receipt, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";

type IncomeType = "DONATION" | "OLD_INCOME" | "CONTRIBUTION" | "OTHER";
type Income = { id: number; amount: number; person_name: string | null; income_type: IncomeType; payment_method: "CASH" | "NEQUI"; occurred_on: string; description: string; created_at: string };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const typeLabels: Record<IncomeType, string> = { DONATION: "Donación", OLD_INCOME: "Ingreso antiguo", CONTRIBUTION: "Aporte", OTHER: "Otro" };
const today = () => new Date().toISOString().slice(0, 10);

export default function IngresarPage() {
  const [amount, setAmount] = useState("");
  const [personName, setPersonName] = useState("");
  const [incomeType, setIncomeType] = useState<IncomeType>("DONATION");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "NEQUI">("CASH");
  const [occurredOn, setOccurredOn] = useState(today);
  const [description, setDescription] = useState("");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [editing, setEditing] = useState<Income | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadIncomes() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/incomes`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los ingresos.");
    setIncomes(result.incomes as Income[]);
  }
  useEffect(() => { Promise.resolve().then(loadIncomes).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los ingresos."))); }, []);

  function pressKey(key: string) {
    if (key === "clear") return setAmount("");
    if (key === "backspace") return setAmount((current) => current.slice(0, -1));
    if (key === "." && amount.includes(".")) return;
    if (amount.includes(".") && amount.split(".")[1].length >= 2) return;
    setAmount((current) => `${current}${key}`.replace(/^0+(?=\d)/, ""));
  }
  function reset() { setAmount(""); setPersonName(""); setIncomeType("DONATION"); setPaymentMethod("CASH"); setOccurredOn(today()); setDescription(""); setEditing(null); }
  function editIncome(income: Income) { setEditing(income); setAmount(String(income.amount)); setPersonName(income.person_name ?? ""); setIncomeType(income.income_type); setPaymentMethod(income.payment_method); setOccurredOn(income.occurred_on); setDescription(income.description); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function saveIncome(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (Number(amount) <= 0) return setError("El valor debe ser mayor que cero.");
    if (personName.trim().length < 2) return setError("Escribe el nombre de la persona relacionada con el ingreso.");
    if (!occurredOn || Number.isNaN(new Date(`${occurredOn}T12:00:00`).getTime())) return setError("Selecciona una fecha válida.");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(editing ? `${apiUrl}/incomes/${editing.id}` : `${apiUrl}/incomes`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ amount: Number(amount), person_name: personName.trim(), income_type: incomeType, payment_method: paymentMethod, occurred_on: occurredOn, description: description.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible guardar el ingreso.");
      setNotice(editing ? "Ingreso actualizado correctamente." : "Ingreso registrado correctamente.");
      reset(); await loadIncomes();
    } catch (requestError) { setError(userFacingError(requestError, "No fue posible guardar el ingreso.")); } finally { setSaving(false); }
  }
  async function removeIncome(id: number) {
    if (!window.confirm("¿Eliminar este ingreso? Esta acción no se puede deshacer.")) return;
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/incomes/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!response.ok) { const result = await response.json(); setError(result.detail ?? "No fue posible eliminar el ingreso."); return; }
    setIncomes((current) => current.filter((income) => income.id !== id)); setNotice("Ingreso eliminado.");
  }

  return <AdminPage title="Ingresar" description="Registra dinero recibido por fuera de las ventas, directamente desde la caja.">
    {error && <p role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-5 flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={17} />{notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(380px,520px)_1fr]">
      <form onSubmit={saveIncome} className="reveal overflow-hidden border-4 border-[#9aaea6] bg-[#edf3ee] p-3 text-[var(--ink)] shadow-2xl sm:p-5">
        <div className="flex items-center justify-between border-b-2 border-[#c4d3cc] pb-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center border-2 border-[#a7bdb3] bg-[#d7e4dc] text-[#3f6257]"><Banknote size={24} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#527269]">Cash station 01</p><h2 className="mt-1 text-xl font-bold tracking-tight">{editing ? "Editar ingreso" : "Ingreso independiente"}</h2></div></div><span className="h-3 w-3 rounded-full bg-[#86b84d] shadow-[0_0_12px_#86b84d]" aria-label="Caja lista" /> </div>
        <div className="mt-5 border-4 border-[#182326] bg-[#b7c99a] p-3 text-right text-[#1d2b25] shadow-inner"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em]"><span>Entrada manual</span><span>{occurredOn}</span></div><output className="mt-3 block min-h-16 break-all font-mono text-4xl font-bold tracking-tight sm:text-5xl">{money(Number(amount) || 0)}</output></div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-sm border-2 border-[#a8bbb2] bg-[#d5e1da] p-2">{["1","2","3","4","5","6","7","8","9","clear","0","backspace"].map((key) => <button type="button" key={key} onClick={() => pressKey(key)} aria-label={key === "backspace" ? "Borrar último dígito" : key === "clear" ? "Limpiar importe" : `Número ${key}`} className={`min-h-14 border-2 border-[#b3c1ba] bg-[#ffffff] font-mono text-xl font-bold text-[#314942] shadow-[0_3px_0_#a3b2aa] transition hover:bg-[#f7fbf8] active:translate-y-0.5 active:shadow-none ${key === "clear" ? "text-xs uppercase tracking-wide" : ""}`}>{key === "clear" ? "AC" : key === "backspace" ? <Delete className="mx-auto" size={21} /> : key}</button>)}</div>
        <button type="submit" disabled={saving} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 border-2 border-[#86a94d] bg-[#a9cf62] px-5 text-base font-extrabold uppercase tracking-wide text-[#24372d] shadow-[0_3px_0_#789a40] transition hover:bg-[#bce07a] active:translate-y-0.5 active:shadow-none disabled:opacity-60"><Check size={19} />{saving ? "Guardando..." : editing ? "Guardar cambios" : "Confirmar ingreso"}</button>
        <div className="mt-5 border-2 border-[#263538] bg-[#dfe8df] p-4 text-[#263538]"><label className="block text-sm font-bold">Persona<input required minLength={2} maxLength={120} value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre de quien entrega el dinero" className="mt-2 min-h-12 w-full border-2 border-[#9eafaa] bg-white px-3 font-normal" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Tipo<select value={incomeType} onChange={(event) => setIncomeType(event.target.value as IncomeType)} className="mt-2 min-h-12 w-full border-2 border-[#9eafaa] bg-white px-3 font-normal"><option value="DONATION">Donación</option><option value="OLD_INCOME">Ingreso antiguo</option><option value="CONTRIBUTION">Aporte</option><option value="OTHER">Otro</option></select></label><label className="text-sm font-bold">Método<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CASH" | "NEQUI")} className="mt-2 min-h-12 w-full border-2 border-[#9eafaa] bg-white px-3 font-normal"><option value="CASH">Efectivo</option><option value="NEQUI">Nequi</option></select></label></div><label className="mt-4 block text-sm font-bold">Fecha<input required type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="mt-2 min-h-12 w-full border-2 border-[#9eafaa] bg-white px-3 font-normal" /></label><label className="mt-4 block text-sm font-bold">Descripción <span className="font-normal text-[#526765]">(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Ej. aporte para caja menor" className="mt-2 w-full border-2 border-[#9eafaa] bg-white px-3 py-3 font-normal placeholder:text-[#71827e]" /></label></div>
      </form>
      <section className="border border-[var(--line)] bg-white"><div className="flex items-center gap-3 border-b border-[var(--line)] p-5"><History className="text-[var(--blue-main)]" size={22} /><div><h2 className="font-semibold">Historial de ingresos</h2><p className="mt-1 text-sm text-[var(--muted)]">{incomes.length} registros independientes</p></div></div>{incomes.length === 0 ? <p className="p-10 text-center text-sm text-[var(--muted)]">Aún no hay ingresos registrados.</p> : <div className="divide-y divide-[var(--line)]">{incomes.map((income) => <article key={income.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Receipt size={16} className="text-[var(--blue-main)]" /><strong>{typeLabels[income.income_type]}</strong></div><p className="mt-1 text-sm text-[var(--muted)]">{income.occurred_on} · {income.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}{income.description ? ` · ${income.description}` : ""}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><strong className="text-lg text-emerald-700">{money(Number(income.amount))}</strong><button title="Editar ingreso" type="button" onClick={() => editIncome(income)} className="grid size-10 place-items-center border border-[var(--line)] text-[var(--blue-main)]"><Pencil size={16} /></button><button title="Eliminar ingreso" type="button" onClick={() => void removeIncome(income.id)} className="grid size-10 place-items-center border border-red-200 text-red-700"><Trash2 size={16} /></button></div></article>)}</div>}</section>
    </div>
  </AdminPage>;
}
