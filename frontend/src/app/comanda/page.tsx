"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Banknote,
  Check,
  CreditCard,
  Download,
  FileDown,
  ImagePlus,
  Layers,
  ReceiptText,
  Smartphone,
  UserRound,
  Minus,
  Plus,
  Printer,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { apiUrl, userFacingError } from "@/lib/api";
import { downloadExcel } from "@/lib/excel";
import { downloadReceiptPdf } from "@/lib/pdf";

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
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappError, setWhatsappError] = useState("");

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
      // Se comparan pesos enteros para que el pago exacto no falle por redondeo.
      const saleTotal = Math.round(total);
      const received = paymentMethod === "CASH" ? Math.round(Number(amountReceived)) : null;
      if (paymentMethod === "CASH" && !amountReceived) {
        setError("Escribe cuánto dinero te entregó el cliente.");
        return;
      }
      if (
        paymentMethod === "CASH" &&
        (received === null || !Number.isFinite(received) || received < saleTotal)
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
      setWhatsappNumber("");
      setWhatsappError("");
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

  function sendReceiptByWhatsApp() {
    if (!receipt) return;
    let digits = whatsappNumber.replace(/\D/g, "");
    if (digits.length === 10) digits = `57${digits}`;
    if (digits.length < 11 || digits.length > 15) {
      setWhatsappError("Escribe un número de celular válido, por ejemplo 300 123 4567.");
      return;
    }
    const lines = [
      "*Coffee Gosen* ☕",
      "Comprobante de venta",
      "",
      `Venta: ${receipt.sale_number}`,
      `Fecha: ${new Date(receipt.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}`,
      `Cliente: ${receipt.customer_name ?? "Venta general"}`,
      `Pago: ${paymentLabel[receipt.payment_method]}`,
      "",
      ...receipt.items.map((item) => `• ${formatComboQuantity(item.quantity)} x ${item.name} — ${money(Number(item.line_total))}`),
      "",
      ...(receipt.payment_method === "CASH" && receipt.amount_received !== null
        ? [`Recibido: ${money(Number(receipt.amount_received))}`, `Vuelto: ${money(Number(receipt.change_amount))}`]
        : []),
      `*Total: ${money(Number(receipt.total))}*`,
      "",
      "¡Gracias por tu compra!",
    ];
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  async function downloadReceipt() {
    if (!receipt) return;
    try {
      await downloadReceiptPdf(
        {
          saleNumber: receipt.sale_number,
          date: new Date(receipt.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
          customer: receipt.customer_name ?? "Venta general",
          payment: paymentLabel[receipt.payment_method],
          items: receipt.items.map((item) => ({
            name: item.name,
            detail: `${formatComboQuantity(item.quantity)} x ${money(Number(item.unit_price))}`,
            total: money(Number(item.line_total)),
          })),
          received: receipt.payment_method === "CASH" && receipt.amount_received !== null ? money(Number(receipt.amount_received)) : undefined,
          change: receipt.payment_method === "CASH" && receipt.amount_received !== null ? money(Number(receipt.change_amount)) : undefined,
          total: money(Number(receipt.total)),
        },
        `factura-${receipt.sale_number}.pdf`,
      );
    } catch {
      setError("No fue posible generar la factura en PDF.");
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
              <div className="mt-4">
                <label className="block text-sm font-semibold">
                  Dinero recibido
                  <span className="relative mt-2 block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={amountReceived ? new Intl.NumberFormat("es-CO").format(Number(amountReceived)) : ""}
                      onChange={(event) =>
                        setAmountReceived(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))
                      }
                      className="min-h-11 w-full border border-[var(--line)] pl-7 pr-3 font-normal"
                      placeholder={new Intl.NumberFormat("es-CO").format(total)}
                    />
                  </span>
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setAmountReceived(String(Math.round(total)))} disabled={total <= 0} className="choice !min-h-8 !px-2.5 !text-xs disabled:opacity-40">
                    Exacto
                  </button>
                  {[5000, 10000, 20000, 50000, 100000]
                    .filter((bill) => bill > total)
                    .slice(0, 3)
                    .map((bill) => (
                      <button key={bill} type="button" onClick={() => setAmountReceived(String(bill))} className="choice !min-h-8 !px-2.5 !text-xs">
                        {money(bill)}
                      </button>
                    ))}
                </div>
                <p className={`mt-2 text-sm font-semibold ${amountReceived && received < total ? "text-red-700" : "text-[var(--muted)]"}`}>
                  {amountReceived && received < total
                    ? `Faltan ${money(total - received)}`
                    : amountReceived
                      ? `Vuelto: ${money(received - total)}`
                      : "Escribe cuánto te entregó el cliente."}
                </p>
              </div>
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
        <div className="receipt-overlay fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[var(--ink)]/60 p-4">
          <article className="pop w-full max-w-md print:max-w-none">
            <div className="flex justify-end pb-2 print:hidden">
              <button
                aria-label="Cerrar factura"
                onClick={() => setReceipt(null)}
                className="grid size-10 place-items-center !rounded-full bg-white/90 text-[var(--ink)] shadow-lg hover:bg-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-hidden rounded-t-[22px] bg-white shadow-2xl print:shadow-none">
              <div className="relative overflow-hidden bg-[#2a130c] px-7 pb-6 pt-7 text-center text-[#fff6ea]">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full border border-[#e9b872]/25" />
                <div aria-hidden="true" className="pointer-events-none absolute -left-10 bottom-[-4.5rem] size-40 rounded-full border border-dashed border-[#e9b872]/25" />
                <Image src="/Coffe.png" alt="Coffee Gosen" width={84} height={84} className="relative mx-auto rounded-full shadow-[0_0_0_3px_rgba(233,184,114,0.35)]" />
                <p className="relative mt-3 text-xs text-[#e9b872]">Comprobante de venta</p>
                <p className="relative mt-4 font-heading text-4xl font-bold tracking-tight">{money(receipt.total)}</p>
                <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <Check size={13} /> Venta registrada
                </p>
              </div>
              <div className="px-7 pb-7 pt-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Venta</dt>
                    <dd className="mt-0.5 break-all font-semibold">{receipt.sale_number}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-[var(--muted)]">Fecha</dt>
                    <dd className="mt-0.5 font-semibold">
                      {new Date(receipt.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Comprador</dt>
                    <dd className="mt-0.5 font-semibold">{receipt.customer_name ?? "Venta general"}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-[var(--muted)]">Pago</dt>
                    <dd className="mt-0.5 font-semibold">{paymentLabel[receipt.payment_method]}</dd>
                  </div>
                </dl>

                <div className="mt-6 border-y border-dashed border-[var(--line)] py-3">
                  {receipt.items.map((item) => (
                    <div key={item.name} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block font-semibold">{item.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {formatComboQuantity(item.quantity)} x {money(Number(item.unit_price))}
                        </span>
                      </span>
                      <strong className="shrink-0">{money(Number(item.line_total))}</strong>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-4 text-sm">
                  {receipt.payment_method === "CASH" && receipt.amount_received !== null && (
                    <>
                      <div className="flex justify-between text-[var(--muted)]">
                        <span>Recibido</span>
                        <span>{money(Number(receipt.amount_received))}</span>
                      </div>
                      <div className="flex justify-between text-[var(--muted)]">
                        <span>Vuelto</span>
                        <span>{money(Number(receipt.change_amount))}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-end justify-between pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-heading text-3xl font-bold tracking-tight">{money(receipt.total)}</span>
                  </div>
                </div>
                <p className="mt-5 text-center text-xs text-[var(--muted)]">
                  Gracias por tu compra · Coffee Gosen, un lugar de provisión, fe y sabor
                </p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendReceiptByWhatsApp();
                  }}
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 print:hidden"
                >
                  <label className="block text-sm font-semibold text-emerald-950">
                    Enviar por WhatsApp
                    <span className="mt-2 flex gap-2">
                      <span className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-emerald-800">+57</span>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={whatsappNumber}
                          onChange={(event) => {
                            setWhatsappNumber(event.target.value.replace(/[^\d\s+]/g, ""));
                            setWhatsappError("");
                          }}
                          placeholder="300 123 4567"
                          className="min-h-11 w-full border border-emerald-200 bg-white pl-12 pr-3 font-normal"
                        />
                      </span>
                      <button
                        type="submit"
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        <Send size={16} /> Enviar
                      </button>
                    </span>
                  </label>
                  {whatsappError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{whatsappError}</p>}
                </form>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => void downloadReceipt()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--blue-main)] font-semibold text-white sm:col-span-2"
                  >
                    <FileDown size={18} /> Descargar factura
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--line)] font-semibold text-[var(--blue-main)]"
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
            </div>
            <div className="receipt-edge" aria-hidden="true" />
          </article>
        </div>
      )}
    </AdminPage>
  );
}
