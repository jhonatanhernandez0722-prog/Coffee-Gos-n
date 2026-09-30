"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, Phone, Search, ShoppingBag, Users, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadPdfReport } from "@/lib/pdf";

type Customer = { id: number; name: string; phone: string | null; purchase_count: number; total_spent: number; pending_credit: number; last_purchase_at: string | null };
type CustomerDashboard = { total_customers: number; total_purchases: number; total_spent: number; pending_credits: number; purchases_today: number; customers: Customer[] };
type ExportedSale = { sale_number: string; total: string; payment_method: string; created_at: string; items: { product: string; quantity: string; unit_price: string }[] };
type ExportedCredit = { original_amount: string; pending_amount: string; status: string; created_at: string };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const units = (value: string | number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(Number(value));
const paymentLabels: Record<string, string> = { CASH: "Efectivo", NEQUI: "Transferencia (Nequi)", CREDIT: "Crédito" };
const creditStatusLabels: Record<string, string> = { PENDING: "Pendiente", PAID: "Pagado" };

export default function ClientsPage() {
  const [data, setData] = useState<CustomerDashboard | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  useEffect(() => { const token = sessionStorage.getItem("coffee_gosen_access_token"); fetch(`${apiUrl}/customers/summary`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los clientes."); return result as CustomerDashboard; }).then(setData).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los clientes."))); }, []);

  async function exportCustomer(customer: Customer) {
    setError("");
    setExportingId(customer.id);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/customers/${customer.id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? result.detail ?? "No fue posible exportar el cliente.");
      const sales = result.sales as ExportedSale[];
      const credits = result.credits as ExportedCredit[];
      const totalBought = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
      const pending = credits.reduce((sum, credit) => sum + (credit.status === "PENDING" ? Number(credit.pending_amount) : 0), 0);
      await downloadPdfReport({
        title: customer.name,
        subtitle: `Reporte de cliente${customer.phone ? ` · ${customer.phone}` : ""}`,
        filename: `cliente-${customer.name.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-")}.pdf`,
        summary: [["Total comprado", money(totalBought)], ["Compras", String(sales.length)], ["Saldo pendiente", money(pending)]],
        sections: [
          {
            heading: "Compras",
            columns: ["Venta", "Fecha", "Pago", "Productos", "Total"],
            rows: sales.map((sale) => [
              sale.sale_number,
              new Date(sale.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
              paymentLabels[sale.payment_method] ?? sale.payment_method,
              sale.items.map((item) => `${units(item.quantity)} x ${item.product}`).join("\n"),
              money(Number(sale.total)),
            ]),
            emptyText: "No hay compras registradas.",
            alignRight: [4],
          },
          {
            heading: "Créditos",
            columns: ["Fecha", "Original", "Pendiente", "Estado"],
            rows: credits.map((credit) => [
              new Date(credit.created_at).toLocaleDateString("es-CO"),
              money(Number(credit.original_amount)),
              money(Number(credit.pending_amount)),
              creditStatusLabels[credit.status] ?? credit.status,
            ]),
            emptyText: "No hay créditos registrados.",
          },
        ],
      });
    } catch (requestError) {
      setError(userFacingError(requestError, "No fue posible exportar el cliente."));
    } finally {
      setExportingId(null);
    }
  }

  const customers = (data?.customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase())) ?? [])
    .sort((first, second) => (second.last_purchase_at ? new Date(second.last_purchase_at).getTime() : 0) - (first.last_purchase_at ? new Date(first.last_purchase_at).getTime() : 0));
  const stats = data ? [
    { label: "Clientes registrados", value: String(data.total_customers) },
    { label: "Compras registradas", value: String(data.total_purchases) },
    { label: "Total gastado", value: money(data.total_spent) },
    { label: "Cuentas pendientes", value: money(data.pending_credits) },
    { label: "Compras hoy", value: String(data.purchases_today) },
  ] : [];

  return <AdminPage title="Clientes" description="Consulta compras, cuentas pendientes y exporta el historial completo de cada cliente.">
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value }, index) => <div key={label} className={index === 0 ? "screen p-5" : "border border-[var(--line)] bg-white p-5"}><p className={`text-sm ${index === 0 ? "screen-label" : "text-[var(--muted)]"}`}>{label}</p><p className={`screen-amount mt-3 text-2xl ${index === 3 && data.pending_credits > 0 ? "text-amber-700" : ""}`}>{value}</p></div>)}
      </div>
      <section className="mt-6 border border-[var(--line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5">
          <div><h2 className="text-lg font-bold">Historial por cliente</h2><p className="text-sm text-[var(--muted)]">Ordenados por la compra más reciente.</p></div>
          <label className="relative block w-full max-w-sm"><span className="sr-only">Buscar clientes</span><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente" className="min-h-11 w-full border border-[var(--line)] pl-10 pr-10" />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-[var(--muted)]"><X size={15} /></button>}</label>
        </div>
        {customers.length === 0 ? <div className="grid place-items-center gap-3 p-12 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-[var(--blue-light)] text-[var(--blue-main)]"><Users size={26} /></span><p className="font-semibold">{search ? `Ningún cliente coincide con “${search}”.` : "No hay clientes registrados."}</p>{!search && <p className="max-w-xs text-sm text-[var(--muted)]">Los clientes se crean al registrar una venta con su nombre.</p>}</div> :
        <div className="divide-y divide-[var(--line)]">{customers.map((customer) => <article key={customer.id} className="grid gap-4 p-5 transition-colors hover:bg-[var(--canvas)] sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="brand-mark size-11 shrink-0 font-heading text-base font-bold">{customer.name.charAt(0).toUpperCase()}</span><div className="min-w-0"><strong className="block truncate">{customer.name}</strong><span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--muted)]">{customer.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{customer.phone}</span>}<span className="inline-flex items-center gap-1"><CalendarDays size={12} />{customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "Sin compras"}</span></span></div></div>
          <div><p className="text-xs text-[var(--muted)]">Compras</p><p className="flex items-center gap-1.5 font-semibold"><ShoppingBag size={14} className="text-[var(--blue-main)]" />{customer.purchase_count}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Total gastado</p><p className="font-semibold">{money(customer.total_spent)}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Pendiente</p>{Number(customer.pending_credit) > 0 ? <p className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-800">{money(customer.pending_credit)}</p> : <p className="text-sm font-semibold text-emerald-700">Al día</p>}</div>
          <button onClick={() => void exportCustomer(customer)} disabled={exportingId === customer.id} title="Descargar reporte PDF del cliente" aria-label={`Descargar PDF de ${customer.name}`} className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--blue-main)] hover:border-[var(--blue-main)] disabled:opacity-60"><Download size={16} /> {exportingId === customer.id ? "Generando..." : "PDF"}</button>
        </article>)}</div>}
      </section>
    </>}
  </AdminPage>;
}
