"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, Gift, HandHeart, History } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";

type Donation = { id: number; amount: number; person_name: string | null; payment_method: "CASH" | "NEQUI"; occurred_on: string; description: string; created_at: string };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/incomes/donations`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar las donaciones."); return result as { incomes: Donation[]; total: number }; })
      .then((result) => { setDonations(result.incomes); setTotal(Number(result.total)); })
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar las donaciones.")));
  }, []);
  const cashTotal = donations.filter((donation) => donation.payment_method === "CASH").reduce((sum, donation) => sum + Number(donation.amount), 0);
  return <AdminPage title="Donaciones" description="Consulta las donaciones registradas desde la caja de ingresos, sin duplicarlas como ventas.">
    {error && <p role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <article className="screen p-6"><div className="screen-label flex items-center justify-between text-sm">Total de donaciones<Gift size={20} /></div><strong className="screen-amount mt-5 block text-4xl">{money(total)}</strong></article>
      <article className="border border-[var(--line)] bg-white p-6"><div className="flex items-center justify-between text-sm text-[var(--muted)]">Registros<HandHeart className="text-[var(--blue-main)]" size={20} /></div><strong className="screen-amount mt-5 block text-4xl">{donations.length}</strong></article>
      <article className="border border-[var(--line)] bg-white p-6"><div className="flex items-center justify-between text-sm text-[var(--muted)]">Efectivo / Nequi<Banknote className="text-[var(--blue-main)]" size={20} /></div><p className="mt-5 text-lg font-bold">{money(cashTotal)} <span className="font-normal text-[var(--muted)]">/</span> {money(total - cashTotal)}</p></article>
    </div>
    <section className="mt-6 border border-[var(--line)] bg-white">
      <div className="flex items-center gap-3 border-b border-[var(--line)] p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-xl bg-[var(--blue-light)] text-[var(--blue-main)]"><History size={20} /></span><div><h2 className="text-lg font-bold">Historial de donaciones</h2><p className="text-sm text-[var(--muted)]">Cada fila representa un único movimiento financiero.</p></div></div>
      {donations.length === 0 ? <div className="grid place-items-center gap-3 p-12 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-[var(--blue-light)] text-[var(--blue-main)]"><Gift size={26} /></span><p className="font-semibold">Aún no hay donaciones registradas.</p><p className="max-w-xs text-sm text-[var(--muted)]">Regístralas desde Ingresar eligiendo el tipo Donación.</p></div> :
      <div className="divide-y divide-[var(--line)]">{donations.map((donation) => <article key={donation.id} className="flex flex-col gap-3 p-5 transition-colors hover:bg-[var(--canvas)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3"><span className="brand-mark size-10 shrink-0 font-heading font-bold">{(donation.person_name ?? "D").charAt(0).toUpperCase()}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{donation.person_name ?? "Donante sin nombre"}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${donation.payment_method === "NEQUI" ? "bg-violet-50 text-violet-800" : "bg-emerald-50 text-emerald-800"}`}>{donation.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}</span></div><p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[var(--muted)]"><span className="inline-flex items-center gap-1"><CalendarDays size={13} />{donation.occurred_on}</span><span className="truncate">{donation.description || "Sin descripción"}</span></p></div></div>
        <div className="text-right"><strong className="font-heading text-xl tracking-tight text-emerald-700">+{money(Number(donation.amount))}</strong><p className="text-xs text-[var(--muted)]">Registrado {new Date(donation.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</p></div>
      </article>)}</div>}
    </section>
  </AdminPage>;
}
