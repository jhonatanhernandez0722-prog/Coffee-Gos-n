"use client";

import { useEffect, useState } from "react";
import { CreditCard, Download } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { downloadExcel } from "@/lib/excel";

type CreditProduct = { name: string; quantity: number };
type Credit = {
  id: number;
  sale_number: string;
  customer_name: string;
  seller_name: string | null;
  cashier_name: string | null;
  original_amount: number;
  pending_amount: number;
  status: string;
  created_at: string;
  products: CreditProduct[];
  support_urls: string[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1");
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const mediaUrl = (path: string) => /^https?:\/\//i.test(path) ? path : `${apiUrl.replace("/api/v1", "")}${path}`;

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/credits`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los créditos.");
        return result.credits as Credit[];
      })
      .then(setCredits)
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  function exportCredits() {
    downloadExcel(credits.map((credit) => ({
      Venta: credit.sale_number,
      Fecha: credit.created_at,
      Cliente: credit.customer_name,
      Productos: credit.products.map((product) => `${product.quantity} x ${product.name}`).join(", "),
      Vendedor: credit.seller_name ?? "Sin asignar",
      Registró: credit.cashier_name ?? "",
      Original: credit.original_amount,
      Pendiente: credit.pending_amount,
      Estado: credit.status,
      Soportes: credit.support_urls.length,
    })), "creditos.xlsx", "Créditos");
  }

  return <AdminPage title="Créditos" description="Consulta las ventas a crédito y el saldo pendiente de cada comprador.">
    <button type="button" onClick={exportCredits} className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"><Download size={16} /> Descargar Excel</button>
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <section className="border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] p-5"><div className="flex items-center gap-3"><CreditCard className="text-[var(--blue-main)]" size={22} /><div><h2 className="font-semibold">Créditos registrados</h2><p className="mt-1 text-sm text-[var(--muted)]">{credits.length} créditos encontrados</p></div></div></div>
      {credits.length === 0 && !error ? <div className="p-10 text-center text-sm text-[var(--muted)]">Todavía no hay ventas registradas a crédito.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Venta / fecha</th><th className="p-4 font-medium">Cliente</th><th className="p-4 font-medium">Productos comprados</th><th className="p-4 font-medium">Vendedor</th><th className="p-4 font-medium">Registró</th><th className="p-4 font-medium">Saldo</th><th className="p-4 font-medium">Soportes</th></tr></thead><tbody>{credits.map((credit) => <tr key={credit.id} className="border-b border-[var(--line)] last:border-0"><td className="p-4"><strong className="block">{credit.sale_number}</strong><span className="text-xs text-[var(--muted)]">{new Date(credit.created_at).toLocaleString("es-CO")}</span></td><td className="p-4 font-semibold">{credit.customer_name}</td><td className="p-4"><ul className="space-y-1">{credit.products.length ? credit.products.map((product) => <li key={`${credit.id}-${product.name}`}><span className="font-semibold">{product.quantity} x</span> {product.name}</li>) : <li className="text-[var(--muted)]">Sin detalle</li>}</ul></td><td className="p-4">{credit.seller_name ?? "Sin asignar"}</td><td className="p-4">{credit.cashier_name ?? "-"}</td><td className="p-4"><strong>{money(Number(credit.pending_amount))}</strong><span className="mt-1 block text-xs text-[var(--muted)]">Original: {money(Number(credit.original_amount))}</span></td><td className="p-4">{credit.support_urls.length ? credit.support_urls.map((url) => <a key={url} href={mediaUrl(url)} target="_blank" rel="noreferrer" className="block text-[var(--blue-main)] underline">Ver soporte</a>) : "-"}</td></tr>)}</tbody></table></div>}
    </section>
  </AdminPage>;
}
