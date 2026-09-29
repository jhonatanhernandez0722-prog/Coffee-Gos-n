"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Check,
  Eye,
  Power,
  UserCheck,
  Users,
  Download,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  UserCog,
  X,
} from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";

type Seller = {
  id: number;
  full_name: string;
  email: string;
  role: "SELLER" | "VIEWER";
  is_active: boolean;
  permissions: string[];
};
type PermissionKey =
  | "dashboard"
  | "comanda"
  | "productos"
  | "clientes"
  | "creditos"
  | "movimientos"
  | "egresos"
  | "ingresos"
  | "donaciones"
  | "metricas"
  | "arqueo"
  | "balance"
  | "temas";
const roleLabels: Record<Seller["role"], string> = { SELLER: "Vendedor", VIEWER: "Solo lectura" };
const sections: { key: PermissionKey; label: string }[] = [
  { key: "dashboard", label: "Resumen" },
  { key: "comanda", label: "Ventas" },
  { key: "productos", label: "Productos" },
  { key: "clientes", label: "Clientes" },
  { key: "creditos", label: "Créditos" },
  { key: "movimientos", label: "Movimientos" },
  { key: "egresos", label: "Egresos y costo" },
  { key: "ingresos", label: "Ingresar" },
  { key: "donaciones", label: "Donaciones" },
  { key: "metricas", label: "Métricas" },
  { key: "arqueo", label: "Arqueo de Caja" },
  { key: "balance", label: "Balance General" },
  { key: "temas", label: "Temas" },
];

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"SELLER" | "VIEWER">("SELLER");
  const [permissions, setPermissions] = useState<PermissionKey[]>(["comanda"]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = sessionStorage.getItem("coffee_gosen_user");
    return storedUser ? (JSON.parse(storedUser) as { role?: string }).role === "ADMIN" : false;
  });

  async function loadSellers() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.detail ?? "No fue posible cargar los usuarios.");
    setSellers(result as Seller[]);
  }

  useEffect(() => {
    Promise.resolve()
      .then(loadSellers)
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los usuarios.")));
  }, []);

  function resetForm() {
    setEditing(null);
    setName("");
    setEmail("");
    setPin("");
    setRole("SELLER");
    setPermissions(["comanda"]);
  }
  function editSeller(seller: Seller) {
    setEditing(seller);
    setName(seller.full_name);
    setEmail(seller.email);
    setPin("");
    setRole(seller.role);
    setPermissions(seller.permissions as PermissionKey[]);
  }
  function togglePermission(section: PermissionKey) {
    setPermissions((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  }
  function exportSellers() {
    downloadExcel(
      sellers.map((seller) => ({
        Nombre: seller.full_name,
        Correo: seller.email,
        Estado: seller.is_active ? "Activo" : "Inactivo",
        Permisos: seller.permissions.join(", "),
      })),
      "vendedores.xlsx",
      "Vendedores",
    );
  }

  async function saveSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!editing && !pin) {
      setError("El PIN es obligatorio para crear el usuario.");
      return;
    }
    if (permissions.length === 0) {
      setError("Selecciona al menos un apartado.");
      return;
    }
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(
        editing ? `${apiUrl}/users/${editing.id}` : `${apiUrl}/users`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            full_name: name,
            email,
            ...(pin ? { pin } : {}),
            role,
            permissions,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(result.detail)
            ? result.detail.map((item: { msg?: string }) => item.msg).join(". ")
            : (result.detail ?? "No fue posible guardar el usuario."),
        );
      await loadSellers();
      resetForm();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? userFacingError(requestError, "No fue posible guardar el usuario.")
          : "No fue posible guardar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(seller: Seller) {
    setError("");
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/users/${seller.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ is_active: !seller.is_active }),
    });
    if (!response.ok) {
      const result = await response.json();
      setError(result.detail ?? "No fue posible actualizar el usuario.");
      return;
    }
    await loadSellers();
  }

  const activeCount = sellers.filter((seller) => seller.is_active).length;
  const stats = [
    { label: "Usuarios", value: sellers.length, icon: Users },
    { label: "Activos", value: activeCount, icon: UserCheck },
    { label: "Vendedores", value: sellers.filter((seller) => seller.role === "SELLER").length, icon: UserCog },
    { label: "Solo lectura", value: sellers.filter((seller) => seller.role === "VIEWER").length, icon: Eye },
  ];

  return (
    <AdminPage
      title="Usuarios"
      description="Crea accesos con PIN y decide qué apartados puede consultar cada persona del equipo."
    >
      {error && (
        <p
          role="alert"
          className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <div
            key={label}
            className={index === 0 ? "screen p-5" : "border border-[var(--line)] bg-white p-5"}
          >
            <div className={`flex items-center justify-between text-sm ${index === 0 ? "screen-label" : "text-[var(--muted)]"}`}>
              {label}
              <Icon size={17} className={index === 0 ? "" : "text-[var(--blue-main)]"} />
            </div>
            <p className="screen-amount mt-4 text-4xl">{value}</p>
          </div>
        ))}
      </div>
      <div className={`grid items-start gap-6 ${isAdmin ? "lg:grid-cols-[1fr_380px]" : ""}`}>
        <section className="border border-[var(--line)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Usuarios registrados</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                El PIN funciona como contraseña de acceso.
              </p>
            </div>
            <button
              type="button"
              onClick={exportSellers}
              className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)] hover:border-[var(--blue-main)]"
            >
              <Download size={16} /> Descargar Excel
            </button>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {sellers.map((seller) => (
              <article
                key={seller.id}
                className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-start sm:justify-between sm:px-6 ${editing?.id === seller.id ? "bg-[var(--blue-light)]" : "hover:bg-[var(--canvas)]"} ${seller.is_active ? "" : "opacity-70"}`}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className={`relative grid size-12 shrink-0 place-items-center rounded-2xl font-heading text-lg font-bold ${seller.is_active ? "brand-mark" : "bg-[var(--canvas)] text-[var(--muted)]"}`}>
                    {seller.full_name.charAt(0).toUpperCase()}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${seller.is_active ? "bg-emerald-500" : "bg-slate-400"}`}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-base">{seller.full_name}</strong>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${seller.role === "VIEWER" ? "bg-sky-100 text-sky-800" : "bg-[var(--blue-light)] text-[var(--blue-secondary)]"}`}>
                        {seller.role === "VIEWER" ? <Eye size={12} /> : <UserCog size={12} />}
                        {roleLabels[seller.role]}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--muted)]">
                      <Mail size={14} className="shrink-0" />
                      {seller.email}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {seller.permissions
                        .map(
                          (permission) =>
                            sections.find(
                              (section) => section.key === permission,
                            )?.label,
                        )
                        .filter(Boolean)
                        .map((label) => (
                          <span
                            key={label}
                            className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-xs text-[var(--muted)]"
                          >
                            {label}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${seller.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    <span className={`size-1.5 rounded-full ${seller.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {seller.is_active ? "Activo" : "Inactivo"}
                  </span>
                  {isAdmin && <>
                    <button
                      title="Editar usuario"
                      onClick={() => editSeller(seller)}
                      className="grid size-9 place-items-center border border-[var(--line)] bg-white text-[var(--blue-main)] hover:border-[var(--blue-main)]"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => toggleActive(seller)}
                      className={`inline-flex min-h-9 items-center gap-1.5 border bg-white px-3 text-xs font-semibold ${seller.is_active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                    >
                      <Power size={13} />
                      {seller.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </>}
                </div>
              </article>
            ))}
            {sellers.length === 0 && (
              <div className="grid place-items-center gap-3 p-12 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-[var(--blue-light)] text-[var(--blue-main)]">
                  <Users size={26} />
                </span>
                <p className="font-semibold">Aún no hay usuarios registrados.</p>
                {isAdmin && (
                  <p className="max-w-xs text-sm text-[var(--muted)]">
                    Crea el primero con el formulario de acceso.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
        {isAdmin && <form
          onSubmit={saveSeller}
          className="border border-[var(--line)] bg-white p-5 sm:p-6 lg:sticky lg:top-32"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="brand-mark size-11">
                {editing ? <Pencil size={18} /> : <Plus size={20} />}
              </span>
              <div>
                <p className="text-sm text-[var(--muted)]">
                  {editing ? "Editar acceso" : "Nuevo acceso"}
                </p>
                <h2 className="text-lg font-bold leading-tight">
                  {editing ? editing.full_name : "Agregar usuario"}
                </h2>
              </div>
            </div>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                aria-label="Cancelar edición"
                className="grid size-9 place-items-center text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
              >
                <X size={19} />
              </button>
            )}
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Rol</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={role === "SELLER"} onClick={() => setRole("SELLER")} className="choice">
                <UserCog size={16} /> Vendedor
              </button>
              <button type="button" aria-pressed={role === "VIEWER"} onClick={() => setRole("VIEWER")} className="choice">
                <Eye size={16} /> Solo lectura
              </button>
            </div>
          </fieldset>
          <label className="mt-5 block text-sm font-semibold">
            Nombre
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Correo
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            <span className="flex items-center gap-2">
              <KeyRound size={15} />
              PIN{" "}
              {editing && (
                <span className="font-normal text-[var(--muted)]">
                  (deja vacío para conservarlo)
                </span>
              )}
            </span>
            <input
              required={!editing}
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
              placeholder="4 a 8 dígitos"
              className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal tracking-[0.3em] placeholder:tracking-normal"
            />
          </label>
          <fieldset className="mt-5">
            <legend className="flex w-full items-center justify-between text-sm font-semibold">
              Apartados permitidos
              <span className="font-normal text-[var(--muted)]">
                {permissions.length} de {sections.length}
              </span>
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {sections.map((section) => (
                <label
                  key={section.key}
                  className="choice cursor-pointer !justify-start !px-3 text-left !text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(section.key)}
                    onChange={() => togglePermission(section.key)}
                    className="sr-only"
                  />
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border ${permissions.includes(section.key) ? "border-[var(--blue-main)] bg-[var(--blue-main)] text-white" : "border-[var(--line)] bg-white"}`}
                    aria-hidden="true"
                  >
                    {permissions.includes(section.key) && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{section.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            disabled={saving}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-bold text-white hover:bg-[var(--blue-secondary)] disabled:opacity-60"
          >
            <Check size={17} />
            {saving
              ? "Guardando..."
              : editing
                ? "Guardar cambios"
                : `Crear ${roleLabels[role].toLowerCase()}`}
          </button>
        </form>}
      </div>
    </AdminPage>
  );
}
