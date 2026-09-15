"use client";

import { FormEvent, useEffect, useState } from "react";
import { Banknote, Download, Plus, ReceiptText } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { downloadExcel } from "@/lib/excel";

type Category = { id: number; name: string; is_active: boolean };
type Expense = { id: number; amount: number; payment_method: "CASH" | "NEQUI"; category_name: string; observation: string; created_at: string };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1");
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "NEQUI">("CASH");
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const [categoriesResponse, expensesResponse] = await Promise.all([fetch(`${apiUrl}/expenses/categories`, { headers }), fetch(`${apiUrl}/expenses`, { headers })]);
    const categoryResult = await categoriesResponse.json();
    const expenseResult = await expensesResponse.json();
    if (!categoriesResponse.ok) throw new Error(categoryResult.detail ?? "No fue posible cargar las categor&iacute;as.");
    if (!expensesResponse.ok) throw new Error(expenseResult.detail ?? "No fue posible cargar los egresos.");
    setCategories(categoryResult as Category[]); setExpenses(expenseResult.expenses as Expense[]);
  }
  useEffect(() => { Promise.resolve().then(loadData).catch((requestError: Error) => setError(requestError.message)); }, []);
  function exportExpenses() { downloadExcel(expenses.map((expense) => ({ Fecha: expense.created_at, Categoría: expense.category_name, Método: expense.payment_method === "NEQUI" ? "Nequi" : "Efectivo", Observación: expense.observation, Valor: expense.amount })), "egresos.xlsx", "Egresos"); }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      let selectedCategoryId = Number(categoryId);
      if (categoryId === "new") {
        if (newCategory.trim().length < 2) throw new Error("Escribe el nombre de la nueva categor&iacute;a.");
        const categoryResponse = await fetch(`${apiUrl}/expenses/categories`, { method: "POST", headers, body: JSON.stringify({ name: newCategory.trim() }) });
        const categoryResult = await categoryResponse.json();
        if (!categoryResponse.ok) throw new Error(categoryResult.detail ?? "No fue posible crear la categor&iacute;a.");
        selectedCategoryId = categoryResult.id; setCategories((current) => [...current, categoryResult as Category].sort((first, second) => first.name.localeCompare(second.name)));
      }
      if (!selectedCategoryId) throw new Error("Selecciona una categor&iacute;a.");
      const response = await fetch(`${apiUrl}/expenses`, { method: "POST", headers, body: JSON.stringify({ amount: Number(amount), payment_method: method, category_id: selectedCategoryId, observation: observation.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No fue posible registrar el egreso.");
      setExpenses((current) => [result as Expense, ...current]); setAmount(""); setObservation(""); setCategoryId(""); setNewCategory("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible registrar el egreso."); } finally { setSaving(false); }
  }

  return <AdminPage title="Egresos" description="Registra pagos y gastos de la operaci&oacute;n con categor&iacute;a, m&eacute;todo y observaci&oacute;n.">
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <button type="button" onClick={exportExpenses} className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"><Download size={16} /> Descargar Excel</button>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={saveExpense} className="border border-[var(--ink)] bg-white p-5"><div className="flex items-center gap-3 border-b border-[var(--line)] pb-4"><Banknote className="text-[var(--blue-main)]" size={22} /><div><h2 className="font-semibold">Nuevo egreso</h2><p className="text-sm text-[var(--muted)]">Se reflejar&aacute; en Movimientos.</p></div></div><label className="mt-5 block text-sm font-semibold">Valor<input required min="1" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold">M&eacute;todo<select value={method} onChange={(event) => setMethod(event.target.value as "CASH" | "NEQUI")} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"><option value="CASH">Efectivo</option><option value="NEQUI">Nequi</option></select></label><label className="mt-4 block text-sm font-semibold">Categor&iacute;a<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"><option value="">Selecciona una categor&iacute;a</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="new">+ Crear categor&iacute;a</option></select></label>{categoryId === "new" && <label className="mt-4 block text-sm font-semibold">Nueva categor&iacute;a<input required value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>}<label className="mt-4 block text-sm font-semibold">Observaci&oacute;n<textarea required minLength={2} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Ej. Pago de recibo de energ&iacute;a" rows={4} className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal" /></label><button disabled={saving} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"><Plus size={17} />{saving ? "Guardando..." : "Guardar egreso"}</button></form>
      <section className="border border-[var(--line)] bg-white"><div className="border-b border-[var(--line)] p-5"><div className="flex items-center gap-3"><ReceiptText className="text-[var(--blue-main)]" size={22} /><div><h2 className="font-semibold">Egresos registrados</h2><p className="mt-1 text-sm text-[var(--muted)]">{expenses.length} registros</p></div></div></div>{expenses.length === 0 ? <p className="p-10 text-center text-sm text-[var(--muted)]">A&uacute;n no hay egresos registrados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Fecha</th><th className="p-4 font-medium">Categor&iacute;a</th><th className="p-4 font-medium">M&eacute;todo</th><th className="p-4 font-medium">Observaci&oacute;n</th><th className="p-4 font-medium">Valor</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id} className="border-b border-[var(--line)] last:border-0"><td className="p-4 text-[var(--muted)]">{new Date(expense.created_at).toLocaleString("es-CO")}</td><td className="p-4 font-semibold">{expense.category_name}</td><td className="p-4">{expense.payment_method === "NEQUI" ? "Nequi" : "Efectivo"}</td><td className="p-4">{expense.observation}</td><td className="p-4 font-semibold text-red-700">{money(Number(expense.amount))}</td></tr>)}</tbody></table></div>}</section>
    </div>
  </AdminPage>;
}
