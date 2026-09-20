"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";

type Reconciliation = { date: string; cash: number; bank: number; receivables: number; total: number };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export default function CashReconciliationPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Reconciliation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/financial-reports/cash-reconciliation?report_date=${date}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar el arqueo."); return result as Reconciliation; })
      .then(setData).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar el arqueo.")));
  }, [date]);
  return <AdminPage title="Arqueo de Caja" description="Consulta el cierre financiero de la jornada con los saldos disponibles y las cuentas por cobrar.">
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <div className="mb-6 flex items-end gap-3 border border-[var(--line)] bg-white p-5"><label className="text-sm font-semibold">Fecha de cierre<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 block min-h-11 border border-[var(--line)] px-3 font-normal" /></label><CalendarDays className="mb-2 text-[var(--blue-main)]" size={20} /></div>
    {data && <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4"><article className="bg-white p-6"><Banknote className="text-[var(--blue-main)]" size={22} /><p className="mt-5 text-sm text-[var(--muted)]">Efectivo en Caja</p><strong className="mt-2 block text-2xl">{money(Number(data.cash))}</strong></article><article className="bg-white p-6"><CircleDollarSign className="text-[var(--blue-main)]" size={22} /><p className="mt-5 text-sm text-[var(--muted)]">Banco / Nequi</p><strong className="mt-2 block text-2xl">{money(Number(data.bank))}</strong></article><article className="bg-white p-6"><CreditCard className="text-[var(--blue-main)]" size={22} /><p className="mt-5 text-sm text-[var(--muted)]">Cuentas por cobrar</p><strong className="mt-2 block text-2xl text-amber-700">{money(Number(data.receivables))}</strong></article><article className="bg-[var(--blue-light)] p-6"><p className="text-sm font-semibold text-[var(--muted)]">Saldo total</p><strong className="mt-9 block text-3xl text-[var(--ink)]">{money(Number(data.total))}</strong><p className="mt-2 text-xs text-[var(--muted)]">Caja + Banco/Nequi + Créditos</p></article></div>}
  </AdminPage>;
}
