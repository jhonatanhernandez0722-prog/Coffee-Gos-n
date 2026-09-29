"use client";

import { FormEvent, useEffect, useState } from "react";
import { Banknote, CalendarDays, Check, Delete, HandCoins, History, Pencil, Smartphone, Trash2, UserRound, X } from "lucide-react";
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

  const historyTotal = incomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const typeOptions: IncomeType[] = ["DONATION", "OLD_INCOME", "CONTRIBUTION", "OTHER"];

  return <AdminPage title="Ingresar" description="Registra dinero recibido por fuera de las ventas, directamente desde la caja.">
    {error && <p role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="pop mb-5 flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={17} />{notice}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(380px,500px)_1fr]">
      <form onSubmit={saveIncome} className="reveal border border-[var(--line)] bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="brand-mark size-11"><Banknote size={22} /></span>
            <div><h2 className="text-lg font-bold leading-tight">{editing ? "Editar ingreso" : "Ingreso independiente"}</h2><p className="text-sm text-[var(--muted)]">{editing ? "Estás modificando un registro existente." : "Dinero que entra sin pasar por una venta."}</p></div>
          </div>
          {editing ? <button type="button" onClick={reset} className="choice shrink-0" aria-label="Cancelar edición"><X size={16} /><span className="hidden sm:inline">Cancelar</span></button> : <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-emerald-700"><span className="pulse-dot size-2.5 rounded-full bg-emerald-500" />Caja lista</span>}
        </div>

        <div className="screen mt-6 p-5 text-right">
          <div className="screen-label flex items-center justify-between text-xs font-semibold"><span>Entrada manual</span><span className="flex items-center gap-1.5"><CalendarDays size={13} />{occurredOn}</span></div>
          <output className="screen-amount mt-4 block min-h-14 break-all text-5xl sm:text-6xl">{money(Number(amount) || 0)}</output>
          <p className="screen-label mt-3 text-xs">{typeLabels[incomeType]} · {paymentMethod === "NEQUI" ? "Nequi" : "Efectivo"}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">{["1","2","3","4","5","6","7","8","9","clear","0","backspace"].map((key) => <button type="button" key={key} onClick={() => pressKey(key)} aria-label={key === "backspace" ? "Borrar último dígito" : key === "clear" ? "Limpiar importe" : `Número ${key}`} className={`key ${key === "clear" ? "!text-sm !text-red-700" : key === "backspace" ? "!text-[var(--muted)]" : ""}`}>{key === "clear" ? "AC" : key === "backspace" ? <Delete size={22} /> : key}</button>)}</div>

        <fieldset className="mt-6"><legend className="text-sm font-semibold">Tipo de ingreso</legend><div className="mt-2 grid grid-cols-2 gap-2">{typeOptions.map((option) => <button key={option} type="button" aria-pressed={incomeType === option} onClick={() => setIncomeType(option)} className="choice">{typeLabels[option]}</button>)}</div></fieldset>
        <fieldset className="mt-4"><legend className="text-sm font-semibold">Método</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" aria-pressed={paymentMethod === "CASH"} onClick={() => setPaymentMethod("CASH")} className="choice"><Banknote size={16} />Efectivo</button><button type="button" aria-pressed={paymentMethod === "NEQUI"} onClick={() => setPaymentMethod("NEQUI")} className="choice"><Smartphone size={16} />Nequi</button></div></fieldset>

        <label className="mt-5 block text-sm font-semibold">Persona<input required minLength={2} maxLength={120} value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nombre de quien entrega el dinero" className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal" /></label>
        <label className="mt-4 block text-sm font-semibold">Fecha<input required type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal" /></label>
        <label className="mt-4 block text-sm font-semibold">Descripción <span className="font-normal text-[var(--muted)]">(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Ej. aporte para caja menor" className="mt-2 w-full border border-[var(--line)] px-3 py-3 font-normal" /></label>

        <button type="submit" disabled={saving} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 bg-[var(--blue-main)] px-5 text-base font-bold text-white transition hover:bg-[var(--blue-secondary)] disabled:opacity-60"><Check size={19} />{saving ? "Guardando..." : editing ? "Guardar cambios" : "Confirmar ingreso"}</button>
      </form>

      <section className="border border-[var(--line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[var(--blue-light)] text-[var(--blue-main)]"><History size={20} /></span><div><h2 className="text-lg font-bold">Historial de ingresos</h2><p className="text-sm text-[var(--muted)]">{incomes.length} registros independientes</p></div></div>
          {incomes.length > 0 && <div className="text-right"><p className="text-xs font-semibold text-[var(--muted)]">Total registrado</p><strong className="font-heading text-2xl tracking-tight text-emerald-700">{money(historyTotal)}</strong></div>}
        </div>
        {incomes.length === 0 ? <div className="grid place-items-center gap-3 p-12 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-[var(--blue-light)] text-[var(--blue-main)]"><HandCoins size={26} /></span><p className="font-semibold">Aún no hay ingresos registrados.</p><p className="max-w-xs text-sm text-[var(--muted)]">Marca el valor en el teclado y confirma para crear el primero.</p></div> : <div className="divide-y divide-[var(--line)]">{incomes.map((income) => <article key={income.id} className={`flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-6 ${editing?.id === income.id ? "bg-[var(--blue-light)]" : "hover:bg-[var(--canvas)]"}`}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${income.payment_method === "NEQUI" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{income.payment_method === "NEQUI" ? <Smartphone size={18} /> : <Banknote size={18} />}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><strong>{typeLabels[income.income_type]}</strong><span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">{income.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}</span></div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">{income.person_name && <span className="inline-flex items-center gap-1"><UserRound size={13} />{income.person_name}</span>}<span className="inline-flex items-center gap-1"><CalendarDays size={13} />{income.occurred_on}</span></p>
              {income.description && <p className="mt-1 truncate text-sm text-[var(--muted)]">{income.description}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end"><strong className="mr-2 font-heading text-xl tracking-tight text-emerald-700">+{money(Number(income.amount))}</strong><button title="Editar ingreso" type="button" onClick={() => editIncome(income)} className="grid size-10 place-items-center border border-[var(--line)] bg-white text-[var(--blue-main)] hover:border-[var(--blue-main)]"><Pencil size={16} /></button><button title="Eliminar ingreso" type="button" onClick={() => void removeIncome(income.id)} className="grid size-10 place-items-center border border-red-200 bg-white text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>
        </article>)}</div>}
      </section>
    </div>
  </AdminPage>;
}
