"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Banknote,
  Check,
  CreditCard,
  Download,
  ImagePlus,
  Layers,
  ReceiptText,
  Smartphone,
  UserRound,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";

type Product = {
  id: number;
  name: string;
  sale_price: number;
  stock: number;
  unit: "KG" | "ML" | "UNIT" | "PAQUETE";
  is_combo?: boolean;
  components?: {
    product_id: number;
    product_name?: string;
    quantity: number;
  }[];
  content_quantity?: number | null;
  content_unit?: "G" | "KG" | "ML" | "L" | "UNIT" | null;
  image_url?: string | null;
};
type CartLine = Product & { quantity: number };
type PaymentMethod = "CASH" | "NEQUI" | "CREDIT";
type Customer = { id: number; name: string };
type Seller = { id: number; full_name: string };
type Receipt = {
  id: number;
  sale_number: string;
  total: number;
  payment_method: PaymentMethod;
  amount_received: number | null;
  change_amount: number;
  customer_name: string | null;
  created_at: string;
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  support_urls?: string[];
};

const imageUrl = (path?: string | null) => {
  if (!path?.trim()) return null;
  const trimmedPath = path.trim();
  if (/^https?:\/\//i.test(trimmedPath)) return trimmedPath;
  const candidate = trimmedPath.startsWith("/")
    ? `${apiUrl.replace("/api/v1", "")}${trimmedPath}`
    : `${apiUrl.replace("/api/v1", "")}/${trimmedPath}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
};
const readApiResponse = async (
  response: Response,
): Promise<{ detail?: string; [key: string]: unknown }> => {
  const text = await response.text();
  try {
    return text
      ? (JSON.parse(text) as { detail?: string; [key: string]: unknown })
      : {};
  } catch {
    return {
      detail: response.ok ? "" : `El servidor respondió ${response.status}.`,
    };
  }
};
const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
const paymentLabel: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  NEQUI: "Nequi",
  CREDIT: "Crédito",
};
const contentUnitLabels: Record<"G" | "KG" | "ML" | "L" | "UNIT", string> = {
  G: "g",
  KG: "kg",
  ML: "ml",
  L: "l",
  UNIT: "unidad",
};
const normalizeDisplayNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (Number.isInteger(parsed)) return String(Math.trunc(parsed));
  return parsed
    .toString()
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
};
const formatComboQuantity = (value: number | string | null | undefined) =>
  normalizeDisplayNumber(value) || "0";
const formatStock = (
  product: Pick<
    Product,
    "stock" | "unit" | "content_quantity" | "content_unit"
  >,
) => {
  const stock =
    product.unit === "UNIT" || product.unit === "PAQUETE"
      ? Math.round(Number(product.stock))
      : Number(product.stock)
          .toFixed(3)
          .replace(/\.000$/, "");
  const presentation =
    product.content_quantity && product.content_unit
      ? ` · ${Number(product.content_quantity).toString()} ${contentUnitLabels[product.content_unit]} c/u`
      : "";
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
  const [amountReceived, setAmountReceived] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/products?saleable_only=true`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.detail ?? "No fue posible cargar el catálogo.",
          );
        return result as Product[];
      })
      .then(setProducts)
      .catch((requestError: Error) =>
        setError(
          userFacingError(requestError, "No fue posible cargar los productos."),
        ),
      );
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/users/available`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as Seller[];
      })
      .then(setSellers)
      .catch(() => setSellers([]));
  }, []);

  useEffect(() => {
    if (buyerName.trim().length < 1 || customerId) {
      Promise.resolve().then(() => setSuggestions([]));
      return;
    }
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const timer = window.setTimeout(
      () =>
        fetch(
          `${apiUrl}/customers/search?query=${encodeURIComponent(buyerName.trim())}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        )
          .then((response) => response.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([])),
      220,
    );
    return () => window.clearTimeout(timer);
  }, [buyerName, customerId]);

  function addProduct(product: Product) {
    setCart((current) => {
      const line = current.find((item) => item.id === product.id);
      if (line)
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, Number(item.stock)),
              }
            : item,
        );
      return [...current, { ...product, quantity: 1 }];
    });
  }
  function changeQuantity(id: number, amount: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: Math.max(
                  0,
                  Math.min(item.quantity + amount, Number(item.stock)),
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }
  function chooseCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setBuyerName(customer.name);
    setSuggestions([]);
  }

  async function confirmSale() {
    setError("");
    if (!buyerName.trim()) {
      setError("Escribe el nombre del cliente antes de confirmar la venta.");
      return;
    }
    if (!assignedSellerId) {
      setError(
        "Selecciona el vendedor responsable antes de confirmar la venta.",
      );
      return;
    }
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const received = paymentMethod === "CASH" ? Number(amountReceived) : null;
      if (
        paymentMethod === "CASH" &&
        (received === null || !Number.isFinite(received) || received < total)
      ) {
        setError("El dinero recibido debe ser igual o mayor que el total.");
        return;
      }
      const salePayload = {
        customer_id: customerId,
        buyer_name: buyerName.trim() || null,
        payment_method: paymentMethod,
        amount_received: received,
        assigned_seller_id: assignedSellerId,
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      };
      const authHeaders: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      let response: Response;
      if (paymentMethod === "NEQUI" && supportFiles.length > 0) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(salePayload));
        supportFiles.forEach((file) => formData.append("files", file));
        response = await fetch(`${apiUrl}/sales/with-supports`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
      } else {
        response = await fetch(`${apiUrl}/sales`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(salePayload),
        });
      }
      const result = await readApiResponse(response);
      if (!response.ok)
        throw new Error(result.detail ?? "No fue posible confirmar la venta.");
      const saleResult = result as Receipt;
      setReceipt(saleResult);
      setCart([]);
      setBuyerName("");
      setCustomerId(null);
      setAssignedSellerId(null);
      setPaymentMethod("CASH");
      setAmountReceived("");
      setSupportFiles([]);
      const productsResponse = await fetch(
        `${apiUrl}/products?saleable_only=true`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (productsResponse.ok)
        setProducts((await productsResponse.json()) as Product[]);
    } catch (requestError) {
      setError(
        userFacingError(
          requestError,
          `No se pudo conectar con el backend (${apiUrl}). Verifica el deployment de la API.`,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  function exportReceipt() {
    if (!receipt) return;
    downloadExcel(
      receipt.items.map((item) => ({
        Venta: receipt.sale_number,
        Fecha: receipt.created_at,
        Comprador: receipt.customer_name ?? "Venta general",
        Pago: paymentLabel[receipt.payment_method],
        Producto: item.name,
        Cantidad: item.quantity,
        "Precio unitario": item.unit_price,
        Total: item.line_total,
      })),
      `venta-${receipt.sale_number}.xlsx`,
      "Venta",
    );
  }

  const visibleProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) &&
      Number(product.stock) > 0,
  );
  const total = cart.reduce(
    (sum, item) => sum + item.sale_price * item.quantity,
    0,
  );

  const cartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const received = Number(amountReceived);
  const paymentOptions: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
    { value: "CASH", label: "Efectivo", icon: Banknote },
    { value: "NEQUI", label: "Nequi", icon: Smartphone },
    { value: "CREDIT", label: "Crédito", icon: CreditCard },
  ];

  return (
    <AdminPage
      title="Ventas"
      description="Registra ventas, selecciona el comprador y el método de pago."
    >
      <section className="mb-6 border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserRound size={16} className="text-[var(--blue-main)]" />
            Vendedor asignado <span className="text-red-700">*</span>
          </h2>
          {assignedSellerId ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Check size={14} /> Listo para vender
            </span>
          ) : (
            <span className="text-xs text-[var(--muted)]">
              Elige quién atiende esta venta
            </span>
          )}
        </div>
        {sellers.length === 0 ? (
          <select
            required
            value={assignedSellerId ?? ""}
            onChange={(event) =>
              setAssignedSellerId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="mt-3 min-h-11 w-full border border-[var(--line)] bg-white px-3 text-sm"
            aria-label="Vendedor asignado"
          >
            <option value="">Selecciona un vendedor</option>
          </select>
        ) : (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {sellers.map((seller) => (
              <button
                key={seller.id}
                type="button"
                aria-pressed={assignedSellerId === seller.id}
                onClick={() =>
                  setAssignedSellerId(
                    assignedSellerId === seller.id ? null : seller.id,
                  )
                }
                className="choice shrink-0 !justify-start !pl-1.5"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-[var(--canvas)] font-heading text-sm font-bold text-[var(--blue-main)]">
                  {seller.full_name.charAt(0).toUpperCase()}
                </span>
                {seller.full_name}
              </button>
            ))}
          </div>
        )}
      </section>
      {error && (
        <p
          role="alert"
          className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:gap-6">
        <section className="min-w-0 border border-[var(--line)] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block flex-1">
              <span className="sr-only">Buscar productos</span>
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto para agregar"
                className="min-h-12 w-full border border-[var(--line)] pl-11 pr-10"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <span className="shrink-0 text-sm text-[var(--muted)]">
              {visibleProducts.length} disponibles
            </span>
          </div>
          <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => {
              const productImage = imageUrl(product.image_url);
              const inCart = cart.find((line) => line.id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  aria-label={`Agregar ${product.name}`}
                  className={`product-tile ${inCart ? "in-cart" : ""}`}
                >
                  <span className="relative block aspect-[4/3] w-full bg-[linear-gradient(160deg,var(--canvas),var(--surface))]">
                    {productImage ? (
                      <Image
                        src={productImage}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-contain p-3"
                      />
                    ) : (
                      <ShoppingBag
                        className="absolute inset-0 m-auto text-[var(--blue-main)] opacity-60"
                        size={42}
                      />
                    )}
                    <span className="add-badge" aria-hidden="true">
                      {inCart ? (
                        <span key={inCart.quantity} className="pop text-sm font-bold">
                          {inCart.quantity}
                        </span>
                      ) : (
                        <Plus size={18} />
                      )}
                    </span>
                    {product.is_combo && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm">
                        <Layers size={12} /> Combo
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col gap-2 border-t border-[var(--line)] p-4">
                    <strong className="block leading-snug">{product.name}</strong>
                    {product.is_combo && product.components?.length ? (
                      <span className="block text-xs text-[var(--muted)]">
                        {product.components
                          .map(
                            (component) =>
                              `${formatComboQuantity(component.quantity)} x ${component.product_name ?? "producto"}`,
                          )
                          .join(", ")}
                      </span>
                    ) : null}
                    <span className="mt-auto flex items-end justify-between gap-3 pt-1">
                      <span className="text-xs text-[var(--muted)]">
                        Stock: {formatStock(product)}
                      </span>
                      <span className="shrink-0 font-heading text-lg font-bold tracking-tight text-[var(--blue-main)]">
                        {money(product.sale_price)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {products.length === 0 && (
            <div className="grid place-items-center gap-3 p-12 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-[var(--blue-light)] text-[var(--blue-main)]">
                <ShoppingBag size={26} />
              </span>
              <p className="font-semibold">El catálogo está vacío.</p>
              <p className="max-w-xs text-sm text-[var(--muted)]">
                Agrega productos con stock en la sección Productos para venderlos aquí.
              </p>
            </div>
          )}
          {products.length > 0 && visibleProducts.length === 0 && (
            <p className="p-10 text-center text-sm text-[var(--muted)]">
              Ningún producto disponible coincide con “{search}”.
            </p>
          )}
        </section>
        <aside className="border border-[var(--line)] bg-white md:sticky md:top-32">
          <div className="screen m-3 p-5">
            <div className="screen-label flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <ReceiptText size={14} /> Venta actual
              </span>
              <span>
                {cart.length} líneas · {formatComboQuantity(cartUnits)} und.
              </span>
            </div>
            <p className="screen-amount mt-4 text-5xl">{money(total)}</p>
            {paymentMethod === "CASH" && received >= total && total > 0 && (
              <p className="pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-200">
                Vuelto {money(received - total)}
              </p>
            )}
          </div>
          <div className="px-5 pb-5 pt-2">
            <div className="relative">
              <label className="text-sm font-semibold">
                Comprador
                <input
                  value={buyerName}
                  onChange={(event) => {
                    setBuyerName(event.target.value);
                    setCustomerId(null);
                  }}
                  placeholder="Escribe para buscar o crear"
                  className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                />
              </label>
              {customerId && (
                <span className="absolute right-3 top-[2.35rem] inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check size={13} /> Cliente
                </span>
              )}
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl">
                  {suggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => chooseCustomer(customer)}
                      className="flex min-h-11 w-full items-center gap-2 !rounded-none px-3 text-left text-sm hover:bg-[var(--blue-light)]"
                    >
                      <UserRound size={14} className="text-[var(--muted)]" />
                      {customer.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Método de pago</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {paymentOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={paymentMethod === value}
                    onClick={() => setPaymentMethod(value)}
                    className="choice !flex-col !gap-1 !px-1 py-2"
                  >
                    <Icon size={17} />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {paymentMethod === "CASH" && (
              <label className="mt-4 block text-sm font-semibold">
                Dinero recibido
                <input
                  required
                  min={total}
                  step="1"
                  inputMode="numeric"
                  type="number"
                  value={amountReceived}
                  onChange={(event) =>
                    setAmountReceived(event.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                  placeholder={String(total)}
                />
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                  Vuelto: {amountReceived && Number(amountReceived) >= total
                    ? money(Number(amountReceived) - total)
                    : money(0)}
                </span>
              </label>
            )}
            {paymentMethod === "NEQUI" && (
              <label className="mt-4 block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">
                <span className="flex items-center gap-2">
                  <ImagePlus size={16} /> Soporte de pago{" "}
                  <span className="font-normal text-emerald-800">(opcional)</span>
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) =>
                    setSupportFiles(
                      Array.from(event.target.files ?? []).slice(0, 5),
                    )
                  }
                  className="mt-2 block min-h-11 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal"
                />
                <span className="mt-1 block text-xs font-normal text-emerald-800">
                  {supportFiles.length > 0
                    ? `${supportFiles.length} imagen(es) lista(s) para adjuntar.`
                    : "Puedes adjuntar hasta 5 imágenes antes de confirmar la venta."}
                </span>
              </label>
            )}
            {paymentMethod === "CREDIT" && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                El crédito se crea automáticamente con esta venta.
              </p>
            )}

            <div className="mt-5 border-t border-[var(--line)] pt-2">
              {cart.length === 0 ? (
                <div className="grid place-items-center gap-2 py-10 text-center">
                  <ShoppingBag size={24} className="text-[var(--blue-main)] opacity-60" />
                  <p className="text-sm text-[var(--muted)]">
                    Selecciona productos para comenzar.
                  </p>
                </div>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {money(item.sale_price)} c/u
                        </p>
                      </div>
                      <div className="flex items-center rounded-full border border-[var(--line)] bg-[var(--canvas)] p-0.5">
                        <button
                          aria-label="Reducir cantidad"
                          onClick={() => changeQuantity(item.id, -1)}
                          className="grid size-7 place-items-center !rounded-full hover:bg-white"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular">
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Aumentar cantidad"
                          onClick={() => changeQuantity(item.id, 1)}
                          className="grid size-7 place-items-center !rounded-full hover:bg-white"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="w-20 text-right text-sm font-bold tabular">
                        {money(item.sale_price * item.quantity)}
                      </span>
                      <button
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() =>
                          setCart((current) =>
                            current.filter((line) => line.id !== item.id),
                          )
                        }
                        className="grid size-7 place-items-center text-[var(--muted)] hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-[var(--line)] pt-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-heading text-2xl font-bold tracking-tight">{money(total)}</span>
              </div>
              <button
                onClick={confirmSale}
                disabled={cart.length === 0 || saving}
                className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 bg-[var(--blue-main)] text-base font-bold text-white hover:bg-[var(--blue-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={19} />
                {saving ? "Registrando..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        </aside>
      </div>
      {receipt && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[var(--ink)]/60 p-4">
          <article className="pop w-full max-w-md">
            <div className="rounded-t-[22px] bg-white p-7 shadow-2xl !rounded-b-none">
              <div className="flex justify-end print:hidden">
                <button
                  aria-label="Cerrar factura"
                  onClick={() => setReceipt(null)}
                  className="grid size-9 place-items-center text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="text-center">
                <div className="brand-mark mx-auto size-14 rounded-2xl">
                  <Check size={26} />
                </div>
                <h2 className="mt-4 text-2xl font-bold">Coffee Gosen</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Comprobante de venta
                </p>
              </div>
              <div className="mt-6 border-y border-dashed border-[var(--line)] py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Venta</span>
                  <strong>{receipt.sale_number}</strong>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-[var(--muted)]">Comprador</span>
                  <span>{receipt.customer_name ?? "Venta general"}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-[var(--muted)]">Pago</span>
                  <span>{paymentLabel[receipt.payment_method]}</span>
                </div>
                {receipt.payment_method === "CASH" &&
                  receipt.amount_received !== null && (
                    <>
                      <div className="mt-2 flex justify-between">
                        <span className="text-[var(--muted)]">Recibido</span>
                        <span>{money(receipt.amount_received)}</span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-[var(--muted)]">Vuelto</span>
                        <span>{money(receipt.change_amount)}</span>
                      </div>
                    </>
                  )}
              </div>
              <div className="py-4">
                {receipt.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span>
                      {item.quantity} x {item.name}
                    </span>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                ))}
              </div>
              <div className="flex items-end justify-between border-t-2 border-[var(--ink)] pt-4">
                <span className="font-semibold">Total</span>
                <span className="font-heading text-3xl font-bold tracking-tight">{money(receipt.total)}</span>
              </div>
              <div className="print:hidden mt-6 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--blue-main)] font-semibold text-white"
                >
                  <Printer size={17} /> Imprimir factura
                </button>
                <button
                  type="button"
                  onClick={exportReceipt}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] font-semibold text-[var(--blue-main)]"
                >
                  <Download size={17} /> Descargar Excel
                </button>
              </div>
            </div>
            <div className="receipt-edge" aria-hidden="true" />
          </article>
        </div>
      )}
    </AdminPage>
  );
}
