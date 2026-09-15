"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Download } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { downloadExcel } from "@/lib/excel";

type Movement = { id: number; domain: "inventory" | "financial"; related_id: number | null; movement_type: string; amount: number | null; quantity: number | null; concept: string; product_name: string | null; created_at: string; customer_name: string | null; seller_name: string | null; cashier_name: string | null; sale_number: string | null; payment_method: string | null; support_urls: string[] };
type UniversalMovement = { key: string; primary: Movement; details: Movement[]; support_urls: string[] };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1");
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const quantityLabel = (value: number | null) => value === null ? "-" : Number.isInteger(Number(value)) ? String(Number(value)) : String(value);
const labels: Record<string, string> = { SALE: "Salida por venta", PURCHASE: "Entrada de inventario", ADJUSTMENT: "Ajuste de inventario", INTERNAL_USE: "Uso interno", INCOME: "Ingreso", EXPENSE: "Egreso" };

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [movementType, setMovementType] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (movementType) params.set("movement_type", movementType);
    fetch(`${apiUrl}/movements${params.toString() ? `?${params.toString()}` : ""}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los movimientos."); return result.movements as Movement[]; })
      .then(setMovements)
      .catch((requestError: Error) => setError(requestError.message));
  }, [dateFrom, dateTo, movementType]);

  const universalMovements = useMemo(() => movements.reduce<UniversalMovement[]>((groups, movement) => {
    const key = movement.related_id ? `sale-${movement.related_id}` : `${movement.domain}-${movement.id}`;
    const group = groups.find((item) => item.key === key);
    if (group) {
      group.details.push(movement);
      group.support_urls = [...new Set([...group.support_urls, ...movement.support_urls])];
    } else {
      groups.push({ key, primary: movement, details: [movement], support_urls: movement.support_urls });
    }
    return groups;
  }, []), [movements]);

  const mediaUrl = (path: string) => `${apiUrl.replace("/api/v1", "")}${path}`;
  const movementLabel = (movement: Movement) => movement.domain === "financial" && movement.movement_type === "INCOME" ? `Ingreso${movement.payment_method ? ` · ${movement.payment_method === "CREDIT" ? "Crédito" : movement.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}` : ""}` : labels[movement.movement_type] ?? movement.movement_type;
  function exportMovements() { downloadExcel(universalMovements.map((group) => { const financial = group.details.find((item) => item.domain === "financial"); return { Fecha: group.primary.created_at, Tipo: group.primary.related_id ? "Venta" : movementLabel(group.primary), Detalle: group.primary.sale_number ?? group.primary.product_name ?? group.primary.concept, Cliente: group.primary.customer_name ?? "", Vendedor: group.primary.seller_name ?? "Sin asignar", Registró: group.primary.cashier_name ?? "", Valor: financial?.amount ?? "", Soportes: group.support_urls.length }; }), "movimientos.xlsx", "Movimientos"); }

  return <AdminPage title="Movimientos" description="Consulta ingresos, egresos y trazabilidad de inventario en un solo lugar.">
    {error && <p role="alert" className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <button type="button" onClick={exportMovements} className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"><Download size={16} /> Descargar Excel</button>
    {!error && <div className="border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-semibold">Registro universal</h2><p className="mt-1 text-sm text-[var(--muted)]">{universalMovements.length} registros encontrados</p></div><div className="flex flex-wrap items-end gap-3 print:hidden"><label className="text-xs font-semibold">Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] bg-white px-3 text-sm font-normal"><option value="">Todos</option><option value="SALE">Salida por venta</option><option value="INCOME">Ingreso</option><option value="EXPENSE">Egreso</option><option value="PURCHASE">Entrada de inventario</option><option value="INTERNAL_USE">Uso interno</option><option value="ADJUSTMENT">Ajuste</option></select></label><button onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"><Download size={16} /> Exportar PDF</button></div></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Fecha</th><th className="p-4 font-medium">Tipo</th><th className="p-4 font-medium">Detalle</th><th className="p-4 font-medium">Cliente</th><th className="p-4 font-medium">Vendedor</th><th className="p-4 font-medium">Registró</th><th className="p-4 font-medium">Valor</th><th className="p-4 font-medium">Soportes</th></tr></thead><tbody>{universalMovements.map((group) => { const primary = group.primary; const financial = group.details.find((item) => item.domain === "financial"); const inventory = group.details.filter((item) => item.domain === "inventory"); const isSale = Boolean(primary.related_id); return <tr key={group.key} className="border-b border-[var(--line)] last:border-0"><td className="p-4 text-[var(--muted)]">{new Date(primary.created_at).toLocaleString("es-CO")}</td><td className="p-4 font-semibold">{isSale && financial && inventory.length ? "Venta (salida + ingreso)" : movementLabel(primary)}</td><td className="p-4"><strong>{primary.sale_number ?? primary.product_name ?? primary.concept}</strong>{inventory.map((item) => <span key={item.id} className="block text-xs text-[var(--muted)]">{item.product_name}: {quantityLabel(item.quantity)} unidad(es)</span>)}</td><td className="p-4">{primary.customer_name ?? (primary.related_id ? "Venta general" : "-")}</td><td className="p-4">{primary.seller_name ?? "Sin asignar"}</td><td className="p-4">{primary.cashier_name ?? "-"}</td><td className="p-4 font-semibold text-[var(--blue-main)]">{financial?.amount === null || financial?.amount === undefined ? "-" : money(financial.amount)}</td><td className="p-4">{group.support_urls.length ? <span className="flex flex-wrap gap-2">{group.support_urls.map((url, index) => <a key={url} href={mediaUrl(url)} download target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 border border-[var(--line)] px-2 text-xs font-semibold text-[var(--blue-main)]"><Download size={14} />Soporte {index + 1}</a>)}</span> : <span className="text-[var(--muted)]">-</span>}</td></tr>; })}</tbody></table>{universalMovements.length === 0 && <div className="p-10 text-center text-sm text-[var(--muted)]"><ArrowDownUp className="mx-auto mb-3 text-[var(--blue-main)]" size={26} />Aún no hay movimientos registrados.</div>}</div>
    </div>}
  </AdminPage>;
}
