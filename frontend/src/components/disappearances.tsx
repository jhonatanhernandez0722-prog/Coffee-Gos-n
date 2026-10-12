"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CircleHelp, SearchX, X } from "lucide-react";
import { apiUrl, userFacingError } from "@/lib/api";

type Unit = "KG" | "ML" | "UNIT" | "PAQUETE";
type Resolution = "FOUND" | "SALE" | "INTERNAL_USE" | "DAMAGE";
type PaymentMethod = "CASH" | "NEQUI" | "CREDIT";

export type MissingProduct = { id: number; name: string; unit?: Unit; stock: number };

type Disappearance = {
  id: number;
  product_id: number;
  product_name: string;
  product_unit: Unit;
  is_saleable: boolean;
  sale_price: number;
  acquisition_cost: number;
  quantity: number;
  observation: string | null;
  reported_by: string | null;
  status: "PENDING" | "RESOLVED";
  resolution: Resolution | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  days_missing: number;
};
type Seller = { id: number; full_name: string };

const unitLabels: Record<Unit, string> = { KG: "kg", ML: "ml", UNIT: "unidad", PAQUETE: "paquete" };
const resolutionLabels: Record<Resolution, string> = {
  FOUND: "Apareció",
  SALE: "Venta",
  INTERNAL_USE: "Uso interno",
  DAMAGE: "Pérdida",
};
const money = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const quantityLabel = (value: number, unit: Unit) =>
  `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(Number(value))} ${unitLabels[unit]}`;
const isWholeUnit = (unit?: Unit) => unit === undefined || unit === "UNIT" || unit === "PAQUETE";
const daysLabel = (days: number) => (days === 0 ? "Hoy" : days === 1 ? "Hace 1 día" : `Hace ${days} días`);

function authHeaders(json = false): HeadersInit {
  const token = sessionStorage.getItem("coffee_gosen_access_token");
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, init);
  const result = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(result.detail)
      ? result.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(". ")
      : result.detail;
    throw new Error(detail || "No fue posible completar la acción.");
  }
  return result as T;
}

/** Ventana para sacar del stock unidades que desaparecieron, sin contarlas como venta, uso ni pérdida. */
export function ReportDisappearanceDialog({
  product,
  onClose,
  onReported,
}: {
  product: MissingProduct;
  onClose: () => void;
  onReported: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const whole = isWholeUnit(product.unit);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(product.stock) || (whole && !Number.isInteger(amount))) {
      setError("La cantidad debe ser mayor a cero y no superar el stock disponible.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request("/inventory/disappearances", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ product_id: product.id, quantity: amount, observation: observation.trim() || null }),
      });
      onReported();
    } catch (requestError) {
      setError(userFacingError(requestError, "No fue posible registrar la desaparición."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Desaparición</p>
            <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar desaparición"><X size={19} /></button>
        </div>
        <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Las unidades salen del stock pero <strong>no cuentan como venta, uso interno ni pérdida</strong>. Quedan en
          “Desaparecidos” hasta que decidas qué pasó: si aparecen vuelven al stock, o las registras como venta, uso interno o pérdida.
        </p>
        <label className="mt-5 block text-sm font-semibold">
          Cantidad ({unitLabels[product.unit ?? "UNIT"]}) · disponible: {quantityLabel(product.stock, product.unit ?? "UNIT")}
          <input
            required
            type="number"
            min={whole ? "1" : "0.001"}
            step={whole ? "1" : "0.001"}
            max={Number(product.stock)}
            inputMode={whole ? "numeric" : "decimal"}
            value={quantity}
            onChange={(event) => setQuantity(whole ? event.target.value.replace(/[^0-9]/g, "") : event.target.value)}
            className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Observación (opcional)
          <textarea
            maxLength={500}
            rows={3}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Ej. No aparece en la nevera al hacer el conteo"
            className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal"
          />
        </label>
        {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">Cancelar</button>
          <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
            <SearchX size={16} /> {saving ? "Registrando..." : "Registrar desaparición"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResolveDialog({
  item,
  onClose,
  onResolved,
}: {
  item: Disappearance;
  onClose: () => void;
  onResolved: () => void;
}) {
  const canSell = item.is_saleable && Number.isInteger(Number(item.quantity));
  const [resolution, setResolution] = useState<Resolution>("FOUND");
  const [observation, setObservation] = useState("");
  const [unitCost, setUnitCost] = useState(Number(item.acquisition_cost) > 0 ? String(Number(item.acquisition_cost)) : "");
  const [buyerName, setBuyerName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saleTotal = Number(item.sale_price) * Number(item.quantity);

  useEffect(() => {
    if (resolution !== "SALE" || sellers.length) return;
    request<Seller[]>("/users/available", { headers: authHeaders() })
      .then(setSellers)
      .catch(() => setSellers([]));
  }, [resolution, sellers.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resolution === "DAMAGE" && !(Number(unitCost) > 0)) {
      setError("Indica el costo unitario de la pérdida.");
      return;
    }
    if (resolution === "SALE" && (!buyerName.trim() || !sellerId)) {
      setError("Indica el cliente y el vendedor de la venta.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(`/inventory/disappearances/${item.id}/resolve`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          resolution,
          observation: observation.trim() || null,
          unit_cost: resolution === "DAMAGE" ? Number(unitCost) : null,
          sale: resolution === "SALE"
            ? { buyer_name: buyerName.trim(), assigned_seller_id: Number(sellerId), payment_method: paymentMethod, amount_received: paymentMethod === "CASH" ? saleTotal : null }
            : null,
        }),
      });
      onResolved();
    } catch (requestError) {
      setError(userFacingError(requestError, "No fue posible resolver la desaparición."));
    } finally {
      setSaving(false);
    }
  }

  const options: { value: Resolution; detail: string; disabled?: boolean }[] = [
    { value: "FOUND", detail: "Las unidades vuelven al stock. No cuenta como nada." },
    { value: "SALE", detail: canSell ? `Se registra una venta por ${money(saleTotal)}.` : "Solo para productos de venta en unidades enteras.", disabled: !canSell },
    { value: "INTERNAL_USE", detail: "Baja del stock sin ingreso ni pérdida." },
    { value: "DAMAGE", detail: "Se registra como pérdida (costo), sin salida de caja." },
  ];

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-[var(--line)] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">¿Qué pasó con el producto?</p>
            <h2 className="mt-1 text-lg font-semibold">{item.product_name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{quantityLabel(item.quantity, item.product_unit)} · {daysLabel(item.days_missing).toLowerCase()}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
        <fieldset className="mt-5 grid gap-2">
          <legend className="sr-only">Resolución</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${resolution === option.value ? "border-[var(--blue-main)] bg-[var(--blue-light)]" : "border-[var(--line)]"} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="resolution"
                value={option.value}
                disabled={option.disabled}
                checked={resolution === option.value}
                onChange={() => setResolution(option.value)}
                className="mt-1"
              />
              <span>
                <strong className="block">{resolutionLabels[option.value]}</strong>
                <span className="text-xs text-[var(--muted)]">{option.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {resolution === "DAMAGE" && (
          <label className="mt-4 block text-sm font-semibold">
            Costo unitario
            <input required min="1" step="any" type="number" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" />
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Pérdida total: {money((Number(unitCost) || 0) * Number(item.quantity))}</span>
          </label>
        )}
        {resolution === "SALE" && (
          <div className="mt-4 grid gap-4">
            <label className="block text-sm font-semibold">
              Cliente
              <input required maxLength={150} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold">
              Vendedor
              <select required value={sellerId} onChange={(event) => setSellerId(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal">
                <option value="">Selecciona un vendedor</option>
                {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Medio de pago
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal">
                <option value="CASH">Efectivo</option>
                <option value="NEQUI">Nequi</option>
                <option value="CREDIT">Crédito</option>
              </select>
            </label>
          </div>
        )}
        {resolution !== "FOUND" && (
          <label className="mt-4 block text-sm font-semibold">
            Observación (opcional)
            <textarea maxLength={500} rows={2} value={observation} onChange={(event) => setObservation(event.target.value)} className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal" />
          </label>
        )}
        {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">Cancelar</button>
          <button disabled={saving} className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Guardando..." : `Confirmar: ${resolutionLabels[resolution].toLowerCase()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Lista de desapariciones pendientes (y el historial) con la opción de resolverlas cuando quieras. */
export function DisappearancesPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [view, setView] = useState<"PENDING" | "RESOLVED">("PENDING");
  const [items, setItems] = useState<Disappearance[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [target, setTarget] = useState<Disappearance | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    request<Disappearance[]>(`/inventory/disappearances?status=${view}`, { headers: authHeaders() })
      .then((result) => {
        setItems(result);
        if (view === "PENDING") setPendingCount(result.length);
        setError("");
      })
      .catch((requestError) => setError(userFacingError(requestError, "No fue posible cargar las desapariciones.")));
  }, [view, refreshKey, reload]);

  if (pendingCount === 0 && view === "PENDING" && !error) {
    return (
      <button type="button" onClick={() => setView("RESOLVED")} className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]">
        <SearchX size={16} /> Historial de desaparecidos
      </button>
    );
  }

  return (
    <section className="mb-6 border border-amber-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-3">
          <SearchX size={20} className="text-amber-700" />
          <div>
            <h2 className="font-bold text-amber-950">Desaparecidos</h2>
            <p className="text-xs text-amber-900">Fuera del stock sin contar como venta, uso ni pérdida hasta que decidas qué pasó.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView("PENDING")} className={`min-h-9 border px-3 text-xs font-semibold ${view === "PENDING" ? "border-amber-600 bg-amber-600 text-white" : "border-amber-200 bg-white text-amber-900"}`}>
            Pendientes ({pendingCount})
          </button>
          <button type="button" onClick={() => setView("RESOLVED")} className={`min-h-9 border px-3 text-xs font-semibold ${view === "RESOLVED" ? "border-amber-600 bg-amber-600 text-white" : "border-amber-200 bg-white text-amber-900"}`}>
            Historial
          </button>
        </div>
      </div>
      {error && <p role="alert" className="m-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {items.length === 0 && !error ? (
        <p className="p-6 text-center text-sm text-[var(--muted)]">{view === "PENDING" ? "No hay productos desaparecidos." : "Todavía no hay desapariciones resueltas."}</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {items.map((item) => {
            const overdue = item.status === "PENDING" && item.days_missing >= 7;
            return (
              <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <strong className="block">{item.product_name}</strong>
                  <span className="text-sm text-[var(--muted)]">
                    {quantityLabel(item.quantity, item.product_unit)} · {new Date(item.created_at).toLocaleDateString("es-CO")} · {daysLabel(item.days_missing)}
                    {item.reported_by ? ` · reportó ${item.reported_by}` : ""}
                  </span>
                  {item.observation && <span className="mt-1 block text-xs text-[var(--muted)]">{item.observation}</span>}
                  {overdue && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <CircleHelp size={12} /> Más de una semana sin aparecer: decide qué pasó
                    </span>
                  )}
                  {item.status === "RESOLVED" && item.resolution && (
                    <span className="mt-1.5 inline-flex rounded-full bg-[var(--blue-light)] px-2 py-0.5 text-xs font-semibold text-[var(--blue-secondary)]">
                      {resolutionLabels[item.resolution]}{item.resolved_at ? ` · ${new Date(item.resolved_at).toLocaleDateString("es-CO")}` : ""}{item.resolved_by ? ` · ${item.resolved_by}` : ""}
                    </span>
                  )}
                </div>
                {item.status === "PENDING" && (
                  <button type="button" onClick={() => setTarget(item)} className="min-h-9 shrink-0 self-start bg-[var(--blue-main)] px-3 text-xs font-semibold text-white sm:self-auto">
                    Resolver
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {target && (
        <ResolveDialog
          item={target}
          onClose={() => setTarget(null)}
          onResolved={() => {
            setTarget(null);
            setReload((value) => value + 1);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
