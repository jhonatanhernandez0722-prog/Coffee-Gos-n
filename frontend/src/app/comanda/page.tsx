"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Minus, Plus, Printer, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";

type Product = { id: number; name: string; sale_price: number; stock: number; unit: "KG" | "ML" | "UNIT" | "PAQUETE"; is_combo?: boolean; components?: { product_id: number; product_name?: string; quantity: number }[]; content_quantity?: number | null; content_unit?: "G" | "KG" | "ML" | "L" | "UNIT" | null; image_url?: string | null };
type CartLine = Product & { quantity: number };
type PaymentMethod = "CASH" | "NEQUI" | "CREDIT";
type Customer = { id: number; name: string };
type Seller = { id: number; full_name: string };
type Receipt = { id: number; sale_number: string; total: number; payment_method: PaymentMethod; customer_name: string | null; created_at: string; items: { name: string; quantity: number; unit_price: number; line_total: number }[]; support_urls?: string[] };

const imageUrl = (path?: string | null) => {
  if (!path?.trim()) return null;
  const trimmedPath = path.trim();
  if (/^https?:\/\//i.test(trimmedPath)) return trimmedPath;
  const candidate = trimmedPath.startsWith("/") ? `${apiUrl.replace("/api/v1", "")}${trimmedPath}` : `${apiUrl.replace("/api/v1", "")}/${trimmedPath}`;
  try { new URL(candidate); return candidate; } catch { return null; }
};
const readApiResponse = async (response: Response): Promise<{ detail?: string; [key: string]: unknown }> => {
  const text = await response.text();
  try { return text ? JSON.parse(text) as { detail?: string; [key: string]: unknown } : {}; } catch { return { detail: response.ok ? "" : `El servidor respondió ${response.status}.` }; }
};
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const paymentLabel: Record<PaymentMethod, string> = { CASH: "Efectivo", NEQUI: "Nequi", CREDIT: "Crédito" };
const contentUnitLabels: Record<"G" | "KG" | "ML" | "L" | "UNIT", string> = { G: "g", KG: "kg", ML: "ml", L: "l", UNIT: "unidad" };
const normalizeDisplayNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (Number.isInteger(parsed)) return String(Math.trunc(parsed));
  return parsed.toString().replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
};
const formatComboQuantity = (value: number | string | null | undefined) => normalizeDisplayNumber(value) || "0";
const formatStock = (product: Pick<Product, "stock" | "unit" | "content_quantity" | "content_unit">) => {
  const stock = product.unit === "UNIT" || product.unit === "PAQUETE" ? Math.round(Number(product.stock)) : Number(product.stock).toFixed(3).replace(/\.000$/, "");
  const presentation = product.content_quantity && product.content_unit ? ` · ${Number(product.content_quantity).toString()} ${contentUnitLabels[product.content_unit]} c/u` : "";
  return `${stock} ${product.unit === "UNIT" ? "unidad" : product.unit === "PAQUETE" ? "paquete" : product.unit.toLowerCase()}${presentation ? presentation.replace("c/u", product.unit === "PAQUETE" ? "por paquete" : "por unidad") : ""}`;
};

export default function ComandaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [assignedSellerId, setAssignedSellerId] = useState<number | null>(null);
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/products?saleable_only=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar el catálogo."); return result as Product[]; })
      .then(setProducts)
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar los productos.")));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/users/available`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => { if (!response.ok) return []; return await response.json() as Seller[]; })
      .then(setSellers)
      .catch(() => setSellers([]));
  }, []);

  useEffect(() => {
    if (buyerName.trim().length < 1 || customerId) { Promise.resolve().then(() => setSuggestions([])); return; }
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const timer = window.setTimeout(() => fetch(`${apiUrl}/customers/search?query=${encodeURIComponent(buyerName.trim())}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then((response) => response.json()).then(setSuggestions).catch(() => setSuggestions([])), 220);
    return () => window.clearTimeout(timer);
  }, [buyerName, customerId]);

  function addProduct(product: Product) { setCart((current) => { const line = current.find((item) => item.id === product.id); if (line) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, Number(item.stock)) } : item); return [...current, { ...product, quantity: 1 }]; }); }
  function changeQuantity(id: number, amount: number) { setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, Math.min(item.quantity + amount, Number(item.stock))) } : item).filter((item) => item.quantity > 0)); }
  function chooseCustomer(customer: Customer) { setCustomerId(customer.id); setBuyerName(customer.name); setSuggestions([]); }

  async function confirmSale() {
    setError("");
    if (!buyerName.trim()) { setError("Escribe el nombre del cliente antes de confirmar la venta."); return; }
    if (!assignedSellerId) { setError("Selecciona el vendedor responsable antes de confirmar la venta."); return; }
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const salePayload = { customer_id: customerId, buyer_name: buyerName.trim() || null, payment_method: paymentMethod, assigned_seller_id: assignedSellerId, items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })) };
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      let response: Response;
      if (paymentMethod === "NEQUI" && supportFiles.length > 0) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(salePayload));
        supportFiles.forEach((file) => formData.append("files", file));
        response = await fetch(`${apiUrl}/sales/with-supports`, { method: "POST", headers: authHeaders, body: formData });
      } else {
        response = await fetch(`${apiUrl}/sales`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(salePayload) });
      }
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.detail ?? "No fue posible confirmar la venta.");
      const saleResult = result as Receipt;
      setReceipt(saleResult); setCart([]); setBuyerName(""); setCustomerId(null); setAssignedSellerId(null); setPaymentMethod("CASH"); setSupportFiles([]);
      const productsResponse = await fetch(`${apiUrl}/products?saleable_only=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (productsResponse.ok) setProducts(await productsResponse.json() as Product[]);
    } catch (requestError) {
      setError(userFacingError(requestError, `No se pudo conectar con el backend (${apiUrl}). Verifica el deployment de la API.`));
    } finally { setSaving(false); }
  }

  function exportReceipt() { if (!receipt) return; downloadExcel(receipt.items.map((item) => ({ Venta: receipt.sale_number, Fecha: receipt.created_at, Comprador: receipt.customer_name ?? "Venta general", Pago: paymentLabel[receipt.payment_method], Producto: item.name, Cantidad: item.quantity, "Precio unitario": item.unit_price, Total: item.line_total })), `venta-${receipt.sale_number}.xlsx`, "Venta"); }

  const visibleProducts = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) && Number(product.stock) > 0);
  const total = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);

  return <AdminPage title="Ventas" description="Registra ventas, selecciona el comprador y el método de pago.">
    
    <section className="mb-6 border border-[var(--line)] bg-white p-5"><label className="text-sm font-semibold">Vendedor asignado <span className="text-red-700">*</span><select required value={assignedSellerId ?? ""} onChange={(event) => setAssignedSellerId(event.target.value ? Number(event.target.value) : null)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"><option value="">Selecciona un vendedor</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}</select></label></section>
    {paymentMethod === "NEQUI" && <section className="mb-6 border border-emerald-200 bg-emerald-50 p-5"><label className="block text-sm font-semibold text-emerald-950">Soporte de pago <span className="font-normal text-emerald-800">(opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setSupportFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="mt-2 block min-h-11 w-full border border-emerald-200 bg-white px-3 py-2 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-emerald-800">Puedes adjuntar hasta 5 imágenes antes de confirmar la venta.</span></label></section>}
    {error && <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:gap-6">
      <section className="min-w-0 border border-[var(--line)] bg-white p-5"><label className="relative block"><span className="sr-only">Buscar productos</span><Search size={18} className="absolute left-3 top-3.5 text-[var(--muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto para agregar" className="min-h-12 w-full border border-[var(--line)] pl-10 pr-4 outline-none focus:border-[var(--blue-main)]" /></label><div className="mt-5 grid items-start gap-4 sm:grid-cols-2">{visibleProducts.map((product) => { const productImage = imageUrl(product.image_url); return <button key={product.id} onClick={() => addProduct(product)} className="flex min-h-64 flex-col overflow-hidden border-[3px] border-black bg-white text-left hover:bg-white focus:bg-white"><span className="relative block aspect-[4/3] w-full bg-white">{productImage ? <Image src={productImage} alt={product.name} fill unoptimized className="object-contain" /> : <ShoppingBag className="absolute inset-0 m-auto text-[var(--blue-main)]" size={42} />}</span><span className="flex flex-1 items-end justify-between gap-3 bg-white p-4"><span><strong className="block">{product.name}</strong>{product.is_combo && <span className="mt-1 inline-flex border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">COMBO</span>}<span className="mt-1 block text-sm text-[var(--muted)]">Stock: {formatStock(product)}</span>{product.is_combo && product.components?.length ? <span className="mt-1 block text-xs text-[var(--muted)]">{product.components.map((component) => `${formatComboQuantity(component.quantity)} x ${component.product_name ?? "producto"}`).join(", ")}</span> : null}</span><span className="shrink-0 font-semibold text-[var(--blue-main)]">{money(product.sale_price)}</span></span></button>; })}</div>{products.length === 0 && <div className="p-10 text-center text-sm text-[var(--muted)]"><ShoppingBag className="mx-auto mb-3 text-[var(--blue-main)]" size={26} />El catálogo está vacío.</div>}</section>
      <aside className="border border-[var(--ink)] bg-white p-5"><div className="border-b border-[var(--line)] pb-4"><h2 className="font-semibold">Datos de la venta</h2><div className="relative mt-4"><label className="text-sm font-semibold">Comprador<input value={buyerName} onChange={(event) => { setBuyerName(event.target.value); setCustomerId(null); }} placeholder="Escribe para buscar o crear" className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal outline-none focus:border-[var(--blue-main)]" /></label>{suggestions.length > 0 && <div className="absolute z-10 mt-1 w-full border border-[var(--line)] bg-white shadow-lg">{suggestions.map((customer) => <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)} className="block min-h-11 w-full px-3 text-left text-sm hover:bg-[var(--blue-light)]">{customer.name}</button>)}</div>}</div><label className="mt-3 block text-sm font-semibold">Método de pago<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal outline-none focus:border-[var(--blue-main)]"><option value="CASH">Efectivo</option><option value="NEQUI">Nequi</option><option value="CREDIT">Crédito</option></select></label>{paymentMethod === "CREDIT" && <p className="mt-2 text-xs text-[var(--muted)]">El crédito se crea automáticamente con esta venta.</p>}</div><div className="flex items-center justify-between border-b border-[var(--line)] py-4"><h2 className="font-semibold">Venta actual</h2><span className="text-sm text-[var(--muted)]">{cart.length} líneas</span></div><div className="min-h-48 py-4">{cart.length === 0 ? <p className="py-12 text-center text-sm text-[var(--muted)]">Selecciona productos para comenzar.</p> : cart.map((item) => <div key={item.id} className="border-b border-[var(--line)] py-3"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{item.name}</p><button aria-label={`Eliminar ${item.name}`} onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))} className="text-[var(--muted)] hover:text-red-600"><Trash2 size={16} /></button></div><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><button aria-label="Reducir cantidad" onClick={() => changeQuantity(item.id, -1)} className="grid size-8 place-items-center border border-[var(--line)]"><Minus size={14} /></button><span className="w-5 text-center text-sm">{item.quantity}</span><button aria-label="Aumentar cantidad" onClick={() => changeQuantity(item.id, 1)} className="grid size-8 place-items-center border border-[var(--line)]"><Plus size={14} /></button></div><span className="font-semibold">{money(item.sale_price * item.quantity)}</span></div></div>)}</div><div className="border-t border-[var(--line)] pt-4"><div className="flex items-center justify-between text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div><button onClick={confirmSale} disabled={cart.length === 0 || saving} className="mt-5 min-h-12 w-full bg-[var(--blue-main)] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Registrando..." : "Confirmar venta"}</button></div></aside>
    </div>
    {receipt && <div className="fixed inset-0 z-20 grid place-items-center bg-[var(--ink)]/50 p-4"><article className="w-full max-w-md bg-white p-7 shadow-2xl"><div className="flex justify-end print:hidden"><button aria-label="Cerrar factura" onClick={() => setReceipt(null)}><X size={20} /></button></div><div className="text-center"><div className="mx-auto grid size-12 place-items-center bg-[var(--blue-main)] text-white"><ShoppingBag size={22} /></div><h2 className="mt-4 text-2xl font-semibold">Coffee Gosen</h2><p className="mt-1 text-xs text-[var(--muted)]">Comprobante de venta</p></div><div className="mt-6 border-y border-dashed border-[var(--line)] py-4 text-sm"><div className="flex justify-between"><span>Venta</span><strong>{receipt.sale_number}</strong></div><div className="mt-2 flex justify-between"><span>Comprador</span><span>{receipt.customer_name ?? "Venta general"}</span></div><div className="mt-2 flex justify-between"><span>Pago</span><span>{paymentLabel[receipt.payment_method]}</span></div></div><div className="py-4">{receipt.items.map((item) => <div key={item.name} className="flex justify-between py-2 text-sm"><span>{item.quantity} x {item.name}</span><strong>{money(item.line_total)}</strong></div>)}</div><div className="flex justify-between border-t-2 border-[var(--ink)] pt-4 text-xl font-semibold"><span>Total</span><span>{money(receipt.total)}</span></div><div className="print:hidden mt-6 grid gap-2 sm:grid-cols-2"><button onClick={() => window.print()} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--blue-main)] font-semibold text-white"><Printer size={17} /> Imprimir factura</button><button type="button" onClick={exportReceipt} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] font-semibold text-[var(--blue-main)]"><Download size={17} /> Descargar Excel</button></div></article></div>}
  </AdminPage>;
}
