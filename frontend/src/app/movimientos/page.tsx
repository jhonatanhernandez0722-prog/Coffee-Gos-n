"use client";

import { useEffect, useState } from "react";
import { Download, Pencil } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl } from "@/lib/api";

type Movement = {
  id: number;
  domain: "inventory" | "financial";
  related_id: number | null;
  product_id: number | null;
  movement_type: string;
  amount: number | null;
  quantity: number | null;
  concept: string;
  product_name: string | null;
  seller_name: string | null;
  customer_name: string | null;
  created_at: string;
};
type ProductOption = { id: number; name: string; unit: "KG" | "ML" | "UNIT"; content_quantity?: number | null; content_unit?: "KG" | "ML" | null };

const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const quantityLabel = (value: number | null) => {
  if (value === null) return "-";
  const num = Number(value);
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)).toString());
};
const labels: Record<string, string> = { SALE: "Salida por venta", PURCHASE: "Entrada de inventario", ADJUSTMENT: "Ajuste de inventario", INTERNAL_USE: "Uso interno", DAMAGE: "Pérdida por daño", INCOME: "Ingreso", EXPENSE: "Egreso" };

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [movementType, setMovementType] = useState("");
  const [editing, setEditing] = useState<Movement | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editConcept, setEditConcept] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = sessionStorage.getItem("coffee_gosen_user");
    return storedUser ? (JSON.parse(storedUser) as { role?: string }).role === "ADMIN" : false;
  });

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (movementType) params.set("movement_type", movementType);

    fetch(`${apiUrl}/movements${params.toString() ? `?${params.toString()}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los movimientos.");
        return result.movements as Movement[];
      })
      .then(setMovements)
      .catch((requestError: Error) => setError(requestError.message));
  }, [dateFrom, dateTo, movementType]);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/products?include_disabled=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((response) => response.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  function openEdit(movement: Movement) {
    setEditing(movement);
    setEditProductId(movement.product_id == null ? "" : String(movement.product_id));
    setEditQuantity(movement.quantity == null ? "" : String(movement.quantity));
    setEditAmount(movement.amount == null ? "" : String(movement.amount));
    setEditConcept(movement.concept || "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const endpoint = editing.domain === "inventory" ? `${apiUrl}/movements/inventory/${editing.id}` : `${apiUrl}/movements/financial/${editing.id}`;
      const payload = editing.domain === "inventory"
        ? {
          product_id: editProductId ? Number(editProductId) : undefined,
            quantity: editQuantity.trim() ? Number(editQuantity) : undefined,
            observation: editConcept.trim() || undefined,
          }
        : {
            amount: editAmount.trim() ? Number(editAmount) : undefined,
            concept: editConcept.trim() || undefined,
          };

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible actualizar el movimiento.");
      setMovements((current) => current.map((item) => item.id === editing.id && item.domain === editing.domain ? { ...item, quantity: result.quantity ?? item.quantity, amount: result.amount ?? item.amount, concept: result.concept ?? item.concept, seller_name: result.seller_name ?? item.seller_name, customer_name: result.customer_name ?? item.customer_name } : item));
      setEditing(null);
      setEditQuantity("");
      setEditProductId("");
      setEditAmount("");
      setEditConcept("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible actualizar el movimiento.");
    } finally {
      setSavingEdit(false);
    }
  }

  return <AdminPage title="Movimientos" description="Consulta ingresos, egresos y trazabilidad de inventario en un solo lugar.">
    {editing?.domain === "inventory" && <div className="mb-6 border border-[var(--line)] bg-white p-5"><label className="text-sm font-semibold">Producto del movimiento<select value={editProductId} onChange={(event) => setEditProductId(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"><option value="">Selecciona un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>}
    {error && <p role="alert" className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    {!error && <div className="border border-[var(--line)] bg-white"><div className="border-b border-[var(--line)] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-semibold">Registro universal</h2><p className="mt-1 text-sm text-[var(--muted)]">{movements.length} movimientos encontrados</p></div><div className="flex flex-wrap items-end gap-3 print:hidden"><label className="text-xs font-semibold">Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Tipo<select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="mt-1 block min-h-10 border border-[var(--line)] bg-white px-3 text-sm font-normal"><option value="">Todos</option><option value="SALE">Salida por venta</option><option value="INCOME">Ingreso</option><option value="EXPENSE">Egreso</option><option value="PURCHASE">Entrada de inventario</option><option value="INTERNAL_USE">Uso interno</option><option value="ADJUSTMENT">Ajuste</option></select></label><button onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"><Download size={16} /> Exportar PDF</button></div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Fecha</th><th className="p-4 font-medium">Detalle</th><th className="p-4 font-medium">Vendedor</th><th className="p-4 font-medium">Comprador</th><th className="p-4 font-medium">Movimiento</th>{isAdmin && <th className="p-4 font-medium">Acción</th>}</tr></thead><tbody>{movements.map((movement) => (<tr key={`${movement.domain}-${movement.id}`} className="border-b border-[var(--line)] align-top"><td className="p-4 whitespace-nowrap">{new Date(movement.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-4"><div className="font-medium text-[var(--ink)]">{movement.product_name ?? movement.concept}</div>{movement.quantity !== null && <div className="mt-1 text-[var(--muted)]">Cantidad: {quantityLabel(movement.quantity)}</div>}{movement.amount !== null && <div className="mt-1 text-[var(--muted)]">Monto: {money(movement.amount)}</div>}</td><td className="p-4 text-[var(--muted)]">{movement.seller_name ?? "-"}</td><td className="p-4 text-[var(--muted)]">{movement.customer_name ?? "-"}</td><td className="p-4"><span className="inline-flex rounded-full border border-[var(--line)] bg-slate-50 px-2 py-1 text-xs font-semibold text-[var(--ink)]">{labels[movement.movement_type] ?? movement.movement_type}</span></td>{isAdmin && <td className="p-4"><button type="button" onClick={() => openEdit(movement)} className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--blue-main)]"><Pencil size={14} /> Editar</button></td>}</tr>))}</tbody></table></div></div>}{editing && <div className="mt-6 border border-[var(--line)] bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Editar movimiento</h3><button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-[var(--muted)]">Cerrar</button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">{editing.domain === "inventory" ? "Cantidad" : "Monto"}<input type="number" value={editing.domain === "inventory" ? editQuantity : editAmount} onChange={(event) => editing.domain === "inventory" ? setEditQuantity(event.target.value) : setEditAmount(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="text-sm font-semibold md:col-span-2">Descripción<input value={editConcept} onChange={(event) => setEditConcept(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label></div><button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="mt-5 inline-flex min-h-11 items-center justify-center bg-[var(--blue-main)] px-5 text-sm font-semibold text-white disabled:opacity-60">{savingEdit ? "Guardando..." : "Guardar cambios"}</button></div>}</AdminPage>;
}
