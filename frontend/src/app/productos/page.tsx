"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { KeyRound, Package, Pencil, Plus, Search, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

type Product = { id: number; name: string; sale_price: number; acquisition_cost: number; stock: number; low_stock_threshold: number; restock_quantity: number; is_active: boolean; is_saleable: boolean; image_url?: string | null };
type Category = { id: number; name: string; is_active: boolean };
type Section = "sale" | "aseo";
type AseoMetrics = { product_count: number; total_units: number; stock_value: number };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1");
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const apiError = (result: { detail?: string | { msg?: string }[] }, fallback: string) => Array.isArray(result.detail) ? result.detail.map((item) => item.msg).filter(Boolean).join(". ") || fallback : result.detail || fallback;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [section, setSection] = useState<Section>("sale");
  const [aseoUnlocked, setAseoUnlocked] = useState(false);
  const [aseoMetrics, setAseoMetrics] = useState<AseoMetrics | null>(null);
  const [pin, setPin] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [categorySelection, setCategorySelection] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("10");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [takeTarget, setTakeTarget] = useState<Product | null>(null);
  const [takeQuantity, setTakeQuantity] = useState("1");
  const [takeObservation, setTakeObservation] = useState("Consumo interno");

  async function loadCatalog() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const [productsResponse, categoriesResponse] = await Promise.all([fetch(`${apiUrl}/products`, { headers }), fetch(`${apiUrl}/categories`, { headers })]);
    const productsResult = await productsResponse.json();
    const categoriesResult = await categoriesResponse.json();
    if (!productsResponse.ok) throw new Error(apiError(productsResult, "No fue posible cargar los productos."));
    if (!categoriesResponse.ok) throw new Error(apiError(categoriesResult, "No fue posible cargar las categorías."));
    setProducts(productsResult as Product[]); setCategories(categoriesResult as Category[]);
  }

  useEffect(() => { Promise.resolve().then(loadCatalog).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false)); }, []);

  async function unlockAseo() {
    setError("");
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products/aseo/access`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ pin }) });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "PIN de Aseo incorrecto."));
      setAseoUnlocked(true); setSection("aseo"); setPin("");
      const metricsResponse = await fetch(`${apiUrl}/inventory/aseo-summary`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (metricsResponse.ok) setAseoMetrics(await metricsResponse.json() as AseoMetrics);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible validar el PIN."); }
  }

  function openCreate() { setEditing(null); setName(""); setCategorySelection(categories.length ? "" : "new"); setNewCategoryName(""); setSalePrice(""); setCost(""); setStock(""); setRestockQuantity("10"); setImage(null); setShowForm(true); }
  function openEdit(product: Product) { setEditing(product); setName(product.name); setSalePrice(String(product.sale_price)); setCost(String(product.acquisition_cost)); setStock(String(product.stock)); setRestockQuantity(String(product.restock_quantity)); setShowForm(true); }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (editing) {
        const response = await fetch(`${apiUrl}/products/${editing.id}`, { method: "PATCH", headers, body: JSON.stringify({ name: name.trim(), sale_price: Number(salePrice), acquisition_cost: Number(cost), stock: Number(stock), restock_quantity: Number(restockQuantity) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(apiError(result, "No fue posible editar el producto."));
        setProducts((current) => current.map((item) => item.id === editing.id ? result as Product : item)); setShowForm(false); setEditing(null); return;
      }
      let category = section === "aseo" ? categories.find((item) => item.name.toLowerCase() === "aseo") : categories.find((item) => item.id === Number(categorySelection));
      if ((categorySelection === "new" && section === "sale") || (!category && section === "aseo")) {
        const wantedCategory = section === "aseo" ? "Aseo" : newCategoryName.trim();
        if (!wantedCategory) throw new Error("Escribe el nombre de la nueva categoría.");
        const categoryResponse = await fetch(`${apiUrl}/categories`, { method: "POST", headers, body: JSON.stringify({ name: wantedCategory }) });
        const categoryResult = await categoryResponse.json();
        if (!categoryResponse.ok) throw new Error(apiError(categoryResult, "No fue posible crear la categoría."));
        category = categoryResult as Category;
        setCategories((current) => [...current, category as Category].sort((first, second) => first.name.localeCompare(second.name)));
      }
      if (!category) throw new Error("Selecciona una categoría.");
      const response = await fetch(`${apiUrl}/products`, { method: "POST", headers, body: JSON.stringify({ category_id: category.id, name: name.trim(), sale_price: section === "aseo" ? 0 : Number(salePrice), acquisition_cost: section === "aseo" ? 0 : Number(cost), stock: Number(stock), low_stock_threshold: 5, restock_quantity: Number(restockQuantity), is_saleable: section === "sale" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible crear el producto."));
      let savedProduct = result as Product;
      if (image) { const formData = new FormData(); formData.append("image", image); const imageResponse = await fetch(`${apiUrl}/products/${savedProduct.id}/image`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData }); const imageResult = await imageResponse.json(); if (!imageResponse.ok) throw new Error(apiError(imageResult, "El producto se creó, pero no fue posible guardar la imagen.")); savedProduct = imageResult as Product; }
      setProducts((current) => [...current, savedProduct]); setShowForm(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible guardar el producto."); } finally { setSaving(false); }
  }

  async function toggleProduct(product: Product) {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/products/${product.id}/${product.is_active ? "disable" : "enable"}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const result = await response.json();
    if (!response.ok) { setError(apiError(result, "No fue posible cambiar el estado del producto.")); return; }
    setProducts((current) => current.map((item) => item.id === product.id ? result as Product : item));
  }

  async function restockProduct(product: Product) {
    setError(""); setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products/${product.id}/restock`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible restablecer el stock."));
      setProducts((current) => current.map((item) => item.id === product.id ? result as Product : item));
      if (section === "aseo") {
        const metricsResponse = await fetch(`${apiUrl}/inventory/aseo-summary`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (metricsResponse.ok) setAseoMetrics(await metricsResponse.json() as AseoMetrics);
      }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible restablecer el stock."); } finally { setSaving(false); }
  }

  function openTakeDialog(product: Product) {
    setTakeTarget(product); setTakeQuantity("1"); setTakeObservation("Consumo interno"); setError("");
  }

  async function takeProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!takeTarget) return;
    const quantity = Number(takeQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > Number(takeTarget.stock)) { setError("La cantidad debe ser un número entero y no superar el stock disponible."); return; }
    setSaving(true);
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    try {
      const response = await fetch(`${apiUrl}/inventory/internal-use`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ product_id: takeTarget.id, quantity, observation: takeObservation.trim() || "Consumo interno" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible registrar la toma."));
      setProducts((current) => current.map((item) => item.id === takeTarget.id ? { ...item, stock: Number(result.stock_after) } : item));
      setTakeTarget(null);
      if (section === "aseo") {
        const metricsResponse = await fetch(`${apiUrl}/inventory/aseo-summary`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (metricsResponse.ok) setAseoMetrics(await metricsResponse.json() as AseoMetrics);
      }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible registrar la toma."); } finally { setSaving(false); }
  }

  const visibleProducts = products.filter((product) => product.is_saleable === (section === "sale") && product.name.toLowerCase().includes(search.toLowerCase()));
  return <AdminPage title="Productos" description="Administra productos de venta y el stock interno de Aseo.">
    {showForm && <label className="mb-6 block max-w-sm border border-[var(--line)] bg-white p-4 text-sm font-semibold">Reposición por botón<input required min="1" step="1" type="number" value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Unidades que se sumarán al restablecer el stock.</span></label>}
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    {loading && <p className="mb-6 border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Cargando inventario...</p>}
    <div className="flex flex-wrap gap-2 border-b border-[var(--line)]"><button onClick={() => setSection("sale")} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "sale" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}>Productos a la venta</button><button onClick={() => aseoUnlocked && setSection("aseo")} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "aseo" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}>Aseo</button></div>
    {!aseoUnlocked && section === "sale" && <div className="mt-4 flex flex-wrap items-center gap-3 border border-[var(--line)] bg-white p-4"><KeyRound size={18} className="text-[var(--blue-main)]" /><span className="text-sm text-[var(--muted)]">El apartado Aseo está protegido.</span><input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" className="min-h-10 w-28 border border-[var(--line)] px-3" /><button onClick={unlockAseo} className="min-h-10 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white">Abrir Aseo</button></div>}
    {section === "aseo" && aseoMetrics && <div className="mt-6 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3"><div className="bg-white p-5"><p className="text-sm text-[var(--muted)]">Artículos</p><strong className="mt-2 block text-2xl">{aseoMetrics.product_count}</strong></div><div className="bg-white p-5"><p className="text-sm text-[var(--muted)]">Stock disponible</p><strong className="mt-2 block text-2xl">{aseoMetrics.total_units}</strong></div><div className="bg-white p-5"><p className="text-sm text-[var(--muted)]">Valor en stock</p><strong className="mt-2 block text-2xl">{money(aseoMetrics.stock_value)}</strong></div></div>}
    {(section === "sale" || aseoUnlocked) && <><div className="mt-6 flex flex-col gap-3 border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><label className="relative block flex-1"><span className="sr-only">Buscar productos</span><Search size={18} className="absolute left-3 top-3.5 text-[var(--muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto" className="min-h-11 w-full border border-[var(--line)] pl-10 pr-4" /></label><button onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"><Plus size={17} /> {section === "aseo" ? "Añadir artículo" : "Nuevo producto"}</button></div>
    {showForm && <form onSubmit={saveProduct} className="mt-6 border border-[var(--blue-secondary)] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? "Editar producto" : section === "aseo" ? "Registrar stock de Aseo" : "Crear producto"}</h2><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={19} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Nombre<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>{!editing && section === "sale" && <><label className="text-sm font-semibold">Categoría<select required value={categorySelection} onChange={(event) => setCategorySelection(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="new">+ Crear nueva categoría</option></select></label>{categorySelection === "new" && <label className="text-sm font-semibold">Nueva categoría<input required value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ej. Bebidas" className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>}</>}{section === "sale" && <><label className="text-sm font-semibold">Precio de venta<input required min="0" step="0.01" type="number" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="text-sm font-semibold">Costo<input required min="0" step="0.01" type="number" value={cost} onChange={(event) => setCost(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label></>}<label className="text-sm font-semibold">Stock<input required min="0" step="1" type="number" value={stock} onChange={(event) => setStock(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label>{!editing && <label className="text-sm font-semibold">Imagen opcional<input accept="image/png,image/jpeg,image/webp" type="file" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full border border-[var(--line)] px-3 py-2 text-sm font-normal" /></label>}</div><button disabled={saving} className="mt-5 min-h-11 bg-[var(--blue-main)] px-5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Guardando..." : editing ? "Guardar cambios" : "Guardar producto"}</button></form>}
    <div className="mt-6 overflow-x-auto border border-[var(--line)] bg-white"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[var(--muted)]"><tr><th className="p-4 font-medium">Producto</th><th className="p-4 font-medium">{section === "aseo" ? "Tipo" : "Precio"}</th><th className="p-4 font-medium">Stock</th><th className="p-4 font-medium">Estado</th><th className="p-4 font-medium">Acciones</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.id} className="border-b border-[var(--line)] last:border-0"><td className="p-4 font-semibold"><span className="flex items-center gap-3">{product.image_url ? <Image src={`${apiUrl.replace("/api/v1", "")}${product.image_url}`} alt="" width={40} height={40} unoptimized className="size-10 object-cover" /> : <span className="grid size-10 place-items-center bg-[var(--blue-light)]"><Package size={18} className="text-[var(--blue-main)]" /></span>}{product.name}</span></td><td className="p-4">{section === "aseo" ? "Solo inventario" : money(product.sale_price)}</td><td className="p-4">{product.stock}</td><td className="p-4">{product.is_active ? "Activo" : "Deshabilitado"}</td><td className="p-4"><span className="flex flex-wrap gap-2"><button title="Editar producto" onClick={() => openEdit(product)} className="grid size-9 place-items-center border border-[var(--line)] text-[var(--blue-main)]"><Pencil size={15} /></button><button onClick={() => toggleProduct(product)} className="min-h-9 border border-[var(--line)] px-2 text-xs">{product.is_active ? "Deshabilitar" : "Habilitar"}</button><button onClick={() => openTakeDialog(product)} className="min-h-9 bg-[var(--blue-main)] px-2 text-xs font-semibold text-white">Tomar</button><button type="button" disabled={saving} onClick={() => restockProduct(product)} className="min-h-9 bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Restablecer stock (+{product.restock_quantity})</button></span></td></tr>)}</tbody></table>{visibleProducts.length === 0 && <div className="p-10 text-center text-sm text-[var(--muted)]">No hay registros en este apartado.</div>}</div></>}
    {takeTarget && <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4"><form onSubmit={takeProduct} className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-sm text-[var(--muted)]">Uso interno</p><h2 className="mt-1 text-lg font-semibold">Tomar {takeTarget.name}</h2></div><button type="button" onClick={() => setTakeTarget(null)} aria-label="Cerrar toma"><X size={19} /></button></div><label className="mt-5 block text-sm font-semibold">Cantidad disponible: {takeTarget.stock}<input required min="0.001" max={Number(takeTarget.stock)} step="0.001" type="number" value={takeQuantity} onChange={(event) => setTakeQuantity(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" /></label><label className="mt-4 block text-sm font-semibold">Observación<textarea value={takeObservation} onChange={(event) => setTakeObservation(event.target.value)} rows={3} className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setTakeTarget(null)} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">Cancelar</button><button disabled={saving} className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Registrando..." : "Registrar toma"}</button></div></form></div>}
  </AdminPage>;
}
