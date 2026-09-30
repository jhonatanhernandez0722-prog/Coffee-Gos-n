"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CreditCard, Download, HandCoins, Search, Trash2, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";

type CreditProduct = { name: string; quantity: number };
type CreditPayment = { amount: number; payment_method: "CASH" | "NEQUI" | null; created_at: string };
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
  payments: CreditPayment[];
  support_urls: string[];
};
const paymentLabels: Record<string, string> = { CASH: "Efectivo", NEQUI: "Transferencia (Nequi)" };
const statusLabels: Record<string, string> = { PENDING: "Pendiente", PAID: "Pagado" };

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
  const [customerFilter, setCustomerFilter] = useState("");
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

  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visibleCredits = credits.filter((credit) => normalize(credit.customer_name).includes(normalize(customerFilter.trim())));

  function exportCredits() {
    downloadExcel(
      visibleCredits.map((credit) => ({
        Venta: credit.sale_number,
        Fecha: credit.created_at,
        Cliente: credit.customer_name,
        Productos: credit.products
          .map((product) => `${product.quantity} x ${product.name}`)
          .join(", "),
        Vendedor: credit.seller_name ?? "Sin asignar",
        Registró: credit.cashier_name ?? "",
        Original: Number(credit.original_amount),
        Pendiente: Number(credit.pending_amount),
        Pagado: credit.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        "Medio de pago": [...new Set(credit.payments.map((payment) => paymentLabels[payment.payment_method ?? ""] ?? "Sin dato"))].join(", ") || "Sin pagos",
        Pagos: credit.payments
          .map((payment) => `${new Date(payment.created_at).toLocaleDateString("es-CO")} ${paymentLabels[payment.payment_method ?? ""] ?? "Sin dato"} ${money(Number(payment.amount))}`)
          .join(" | "),
        Estado: statusLabels[credit.status] ?? credit.status,
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
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="screen p-6">
          <p className="screen-label text-sm">Cartera pendiente</p>
          <strong className="screen-amount mt-4 block text-3xl">{money(credits.filter((credit) => credit.status === "PENDING").reduce((sum, credit) => sum + Number(credit.pending_amount), 0))}</strong>
        </article>
        <article className="border border-[var(--line)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Créditos pendientes</p>
          <strong className="screen-amount mt-4 block text-3xl text-amber-700">{credits.filter((credit) => credit.status === "PENDING").length}</strong>
        </article>
        <article className="border border-[var(--line)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Créditos pagados</p>
          <strong className="screen-amount mt-4 block text-3xl text-emerald-700">{credits.filter((credit) => credit.status === "PAID").length}</strong>
        </article>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Filtrar por cliente</span>
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            placeholder="Filtrar por nombre del cliente"
            className="min-h-11 w-full border border-[var(--line)] pl-10 pr-10 text-sm"
          />
          {customerFilter && (
            <button type="button" aria-label="Limpiar filtro" onClick={() => setCustomerFilter("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-[var(--muted)] hover:text-[var(--ink)]">
              <X size={15} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={exportCredits}
          className="inline-flex min-h-11 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
        >
          <Download size={16} /> Descargar Excel
        </button>
      </div>
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
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--blue-light)] text-[var(--blue-main)]"><CreditCard size={20} /></span>
            <div>
              <h2 className="text-lg font-bold">Créditos registrados</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {customerFilter ? `${visibleCredits.length} de ${credits.length} créditos para “${customerFilter.trim()}”` : `${credits.length} créditos encontrados`}
              </p>
            </div>
          </div>
        </div>
        {credits.length === 0 && !error ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            Todavía no hay ventas registradas a crédito.
          </div>
        ) : visibleCredits.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            Ningún crédito coincide con “{customerFilter.trim()}”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-4 font-medium">Venta / fecha</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Productos comprados</th>
                  <th className="p-4 font-medium">Vendedor</th>
                  <th className="p-4 font-medium">Registró</th>
                  <th className="p-4 font-medium">Saldo</th>
                  <th className="p-4 font-medium">Pagos / medio de pago</th>
                  <th className="p-4 font-medium">Soportes</th>
                  <th className="p-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleCredits.map((credit) => (
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
                    <td className="p-4">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="brand-mark size-8 shrink-0 text-xs font-bold">{credit.customer_name.charAt(0).toUpperCase()}</span>
                        {credit.customer_name}
                      </span>
                      <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${credit.status === "PENDING" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                        {statusLabels[credit.status] ?? credit.status}
                      </span>
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
                      {credit.payments.length ? (
                        <ul className="space-y-1.5">
                          {credit.payments.map((payment, index) => (
                            <li key={`${credit.id}-${index}`} className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${payment.payment_method === "NEQUI" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                                {paymentLabels[payment.payment_method ?? ""] ?? "Sin dato"}
                              </span>
                              <strong>{money(Number(payment.amount))}</strong>
                              <span className="text-xs text-[var(--muted)]">
                                {new Date(payment.created_at).toLocaleDateString("es-CO")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">Sin pagos</span>
                      )}
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
