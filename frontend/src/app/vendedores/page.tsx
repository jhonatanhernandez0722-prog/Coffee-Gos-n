"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, KeyRound, Mail, Pencil, Plus, UserCog, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

type Seller = { id: number; full_name: string; email: string; is_active: boolean; permissions: string[] };
type PermissionKey = "dashboard" | "comanda" | "productos" | "clientes" | "creditos" | "movimientos";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1");
const sections: { key: PermissionKey; label: string }[] = [
  { key: "dashboard", label: "Resumen" }, { key: "comanda", label: "Comanda" }, { key: "productos", label: "Productos" },
  { key: "clientes", label: "Clientes" }, { key: "creditos", label: "Créditos" }, { key: "movimientos", label: "Movimientos" },
];

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>(["comanda"]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSellers() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/users`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar los vendedores.");
    setSellers(result as Seller[]);
  }

  useEffect(() => { Promise.resolve().then(loadSellers).catch((requestError: Error) => setError(requestError.message)); }, []);

  function resetForm() { setEditing(null); setName(""); setEmail(""); setPin(""); setPermissions(["comanda"]); }
  function editSeller(seller: Seller) { setEditing(seller); setName(seller.full_name); setEmail(seller.email); setPin(""); setPermissions(seller.permissions as PermissionKey[]); }
  function togglePermission(section: PermissionKey) { setPermissions((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]); }

  async function saveSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!editing && !pin) { setError("El PIN es obligatorio para crear el vendedor."); return; }
    if (permissions.length === 0) { setError("Selecciona al menos un apartado."); return; }
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(editing ? `${apiUrl}/users/${editing.id}` : `${apiUrl}/users`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ full_name: name, email, ...(pin ? { pin } : {}), permissions }) });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.detail) ? result.detail.map((item: { msg?: string }) => item.msg).join(". ") : result.detail ?? "No fue posible guardar el vendedor.");
      await loadSellers(); resetForm();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible guardar el vendedor."); } finally { setSaving(false); }
  }

  async function toggleActive(seller: Seller) {
    setError("");
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/users/${seller.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ is_active: !seller.is_active }) });
    if (!response.ok) { const result = await response.json(); setError(result.detail ?? "No fue posible actualizar el vendedor."); return; }
    await loadSellers();
  }

  return <AdminPage title="Vendedores" description="Crea accesos con PIN y decide qué apartados puede consultar cada persona del equipo.">
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="border border-[var(--line)] bg-white"><div className="border-b border-[var(--line)] p-5"><h2 className="font-semibold">Vendedores registrados</h2><p className="mt-1 text-sm text-[var(--muted)]">El PIN funciona como contraseña de acceso.</p></div><div className="divide-y divide-[var(--line)]">{sellers.map((seller) => <article key={seller.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center bg-[var(--blue-light)] text-[var(--blue-main)]"><UserCog size={18} /></span><div><strong>{seller.full_name}</strong><p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]"><Mail size={14} />{seller.email}</p><p className="mt-2 text-xs text-[var(--muted)]">{seller.permissions.map((permission) => sections.find((section) => section.key === permission)?.label).filter(Boolean).join(" · ")}</p></div></div><div className="flex items-center gap-2"><span className={`text-xs font-semibold ${seller.is_active ? "text-emerald-700" : "text-[var(--muted)]"}`}>{seller.is_active ? "Activo" : "Inactivo"}</span><button title="Editar vendedor" onClick={() => editSeller(seller)} className="grid size-9 place-items-center border border-[var(--line)] text-[var(--blue-main)]"><Pencil size={15} /></button><button onClick={() => toggleActive(seller)} className="min-h-9 border border-[var(--line)] px-3 text-xs font-semibold">{seller.is_active ? "Desactivar" : "Activar"}</button></div></article>)}{sellers.length === 0 && <p className="p-8 text-sm text-[var(--muted)]">Aún no hay vendedores registrados.</p>}</div></section>
      <form onSubmit={saveSeller} className="border border-[var(--ink)] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-[var(--muted)]">{editing ? "Editar acceso" : "Nuevo acceso"}</p><h2 className="mt-1 font-semibold">{editing ? editing.full_name : "Agregar vendedor"}</h2></div>{editing ? <button type="button" onClick={resetForm} aria-label="Cancelar edición"><X size={19} /></button> : <Plus size={19} className="text-[var(--blue-main)]" />}</div><label className="mt-5 block text-sm font-semibold">Nombre<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold">Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold"><span className="flex items-center gap-2"><KeyRound size={15} />PIN {editing && <span className="font-normal text-[var(--muted)]">(deja vacío para conservarlo)</span>}</span><input required={!editing} inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4 a 8 dígitos" className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><fieldset className="mt-5"><legend className="text-sm font-semibold">Apartados permitidos</legend><div className="mt-2 grid gap-2">{sections.map((section) => <label key={section.key} className="flex min-h-10 items-center gap-3 border border-[var(--line)] px-3 text-sm"><input type="checkbox" checked={permissions.includes(section.key)} onChange={() => togglePermission(section.key)} /><span>{section.label}</span>{permissions.includes(section.key) && <Check size={15} className="ml-auto text-emerald-700" />}</label>)}</div></fieldset><button disabled={saving} className="mt-6 min-h-11 w-full bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear vendedor"}</button></form>
    </div>
  </AdminPage>;
}