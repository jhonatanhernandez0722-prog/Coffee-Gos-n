"use client";

import { FormEvent, useEffect, useState } from "react";
import { Banknote, Download, KeyRound, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";

type Category = { id: number; name: string; is_active: boolean };
type Expense = {
  id: number;
  amount: number;
  payment_method: "CASH" | "NEQUI";
  category_name: string;
  product: string | null;
  observation: string;
  created_at: string;
  settled_at: string | null;
};
const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "NEQUI">("CASH");
  const [product, setProduct] = useState("");
  const [observation, setObservation] = useState("");
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [authorizing, setAuthorizing] = useState<Expense | null>(null);
  const [password, setPassword] = useState("");
  const [authorizationPin, setAuthorizationPin] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const [categoriesResponse, expensesResponse] = await Promise.all([
      fetch(`${apiUrl}/expenses/categories`, { headers }),
      fetch(`${apiUrl}/expenses`, { headers }),
    ]);
    const categoryResult = await categoriesResponse.json();
    const expenseResult = await expensesResponse.json();
    if (!categoriesResponse.ok)
      throw new Error(
        categoryResult.detail ?? "No fue posible cargar las categorías.",
      );
    if (!expensesResponse.ok)
      throw new Error(
        expenseResult.detail ?? "No fue posible cargar los egresos.",
      );
    setCategories(categoryResult as Category[]);
    setExpenses(expenseResult.expenses as Expense[]);
  }
  useEffect(() => {
    Promise.resolve()
      .then(loadData)
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los egresos.")));
  }, []);
  function exportExpenses() {
    downloadExcel(
      expenses.map((expense) => ({
        Fecha: expense.created_at,
        Categoría: expense.category_name,
        Producto: expense.product ?? "",
        Método: expense.payment_method === "NEQUI" ? "Nequi" : "Efectivo",
        Observación: expense.observation,
        Valor: expense.amount,
      })),
      "egresos.xlsx",
      "Egresos",
    );
  }

  async function saveExpense(
    event: FormEvent<HTMLFormElement>,
    settleImmediately = false,
  ) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const selectedCategoryId = Number(categoryId);
      if (!selectedCategoryId) throw new Error("Selecciona una categoría.");
      const response = await fetch(`${apiUrl}/expenses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: method,
          category_id: selectedCategoryId,
          product: product.trim() || null,
          observation: observation.trim(),
          settle_immediately: settleImmediately,
          authorization_pin: settleImmediately ? authorizationPin : null,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "No fue posible registrar el egreso.");
      setExpenses((current) => [result as Expense, ...current]);
      setAmount("");
      setProduct("");
      setObservation("");
      setCategoryId("");
      setNewCategory("");
      setAuthorizationPin("");
      setNotice(
        settleImmediately
          ? "Egreso anticipado registrado correctamente."
          : "Egreso registrado correctamente.",
      );
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible registrar el egreso."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const categoryName = newCategory.trim();
    if (categoryName.length < 2) {
      setError("La categoría debe tener al menos 2 caracteres.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/expenses/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: categoryName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail ?? "No fue posible crear la categoría.");
      }
      const category = result as Category;
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(String(category.id));
      setNewCategory("");
      setAddingCategory(false);
      setNotice(`Categoría "${category.name}" creada correctamente.`);
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible crear la categoría."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function settleExpense() {
    if (!authorizing) return;
    setError("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(
        `${apiUrl}/expenses/${authorizing.id}/settle?authorization_pin=${encodeURIComponent(authorizationPin)}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "No fue posible registrar el egreso.");
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === authorizing.id ? (result as Expense) : expense,
        ),
      );
      setAuthorizing(null);
      setAuthorizationPin("");
      setNotice("Egreso registrado correctamente en el saldo.");
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible registrar el egreso."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense() {
    if (!deleting || !password.trim()) {
      setError("Escribe tu contraseña o PIN para confirmar la eliminación.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(
        `${apiUrl}/expenses/${deleting.id}?password=${encodeURIComponent(password)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok)
        throw new Error(result?.detail ?? "No fue posible eliminar el egreso.");
      setExpenses((current) =>
        current.filter((expense) => expense.id !== deleting.id),
      );
      setDeleting(null);
      setPassword("");
      setNotice("Egreso eliminado correctamente.");
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible eliminar el egreso."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/expenses/${editing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: method,
          category_id: Number(categoryId),
          product: product.trim() || null,
          observation: observation.trim(),
          settle_immediately: false,
          authorization_pin: null,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "No fue posible actualizar el egreso.");
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === editing.id ? (result as Expense) : expense,
        ),
      );
      setEditing(null);
      setNotice("Egreso actualizado correctamente.");
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible actualizar el egreso."),
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(expense: Expense) {
    const category = categories.find(
      (candidate) => candidate.name === expense.category_name,
    );
    setAmount(String(expense.amount));
    setMethod(expense.payment_method);
    setProduct(expense.product ?? "");
    setObservation(expense.observation);
    setCategoryId(category ? String(category.id) : "");
    setEditing(expense);
    setError("");
  }

  async function settlePendingExpenses() {
    setError("");
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/expenses/settle-pending`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.detail ?? "No fue posible restar los egresos pendientes.",
        );
      setSettleModalOpen(false);
      setNotice(
        `${result.count} egreso(s) restado(s) correctamente por ${money(Number(result.amount))}.`,
      );
      await loadData();
    } catch (requestError) {
      setError(
        userFacingError(requestError, "No fue posible restar los egresos pendientes."),
      );
    } finally {
      setSaving(false);
    }
  }

  const pendingExpenses = expenses.filter((expense) => !expense.settled_at);
  const isLastDayOfMonth =
    new Date().getDate() ===
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  return (
    <AdminPage
      title="Egresos y costo"
      description="Registra pagos y gastos de la operación con categoría, producto opcional, método y observación."
    >
      {error && (
        <p
          role="alert"
          className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {authorizing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md border border-[var(--ink)] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">
                  Registrar egreso antes de fin de mes
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Este egreso se aplicará inmediatamente al saldo. Requiere autorización.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => {
                  setAuthorizing(null);
                  setAuthorizationPin("");
                }}
              >
                <X size={19} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              PIN de autorización
              <input
                autoFocus
                required
                minLength={4}
                type="password"
                value={authorizationPin}
                onChange={(event) => setAuthorizationPin(event.target.value)}
                className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthorizing(null);
                  setAuthorizationPin("");
                }}
                className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || authorizationPin.length < 4}
                onClick={() => void settleExpense()}
                className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Registrando..." : "Autorizar y registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/40 p-4">
          <form
            onSubmit={(event) => void updateExpense(event)}
            className="w-full max-w-md border border-[var(--ink)] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">Editar egreso</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Corrige el valor, la categoría u otro dato del registro.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setEditing(null)}
              >
                <X size={19} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Valor
              <input
                required
                min="1"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Categoría
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Método
              <select
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as "CASH" | "NEQUI")
                }
                className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
              >
                <option value="CASH">Efectivo</option>
                <option value="NEQUI">Nequi</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Producto
              <input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                maxLength={180}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Observación
              <textarea
                required
                minLength={2}
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                rows={3}
                className="mt-2 w-full border border-[var(--line)] px-3 py-3 font-normal"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {deleting && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/40 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void deleteExpense();
            }}
            className="w-full max-w-md border border-[var(--ink)] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">Confirmar eliminación</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Ingresa la contraseña o PIN de tu cuenta para borrar este egreso.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => {
                  setDeleting(null);
                  setPassword("");
                }}
              >
                <X size={19} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Contraseña o PIN
              <input
                autoFocus
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleting(null);
                  setPassword("");
                }}
                className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          </form>
        </div>
      )}
      {settleModalOpen && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md border border-[var(--ink)] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">Restar egresos pendientes</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Se aplicarán {pendingExpenses.length} egreso(s) por{" "}
                  {money(
                    pendingExpenses.reduce(
                      (total, expense) => total + Number(expense.amount),
                      0,
                    ),
                  )}{" "}
                  al saldo.
                </p>
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  Solo debe ejecutarse el último día del mes.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setSettleModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || !isLastDayOfMonth}
                onClick={() => void settlePendingExpenses()}
                className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Restando..." : "Confirmar resta"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportExpenses}
          className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
        >
          <Download size={16} /> Descargar Excel
        </button>
        <button
          type="button"
          onClick={() => setSettleModalOpen(true)}
          disabled={pendingExpenses.length === 0}
          className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Registrar egreso de cierre ({pendingExpenses.length})
        </button>
      </div>
      <div className="grid w-full min-w-0 grid-cols-2 items-start gap-3 xl:gap-6 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] [&>form]:min-w-0 [&>section]:min-w-0">
        <form
          onSubmit={(event) => void saveExpense(event)}
          className="border border-[var(--ink)] bg-white p-5"
        >
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
            <Banknote className="text-[var(--blue-main)]" size={22} />
            <div>
              <h2 className="font-semibold">Nuevo egreso</h2>
              <p className="text-sm text-[var(--muted)]">
                Se reflejará en Movimientos.
              </p>
            </div>
          </div>
          <label className="mt-5 block text-sm font-semibold">
            Valor
            <input
              required
              min="1"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Método
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as "CASH" | "NEQUI")
              }
              className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
            >
              <option value="CASH">Efectivo</option>
              <option value="NEQUI">Nequi</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Producto{" "}
            <span className="font-normal text-[var(--muted)]">(opcional)</span>
            <input
              value={product}
              onChange={(event) => setProduct(event.target.value)}
              maxLength={180}
              placeholder="Ej. insumos o servicio"
              className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
            />
          </label>
          <div className="mt-4 text-sm font-semibold">
            <label htmlFor="expense-category">Categoría</label>
            <div className="mt-2 flex gap-2">
              <select
                id="expense-category"
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="min-h-11 min-w-0 flex-1 border border-[var(--line)] bg-white px-3 font-normal"
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory((current) => !current);
                  setError("");
                }}
                aria-expanded={addingCategory}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 border border-[var(--blue-main)] px-3 text-[var(--blue-main)] transition hover:bg-[var(--blue-main)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-main)]"
              >
                <Plus size={16} /> Añadir
              </button>
            </div>
            {addingCategory && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createCategory();
                    }
                  }}
                  maxLength={100}
                  placeholder="Nombre de la categoría"
                  className="min-h-11 min-w-0 flex-1 border border-[var(--line)] px-3 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-main)]"
                />
                <button
                  type="button"
                  onClick={() => void createCategory()}
                  disabled={saving || newCategory.trim().length < 2}
                  className="min-h-11 border border-[var(--blue-main)] px-3 text-sm text-[var(--blue-main)] disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Observación
            <textarea
              required
              minLength={2}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ej. Pago de recibo de energía"
              rows={3}
              className="mt-2 w-full border border-[var(--line)] px-3 py-3 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 min-h-12 w-full bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Registrar egreso"}
          </button>
        </form>
        <section className="border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex items-center gap-3">
              <ReceiptText className="text-[var(--blue-main)]" size={22} />
              <div>
                <h2 className="font-semibold">Egresos registrados</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {expenses.length} registros
                </p>
              </div>
            </div>
          </div>
          {expenses.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--muted)]">
              Aún no hay egresos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th className="p-4 font-medium">Fecha</th>
                    <th className="p-4 font-medium">Categoría</th>
                    <th className="p-4 font-medium">Producto</th>
                    <th className="p-4 font-medium">Método</th>
                    <th className="p-4 font-medium">Observación</th>
                    <th className="p-4 font-medium">Valor</th>
                    <th className="p-4 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="p-4 text-[var(--muted)]">
                        {new Date(expense.created_at).toLocaleString("es-CO")}
                      </td>
                      <td className="p-4 font-semibold">
                        {expense.category_name}
                      </td>
                      <td className="p-4">{expense.product || "-"}</td>
                      <td className="p-4">
                        {expense.payment_method === "NEQUI"
                          ? "Nequi"
                          : "Efectivo"}
                      </td>
                      <td className="p-4">{expense.observation}</td>
                      <td className="p-4 font-semibold text-red-700">
                        {money(Number(expense.amount))}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {!expense.settled_at && (
                            <button
                              type="button"
                              title="Registrar egreso antes de fin de mes"
                              onClick={() => {
                                setAuthorizing(expense);
                                setAuthorizationPin("");
                                setError("");
                              }}
                              className="grid size-10 place-items-center border border-amber-600 text-amber-800"
                            >
                              <KeyRound size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Editar egreso"
                            onClick={() => startEditing(expense)}
                            className="grid size-10 place-items-center border border-[var(--line)] text-[var(--blue-main)]"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            title="Eliminar egreso"
                            onClick={() => setDeleting(expense)}
                            className="grid size-10 place-items-center border border-red-200 text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
