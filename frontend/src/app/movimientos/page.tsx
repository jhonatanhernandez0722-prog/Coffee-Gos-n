"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp, Download } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

type Movement = { id: number; domain: "inventory" | "financial"; related_id: number | null; movement_type: string; amount: number | null; quantity: number | null; concept: string; product_name: string | null; created_at: string };
type MovementGroup = { key: string; created_at: string; inventory: string[]; financial: string[] };
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
  useEffect(() => { const token = sessionStorage.getItem("coffee_gosen_access_token"); const params = new URLSearchParams(); if (dateFrom) params.set("date_from", dateFrom); if (dateTo) params.set("date_to", dateTo); if (movementType) params.set("movement_type", movementType); fetch(`${apiUrl}/movements${params.toString() ? `?${params.toString()}` : ""}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los movimientos."); return result.movements as Movement[]; }).then(setMovements).catch((requestError: Error) => setError(requestError.message)); }, [dateFrom, dateTo, movementType]);
  const groupedMovements = movements.reduce<MovementGroup[]>((groups, movement) => {
    const key = movement.related_id ? `sale-${movement.related_id}` : `${movement.domain}-${movement.id}`;
    let group = groups.find((item) => item.key === key);
    if (!group) { group = { key, created_at: movement.created_at, inventory: [], financial: [] }; groups.push(group); }
    if (movement.domain === "inventory") group.inventory.push(`${movement.product_name ?? movement.concept} (${quantityLabel(movement.quantity)})`);
    else group.financial.push(`${labels[movement.movement_type] ?? movement.movement_type}: ${movement.amount === null ? "-" : money(movement.amount)}`);
    return groups;
  }, []);
  return <AdminPage title="Movimientos" description="Consulta ingresos, egresos y trazabilidad de inventario en un solo lugar.">
    {error && <p role="alert" className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    {!error && <div className="border border-[var(--line)] bg-white"><div className="border-b border-[var(--line)] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-semibold">Registro universal</h2><p className="mt-1 text-sm text-[var(--muted)]">{movements.length} movimientos encontrados</p></div><div className="flex flex-wrap items-end gap-3 print:hidden"><label className="text-xs font-semibold">Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] bg-white px-3 text-sm font-normal"><option value="">Todos</option><option value="SALE">Salida por venta</option><option value="INCOME">Ingreso</option><option value="EXPENSE">Egreso</option><option value="PURCHASE">Entrada de inventario</option><option value="INTERNAL_USE">Uso interno</option><option value="ADJUSTMENT">Ajuste</option></select></label><button onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"><Download size={16} /> Exportar PDF</button></div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Fecha</th><th className="p-4 font-medium">Salida de inventario</th><th className="p-4 font-medium">Movimiento financiero</th></tr></thead><tbody>{groupedMovements.map((group) => <tr key={group.key} className="border-b border-[var(--line)] last:border-0"><td className="p-4 text-[var(--muted)]">{new Date(group.created_at).toLocaleString("es-CO")}</td><td className="p-4">{group.inventory.length ? group.inventory.map((item) => <span key={item} className="block font-semibold">{item}</span>) : "-"}</td><td className="p-4">{group.financial.length ? group.financial.map((item) => <span key={item} className="block font-semibold text-[var(--blue-main)]">{item}</span>) : "-"}</td></tr>)}</tbody></table>{groupedMovements.length === 0 && <div className="p-10 text-center text-sm text-[var(--muted)]"><ArrowDownUp className="mx-auto mb-3 text-[var(--blue-main)]" size={26} />Aún no hay movimientos registrados.</div>}</div></div>}
  </AdminPage>;
}
