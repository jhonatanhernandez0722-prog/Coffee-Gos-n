"use client";

import { FormEvent, useEffect, useState } from "react";
import { Banknote, Check, HandCoins, Smartphone, X } from "lucide-react";
import { apiUrl, userFacingError } from "@/lib/api";

type Method = "CASH" | "NEQUI";
type CreditPayment = { amount: number; payment_method: string | null; created_at: string };
type Credit = { id: number; sale_number: string; original_amount: number; pending_amount: number; created_at: string; products: { name: string; quantity: number }[]; payments: CreditPayment[] };
type AppliedPayment = { credit_id: number; sale_number: string; amount: number; paid_off: boolean };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const units = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(Number(value));

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("coffee_gosen_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Deudas pendientes de un cliente, con pago total o abono repartido de la deuda más antigua a la más reciente. */
export function CustomerDebts({ customer, onClose, onPaid }: { customer: { id: number; name: string }; onClose: () => void; onPaid: () => void }) {
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedPayment[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCredits() {
    const response = await fetch(`${apiUrl}/credits/customer/${customer.id}`, { headers: authHeaders() });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar las deudas.");
    // Del más antiguo al más reciente: es el orden en que se aplican los abonos.
    setCredits((result.credits as Credit[]).sort((first, second) => first.created_at.localeCompare(second.created_at)));
  }
  useEffect(() => { Promise.resolve().then(loadCredits).catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar las deudas."))); }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const totalDebt = (credits ?? []).reduce((sum, credit) => sum + Number(credit.pending_amount), 0);

  async function pay(value: number) {
    setError(""); setApplied(null);
    if (!(value > 0)) return setError("Escribe un valor mayor que cero.");
    if (value > totalDebt) return setError(`El valor supera lo que debe el cliente (${money(totalDebt)}).`);
    const label = value === totalDebt ? `pagar toda la deuda de ${customer.name}` : `abonar ${money(value)} a la deuda de ${customer.name}`;
    if (!window.confirm(`¿Confirmas ${label} en ${method === "CASH" ? "efectivo" : "Nequi"}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/credits/customer/${customer.id}/payments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ amount: value, payment_method: method }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible registrar el pago.");
      setApplied(result.applied as AppliedPayment[]);
      setAmount("");
      await loadCredits();
      onPaid();
    } catch (requestError) { setError(userFacingError(requestError, "No fue posible registrar el pago.")); } finally { setSaving(false); }
  }
  function submitAbono(event: FormEvent) { event.preventDefault(); void pay(Number(amount)); }

  return <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--ink)]/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="customer-debts-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col border border-[var(--line)] bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
        <div><p className="text-sm text-[var(--muted)]">Deudas del cliente</p><h2 id="customer-debts-title" className="mt-1 text-lg font-bold">{customer.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="Cerrar deudas del cliente" className="grid size-10 place-items-center"><X size={19} /></button>
      </div>

      <div className="overflow-y-auto p-5 sm:p-6">
        {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {applied && <div role="status" className="mb-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="flex items-center gap-2 font-semibold"><Check size={16} />Pago registrado</p>
          <ul className="mt-1 space-y-0.5">{applied.map((item) => <li key={item.credit_id}>{item.sale_number}: {money(Number(item.amount))} {item.paid_off ? "· saldado" : "· abono"}</li>)}</ul>
        </div>}

        {credits === null ? <p className="p-6 text-center text-sm text-[var(--muted)]">Cargando deudas...</p> : credits.length === 0 ? <p className="p-6 text-center text-sm font-semibold text-emerald-700">El cliente está al día.</p> : <>
          <div className="screen p-5"><p className="screen-label text-sm">Total que debe</p><strong className="screen-amount mt-2 block text-4xl">{money(totalDebt)}</strong><p className="screen-label mt-2 text-xs">{credits.length} {credits.length === 1 ? "crédito pendiente" : "créditos pendientes"}</p></div>

          <ul className="mt-4 divide-y divide-[var(--line)] border border-[var(--line)]">{credits.map((credit) => {
            const paid = Number(credit.original_amount) - Number(credit.pending_amount);
            return <li key={credit.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><strong className="block text-sm">{credit.sale_number}</strong><p className="text-xs text-[var(--muted)]">{new Date(credit.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</p></div>
                <div className="text-right"><strong className="tabular-nums text-amber-800">{money(Number(credit.pending_amount))}</strong>{paid > 0 && <p className="text-xs text-[var(--muted)]">de {money(Number(credit.original_amount))} · abonado {money(paid)}</p>}</div>
              </div>
              {credit.products.length > 0 && <p className="mt-1 text-sm text-[var(--muted)]">{credit.products.map((product) => `${units(product.quantity)} × ${product.name}`).join(", ")}</p>}
            </li>;
          })}</ul>

          <fieldset className="mt-5"><legend className="text-sm font-semibold">Método de pago</legend><div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={method === "CASH"} onClick={() => setMethod("CASH")} className="choice"><Banknote size={16} />Efectivo</button>
            <button type="button" aria-pressed={method === "NEQUI"} onClick={() => setMethod("NEQUI")} className="choice"><Smartphone size={16} />Nequi</button>
          </div></fieldset>

          <button type="button" disabled={saving} onClick={() => void pay(totalDebt)} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 bg-[var(--blue-main)] px-5 text-base font-bold text-white transition hover:bg-[var(--blue-secondary)] disabled:opacity-60"><Check size={19} />{saving ? "Guardando..." : `Pagar todo (${money(totalDebt)})`}</button>

          <form onSubmit={submitAbono} className="mt-4 border-t border-[var(--line)] pt-4">
            <label className="block text-sm font-semibold">Abonar<span className="block text-xs font-normal text-[var(--muted)]">Se aplica primero a la deuda más antigua.</span>
              <div className="mt-2 flex gap-2"><input inputMode="numeric" type="number" min="1" max={totalDebt} step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor del abono" className="min-h-12 w-full border border-[var(--line)] px-3 font-normal" /><button type="submit" disabled={saving || !amount} className="inline-flex min-h-12 shrink-0 items-center gap-2 border border-[var(--blue-main)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)] disabled:opacity-50"><HandCoins size={16} />Abonar</button></div>
            </label>
          </form>
        </>}
      </div>
    </section>
  </div>;
}
