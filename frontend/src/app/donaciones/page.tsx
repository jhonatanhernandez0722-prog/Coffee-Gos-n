"use client";

import { useEffect, useState } from "react";
import { Banknote, Gift, History } from "lucide-react";
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
  return <AdminPage title="Donaciones" description="Consulta las donaciones registradas desde la caja de ingresos, sin duplicarlas como ventas.">
    {error && <p role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 sm:grid-cols-2"><article className="border border-[var(--blue-secondary)] bg-[var(--blue-light)] p-6"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[var(--muted)]">Total de donaciones</span><Gift className="text-[var(--blue-secondary)]" size={22} /></div><strong className="mt-6 block text-3xl tracking-tight">{money(total)}</strong></article><article className="border border-[var(--line)] bg-white p-6"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[var(--muted)]">Registros</span><Banknote className="text-[var(--blue-main)]" size={22} /></div><strong className="mt-6 block text-3xl tracking-tight">{donations.length}</strong></article></div>
    <section className="mt-6 border border-[var(--line)] bg-white"><div className="flex items-center gap-3 border-b border-[var(--line)] p-5"><History className="text-[var(--blue-main)]" size={22} /><div><h2 className="font-semibold">Historial de donaciones</h2><p className="mt-1 text-sm text-[var(--muted)]">Cada fila representa un único movimiento financiero.</p></div></div>{donations.length === 0 ? <p className="p-10 text-center text-sm text-[var(--muted)]">Aún no hay donaciones registradas.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Fecha</th><th className="p-4 font-medium">Valor</th><th className="p-4 font-medium">Método</th><th className="p-4 font-medium">Descripción</th><th className="p-4 font-medium">Creado</th></tr></thead><tbody>{donations.map((donation) => <tr key={donation.id} className="border-b border-[var(--line)] last:border-0"><td className="p-4">{donation.occurred_on}</td><td className="p-4 font-semibold text-emerald-700">{money(Number(donation.amount))}</td><td className="p-4">{donation.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}</td><td className="p-4">{donation.description || "Sin descripción"}</td><td className="p-4 text-[var(--muted)]">{new Date(donation.created_at).toLocaleString("es-CO")}</td></tr>)}</tbody></table></div>}</section>
  </AdminPage>;
}
