"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CreditCard, Download, HandCoins, Trash2, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
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

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
const quantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(value);
const mediaUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${apiUrl.replace("/api/v1", "")}${path}`;

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [error, setError] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "NEQUI">("CASH");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = sessionStorage.getItem("coffee_gosen_user");
    return storedUser
      ? (JSON.parse(storedUser) as { role?: string }).role === "ADMIN"
      : false;
  });

  async function loadCredits() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/credits`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.detail ?? "No fue posible cargar los créditos.");
    setCredits(result.credits as Credit[]);
  }

  useEffect(() => {
    Promise.resolve()
      .then(loadCredits)
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los créditos.")));
  }, []);

  function openPayment(credit: Credit, fullPayment: boolean) {
    setPaymentTarget(credit);
    setPaymentAmount(fullPayment ? String(credit.pending_amount) : "");
    setPaymentMethod("CASH");
    setError("");
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > Number(paymentTarget.pending_amount)
    ) {
      setError(
        "El monto debe ser mayor que cero y no superar el saldo pendiente.",
      );
      return;
    }
    setPaymentSaving(true);
    setError("");
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(
        `${apiUrl}/credits/${paymentTarget.id}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ amount, payment_method: paymentMethod }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "No fue posible registrar el pago.");
      setPaymentTarget(null);
      setPaymentAmount("");
      await loadCredits();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? userFacingError(requestError, "No fue posible registrar el abono.")
          : "No fue posible registrar el pago.",
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  async function deleteCredit(credit: Credit) {
    if (!window.confirm("¿Eliminar este crédito y la venta asociada? Esta acción restaurará el stock.")) return;
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/credits/${credit.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.detail ?? "No fue posible eliminar el crédito.");
      setCredits((current) => current.filter((item) => item.id !== credit.id));
    } catch (requestError) {
      setError(userFacingError(requestError, "No fue posible eliminar el crédito."));
    }
  }

  function exportCredits() {
    downloadExcel(
      credits.map((credit) => ({
        Venta: credit.sale_number,
        Fecha: credit.created_at,
        Cliente: credit.customer_name,
        Productos: credit.products
          .map((product) => `${product.quantity} x ${product.name}`)
          .join(", "),
        Vendedor: credit.seller_name ?? "Sin asignar",
        Registró: credit.cashier_name ?? "",
        Original: credit.original_amount,
        Pendiente: credit.pending_amount,
        Estado: credit.status,
        Soportes: credit.support_urls.length,
      })),
      "creditos.xlsx",
      "Créditos",
    );
  }

  return (
    <AdminPage
      title="Créditos"
      description="Consulta las ventas a crédito y el saldo pendiente de cada comprador."
    >
      <button
        type="button"
        onClick={exportCredits}
        className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
      >
        <Download size={16} /> Descargar Excel
      </button>
      {error && (
        <p
          role="alert"
          className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <section className="border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="text-[var(--blue-main)]" size={22} />
            <div>
              <h2 className="font-semibold">Créditos registrados</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {credits.length} créditos encontrados
              </p>
            </div>
          </div>
        </div>
        {credits.length === 0 && !error ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            Todavía no hay ventas registradas a crédito.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-4 font-medium">Venta / fecha</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Productos comprados</th>
                  <th className="p-4 font-medium">Vendedor</th>
                  <th className="p-4 font-medium">Registró</th>
                  <th className="p-4 font-medium">Saldo</th>
                  <th className="p-4 font-medium">Soportes</th>
                  <th className="p-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr
                    key={credit.id}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="p-4">
                      <strong className="block">{credit.sale_number}</strong>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(credit.created_at).toLocaleString("es-CO")}
                      </span>
                    </td>
                    <td className="p-4 font-semibold">
                      {credit.customer_name}
                    </td>
                    <td className="p-4">
                      <ul className="space-y-1">
                        {credit.products.length ? (
                          credit.products.map((product) => (
                            <li key={`${credit.id}-${product.name}`}>
                              <span className="font-semibold">
                                {quantity(Number(product.quantity))} x
                              </span>{" "}
                              {product.name}
                            </li>
                          ))
                        ) : (
                          <li className="text-[var(--muted)]">Sin detalle</li>
                        )}
                      </ul>
                    </td>
                    <td className="p-4">
                      {credit.seller_name ?? "Sin asignar"}
                    </td>
                    <td className="p-4">{credit.cashier_name ?? "-"}</td>
                    <td className="p-4">
                      <strong>{money(Number(credit.pending_amount))}</strong>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        Original: {money(Number(credit.original_amount))}
                      </span>
                    </td>
                    <td className="p-4">
                      {credit.support_urls.length
                        ? credit.support_urls.map((url) => (
                            <a
                              key={url}
                              href={mediaUrl(url)}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-[var(--blue-main)] underline"
                            >
                              Ver soporte
                            </a>
                          ))
                        : "-"}
                    </td>
                    <td className="p-4">
                      {credit.status === "PENDING" ? (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openPayment(credit, true)}
                            className="inline-flex min-h-9 items-center justify-center gap-2 bg-[var(--blue-main)] px-3 text-xs font-semibold text-white"
                          >
                            <HandCoins size={14} /> Pago completo
                          </button>
                          <button
                            type="button"
                            onClick={() => openPayment(credit, false)}
                            className="min-h-9 border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue-main)]"
                          >
                            Abono
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => deleteCredit(credit)}
                              className="inline-flex min-h-9 items-center justify-center gap-2 border border-red-200 px-3 text-xs font-semibold text-red-700"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-semibold text-emerald-700">Pagado</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => deleteCredit(credit)}
                              className="inline-flex min-h-9 items-center justify-center gap-2 border border-red-200 px-3 text-xs font-semibold text-red-700"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {paymentTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">
                  {paymentAmount === String(paymentTarget.pending_amount)
                    ? "Liquidar crédito"
                    : "Registrar abono"}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {paymentTarget.customer_name}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Saldo: {money(Number(paymentTarget.pending_amount))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                aria-label="Cerrar pago"
              >
                <X size={19} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Monto
              <input
                required
                min="1"
                max={Number(paymentTarget.pending_amount)}
                step="1"
                inputMode="numeric"
                type="number"
                value={paymentAmount}
                onKeyDown={(event) => {
                  if ([".", ",", "e", "E", "+", "-"].includes(event.key)) {
                    event.preventDefault();
                  }
                }}
                onChange={(event) => {
                  const sanitized = event.target.value.replace(/[^0-9]/g, "");
                  setPaymentAmount(sanitized);
                }}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Método de pago
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as "CASH" | "NEQUI")
                }
                className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
              >
                <option value="CASH">Efectivo</option>
                <option value="NEQUI">Nequi</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={paymentSaving}
                className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {paymentSaving ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminPage>
  );
}
