"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";

type MethodFlow = { opening: number; sales: number; credit_payments: number; other_income: number; expenses: number; closing: number };
type Reconciliation = {
  date: string;
  cash: number;
  bank: number;
  receivables: number;
  total: number;
  cash_flow: MethodFlow;
  bank_flow: MethodFlow;
  receivables_opening: number;
  credits_granted: number;
  credits_collected: number;
};
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
/** Fecha de hoy en la zona horaria del equipo (no en UTC). */
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

type Line = { label: string; value: number; sign?: "+" | "-"; strong?: boolean };

function Breakdown({ title, icon: Icon, tone, lines }: { title: string; icon: typeof Banknote; tone: string; lines: Line[] }) {
  return <article className="border border-[var(--line)] bg-white p-6">
    <div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span><h2 className="font-semibold">{title}</h2></div>
    <dl className="mt-5 space-y-2 text-sm">
      {lines.map(({ label, value, sign, strong }) => <div key={label} className={`flex items-baseline justify-between gap-4 ${strong ? "border-t border-[var(--line)] pt-3 font-semibold" : ""}`}>
        <dt className={strong ? "" : "text-[var(--muted)]"}>{label}</dt>
        <dd className={`tabular-nums ${sign === "-" ? "text-red-700" : sign === "+" ? "text-emerald-700" : ""} ${strong ? "text-lg" : ""}`}>{sign && Number(value) !== 0 ? `${sign} ` : ""}{money(Number(value))}</dd>
      </div>)}
    </dl>
  </article>;
}

const flowLines = (flow: MethodFlow): Line[] => [
  { label: "Saldo al iniciar el día", value: flow.opening },
  { label: "Ventas de contado", value: flow.sales, sign: "+" },
  { label: "Abonos y pagos de créditos", value: flow.credit_payments, sign: "+" },
  { label: "Otros ingresos", value: flow.other_income, sign: "+" },
  { label: "Egresos", value: flow.expenses, sign: "-" },
  { label: "Saldo al cierre", value: flow.closing, strong: true },
];

export default function CashReconciliationPage() {
  const [date, setDate] = useState(localToday);
  const [data, setData] = useState<Reconciliation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/financial-reports/cash-reconciliation?report_date=${date}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar el arqueo."); return result as Reconciliation; })
      .then((result) => { setData(result); setError(""); }).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar el arqueo.")));
  }, [date]);
  const cards = data ? [
    { label: "Efectivo en Caja", value: Number(data.cash), icon: Banknote, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Banco / Nequi", value: Number(data.bank), icon: CircleDollarSign, tone: "text-violet-700 bg-violet-50" },
    { label: "Cuentas por cobrar", value: Number(data.receivables), icon: CreditCard, tone: "text-amber-700 bg-amber-50" },
  ] : [];
  return <AdminPage title="Arqueo de Caja" description="Consulta el cierre financiero de la jornada con los saldos disponibles y las cuentas por cobrar.">
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <div className="mb-6 flex flex-wrap items-end gap-3 border border-[var(--line)] bg-white p-5"><label className="text-sm font-semibold">Fecha de cierre<input type="date" value={date} max={localToday()} onChange={(event) => event.target.value && setDate(event.target.value)} className="mt-2 block min-h-11 border border-[var(--line)] px-3 font-normal" /></label><p className="flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]"><CalendarDays className="text-[var(--blue-main)]" size={18} /><span className="inline-block first-letter:uppercase">{new Date(`${date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></p></div>
    {data && <>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <article className="screen flex flex-col justify-between p-7"><p className="screen-label text-sm">Saldo total al cierre</p><div><strong className="screen-amount mt-10 block text-5xl">{money(Number(data.total))}</strong><p className="screen-label mt-3 text-xs">Caja + Banco/Nequi + Créditos</p></div></article>
        <div className="grid gap-4 sm:grid-cols-3">{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className="border border-[var(--line)] bg-white p-6"><span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span><p className="mt-6 text-sm text-[var(--muted)]">{label}</p><strong className="screen-amount mt-2 block text-2xl">{money(value)}</strong><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--canvas)]"><span className="block h-full rounded-full bg-[var(--blue-main)]" style={{ width: `${Number(data.total) > 0 ? Math.max(0, Math.min(100, (value / Number(data.total)) * 100)) : 0}%` }} /></div></article>)}</div>
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Movimiento del día</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Efectivo en Caja" icon={Banknote} tone="text-emerald-700 bg-emerald-50" lines={flowLines(data.cash_flow)} />
        <Breakdown title="Banco / Nequi" icon={CircleDollarSign} tone="text-violet-700 bg-violet-50" lines={flowLines(data.bank_flow)} />
        <Breakdown title="Cuentas por cobrar" icon={CreditCard} tone="text-amber-700 bg-amber-50" lines={[
          { label: "Pendiente al iniciar el día", value: data.receivables_opening },
          { label: "Fiado en el día", value: data.credits_granted, sign: "+" },
          { label: "Cobrado en el día", value: data.credits_collected, sign: "-" },
          { label: "Pendiente al cierre", value: data.receivables, strong: true },
        ]} />
      </div>
    </>}
  </AdminPage>;
}
