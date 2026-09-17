"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import Image from "next/image";
import { ArchiveRestore, Download, Package, PackageX, Pencil, Plus, Search, X } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { downloadExcel } from "@/lib/excel";

type Product = {
  id: number;
  category_id: number;
  name: string;
  sale_price: number;
  acquisition_cost: number;
  stock: number;
  low_stock_threshold: number;
  restock_quantity: number;
  is_active: boolean;
  is_saleable: boolean;
  unit: "KG" | "ML" | "UNIT";
  content_quantity?: number | null;
  content_unit?: "G" | "KG" | "ML" | "L" | null;
  image_url?: string | null;
};

type Category = { id: number; name: string; is_active: boolean };
type Section = "sale" | "insumos" | "desechables" | "limpieza" | "started";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://backend-lemon-five-80.vercel.app/api/v1"
    : "http://localhost:8001/api/v1");

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const imageUrl = (path?: string | null) => {
  if (!path?.trim()) return null;
  const trimmedPath = path.trim();
  if (/^https?:\/\//i.test(trimmedPath)) return trimmedPath;
  try {
    const baseUrl = apiUrl.replace("/api/v1", "");
    const candidate = trimmedPath.startsWith("/") ? `${baseUrl}${trimmedPath}` : `${baseUrl}/${trimmedPath}`;
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
};

const wholeNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const apiError = (result: { detail?: string | { msg?: string }[] }, fallback: string) =>
  Array.isArray(result.detail)
    ? result.detail.map((item) => item.msg).filter(Boolean).join(". ") || fallback
    : result.detail || fallback;
const unitLabels: Record<Product["unit"], string> = { KG: "kg", ML: "ml", UNIT: "unidad" };
const contentUnitLabels: Record<"G" | "KG" | "ML" | "L", string> = { G: "g", KG: "kg", ML: "ml", L: "l" };
const normalizeQuantityInput = (value: string, unit: Product["unit"]) => unit === "UNIT" ? value.replace(/[^0-9]/g, "") : value;
const preventDecimalKeys = (event: KeyboardEvent<HTMLInputElement>) => {
  if ([".", ",", "e", "E", "+", "-"].includes(event.key)) event.preventDefault();
};
const formatStock = (product: Pick<Product, "stock" | "unit" | "content_quantity" | "content_unit">) => {
  const stock = product.unit === "UNIT" ? wholeNumber(product.stock) : Number(product.stock).toFixed(3).replace(/\.000$/, "");
  const presentation = product.content_quantity && product.content_unit ? ` · ${Number(product.content_quantity).toString()} ${contentUnitLabels[product.content_unit]} c/u` : "";
  return `${stock} ${unitLabels[product.unit ?? "UNIT"]}${presentation}`;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [startedProducts, setStartedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [section, setSection] = useState<Section>("sale");
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
  const [unit, setUnit] = useState<"KG" | "ML" | "UNIT">("UNIT");
  const [contentQuantity, setContentQuantity] = useState("");
  const [contentUnit, setContentUnit] = useState<"G" | "KG" | "ML" | "L">("ML");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [takeTarget, setTakeTarget] = useState<Product | null>(null);
  const [takeQuantity, setTakeQuantity] = useState("1");
  const [takeAll, setTakeAll] = useState(false);
  const [takeObservation, setTakeObservation] = useState("Consumo interno");
  const [damageTarget, setDamageTarget] = useState<Product | null>(null);
  const [damageQuantity, setDamageQuantity] = useState("1");
  const [damageObservation, setDamageObservation] = useState("Producto dañado");
  const [purchaseTarget, setPurchaseTarget] = useState<Product | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseCost, setPurchaseCost] = useState("0");
  const [purchaseMethod, setPurchaseMethod] = useState<"CASH" | "NEQUI">("CASH");
  const [purchaseObservation, setPurchaseObservation] = useState("Compra de Aseo");
  const [disabledProducts, setDisabledProducts] = useState<Product[]>([]);
  const [disabledModalOpen, setDisabledModalOpen] = useState(false);
  const [disabledLoading, setDisabledLoading] = useState(false);
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedUser = sessionStorage.getItem("coffee_gosen_user");
    return storedUser ? (JSON.parse(storedUser) as { role?: string }).role === "ADMIN" : false;
  });

  async function loadCatalog() {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const [productsResponse, categoriesResponse, startedResponse] = await Promise.all([
      fetch(`${apiUrl}/products`, { headers }),
      fetch(`${apiUrl}/categories`, { headers }),
      fetch(`${apiUrl}/inventory/started`, { headers }),
    ]);
    const productsResult = await productsResponse.json();
    const categoriesResult = await categoriesResponse.json();
    const startedResult = await startedResponse.json();

    if (!productsResponse.ok) {
      throw new Error(apiError(productsResult, "No fue posible cargar los productos."));
    }
    if (!categoriesResponse.ok) {
      throw new Error(apiError(categoriesResult, "No fue posible cargar las categorías."));
    }
    if (!startedResponse.ok) {
      throw new Error(apiError(startedResult, "No fue posible cargar los productos comenzados."));
    }

    setProducts(productsResult as Product[]);
    setCategories(categoriesResult as Category[]);
    setStartedProducts(startedResult as Product[]);
  }

  useEffect(() => {
    Promise.resolve()
      .then(loadCatalog)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCategorySelection(categories.length ? "" : "new");
    setNewCategoryName("");
    setSalePrice("");
    setCost("");
    setStock("");
    setRestockQuantity("10");
    setUnit("UNIT");
    setContentQuantity("");
    setContentUnit("ML");
    setImage(null);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setName(product.name);
    setCategorySelection(String(product.category_id));
    setNewCategoryName("");
    setSalePrice(String(product.sale_price));
    setCost(String(product.acquisition_cost));
    setStock(product.unit === "UNIT" ? String(wholeNumber(product.stock)) : String(product.stock));
    setRestockQuantity(product.unit === "UNIT" ? String(wholeNumber(product.restock_quantity)) : String(product.restock_quantity));
    setUnit(section === "sale" ? "UNIT" : product.unit ?? "UNIT");
    setContentQuantity(product.content_quantity == null ? "" : String(product.content_quantity));
    setContentUnit(product.content_unit ?? "ML");
    setImage(null);
    setShowForm(true);
  }

  function openPurchaseDialog(product: Product) {
    setPurchaseTarget(product);
    setPurchaseQuantity("1");
    setPurchaseCost(String(product.acquisition_cost || 0));
    setPurchaseMethod("CASH");
    setPurchaseObservation(`Compra de ${product.name}`);
    setError("");
  }

  async function purchaseProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseTarget) return;

    const quantity = purchaseTarget?.unit === "UNIT" ? Math.trunc(Number(purchaseQuantity)) : Number(purchaseQuantity);
    const unitCost = Number(purchaseCost);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("La cantidad de compra debe ser mayor a cero.");
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      setError("El costo unitario debe ser mayor a cero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/inventory/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id: purchaseTarget.id,
          quantity,
          unit_cost: unitCost,
          payment_method: purchaseMethod,
          observation: purchaseObservation.trim() || `Compra de ${purchaseTarget.name}`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible registrar la compra."));

      setProducts((current) =>
        current.map((item) => (item.id === purchaseTarget.id ? { ...item, stock: Number(result.stock_after), acquisition_cost: unitCost } : item)),
      );

      setPurchaseTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (editing) {
        let categoryId = Number(categorySelection);

        if (categorySelection === "new") {
          const wantedCategory = newCategoryName.trim();
          if (!wantedCategory) throw new Error("Escribe el nombre de la nueva categoría.");

          const categoryResponse = await fetch(`${apiUrl}/categories`, {
            method: "POST",
            headers,
            body: JSON.stringify({ name: wantedCategory }),
          });
          const categoryResult = await categoryResponse.json();
          if (!categoryResponse.ok) {
            throw new Error(apiError(categoryResult, "No fue posible crear la categoría."));
          }

          const createdCategory = categoryResult as Category;
          categoryId = createdCategory.id;
          setCategorySelection(String(createdCategory.id));
          setCategories((current) => [...current, createdCategory].sort((first, second) => first.name.localeCompare(second.name)));
        }

        const response = await fetch(`${apiUrl}/products/${editing.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            category_id: categoryId,
            name: name.trim(),
            unit: section === "sale" ? "UNIT" : unit,
            content_quantity: section === "sale" || !contentQuantity.trim() ? null : Number(contentQuantity),
            content_unit: section === "sale" || !contentQuantity.trim() ? null : contentUnit,
            sale_price: section === "sale" ? Number(salePrice) : 0,
            acquisition_cost: Number(cost),
            stock: Number(stock),
            restock_quantity: Number(restockQuantity),
            is_saleable: section === "sale",
          }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(apiError(result, "No fue posible editar el producto."));
        }

        let savedProduct = result as Product;

        if (image) {
          const formData = new FormData();
          formData.append("image", image);

          const imageResponse = await fetch(`${apiUrl}/products/${editing.id}/image`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData,
          });

          const imageResult = await imageResponse.json();
          if (!imageResponse.ok) {
            throw new Error(apiError(imageResult, "El producto se actualizó, pero no fue posible guardar la imagen."));
          }
          savedProduct = imageResult as Product;
        }

        setProducts((current) => current.map((item) => (item.id === editing.id ? savedProduct : item)));
        setShowForm(false);
        setEditing(null);
        return;
      }

      const inventoryCategoryName = section === "desechables" ? "Desechables" : section === "limpieza" ? "Gosen Limpieza" : "Insumos";
      let category = section === "sale"
        ? categories.find((item) => item.id === Number(categorySelection))
        : categories.find((item) => item.name.toLowerCase() === inventoryCategoryName.toLowerCase());

      if ((categorySelection === "new" && section === "sale") || (!category && section !== "sale")) {
        const wantedCategory = section === "sale" ? newCategoryName.trim() : inventoryCategoryName;
        if (!wantedCategory) throw new Error("Escribe el nombre de la nueva categoría.");

        const categoryResponse = await fetch(`${apiUrl}/categories`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: wantedCategory }),
        });
        const categoryResult = await categoryResponse.json();
        if (!categoryResponse.ok) {
          throw new Error(apiError(categoryResult, "No fue posible crear la categoría."));
        }

        category = categoryResult as Category;
        setCategories((current) => [...current, category as Category].sort((first, second) => first.name.localeCompare(second.name)));
      }

      if (!category) throw new Error("Selecciona una categoría.");

      const response = await fetch(`${apiUrl}/products`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category_id: category.id,
          name: name.trim(),
          unit: section === "sale" ? "UNIT" : unit,
          content_quantity: section === "sale" || !contentQuantity.trim() ? null : Number(contentQuantity),
          content_unit: section === "sale" || !contentQuantity.trim() ? null : contentUnit,
          sale_price: section === "sale" ? Number(salePrice) : 0,
          acquisition_cost: Number(cost),
          stock: Number(stock),
          low_stock_threshold: 5,
          restock_quantity: Number(restockQuantity),
          is_saleable: section === "sale",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible crear el producto."));

      let savedProduct = result as Product;
      if (image) {
        const formData = new FormData();
        formData.append("image", image);

        const imageResponse = await fetch(`${apiUrl}/products/${savedProduct.id}/image`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });

        const imageResult = await imageResponse.json();
        if (!imageResponse.ok) {
          throw new Error(apiError(imageResult, "El producto se creó, pero no fue posible guardar la imagen."));
        }
        savedProduct = imageResult as Product;
      }

      setProducts((current) => [...current, savedProduct]);
      setShowForm(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`¿Eliminar definitivamente ${product.name}? Esta acción no se puede deshacer.`)) return;
    setError("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products/${product.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible eliminar el producto."));
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible eliminar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product: Product) {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/products/${product.id}/${product.is_active ? "disable" : "enable"}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const result = await response.json();

    if (!response.ok) {
      setError(apiError(result, "No fue posible cambiar el estado del producto."));
      return;
    }

    setProducts((current) => current.map((item) => (item.id === product.id ? (result as Product) : item)));
  }

  async function openDisabledProducts() {
    setDisabledModalOpen(true);
    setDisabledLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products?include_disabled=true`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible cargar los productos deshabilitados."));
      setDisabledProducts((result as Product[]).filter((product) => !product.is_active));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible cargar los productos deshabilitados.");
    } finally {
      setDisabledLoading(false);
    }
  }

  async function enableProduct(product: Product) {
    setSaving(true);
    setError("");
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products/${product.id}/enable`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible habilitar el producto."));
      setDisabledProducts((current) => current.filter((item) => item.id !== product.id));
      await loadCatalog();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible habilitar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function restockProduct(product: Product) {
    setError("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/products/${product.id}/restock`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible restablecer el stock."));

      setProducts((current) => current.map((item) => (item.id === product.id ? (result as Product) : item)));

    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible restablecer el stock.");
    } finally {
      setSaving(false);
    }
  }

  function openTakeDialog(product: Product) {
    setTakeTarget(product);
    setTakeQuantity("1");
    setTakeAll(false);
    setTakeObservation("Consumo interno");
    setError("");
  }

  async function takeProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!takeTarget) return;

    const quantity = takeAll ? Number(takeTarget.stock) : Number(takeQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(takeTarget.stock)) {
      setError("La cantidad debe ser mayor a cero y no superar el stock disponible.");
      return;
    }

    setSaving(true);
    const token = sessionStorage.getItem("coffee_gosen_access_token");

    try {
      const response = await fetch(`${apiUrl}/inventory/internal-use`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id: takeTarget.id,
          quantity,
          observation: takeObservation.trim() || "Consumo interno",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible registrar la toma."));

      setProducts((current) =>
        current.map((item) => (item.id === takeTarget.id ? { ...item, stock: Number(result.stock_after) } : item)),
      );
      setStartedProducts((current) => {
        if (Number(result.stock_after) <= 0) return current.filter((item) => item.id !== takeTarget.id);
        const startedProduct = { ...takeTarget, stock: Number(result.stock_after) };
        return current.some((item) => item.id === takeTarget.id)
          ? current.map((item) => (item.id === takeTarget.id ? startedProduct : item))
          : [...current, startedProduct];
      });
      setTakeTarget(null);

    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible registrar la toma.");
    } finally {
      setSaving(false);
    }
  }

  function openDamageDialog(product: Product) {
    setDamageTarget(product);
    setDamageQuantity("1");
    setDamageObservation("Producto dañado");
    setError("");
  }

  async function reportDamage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!damageTarget) return;
    const quantity = Number(damageQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(damageTarget.stock)) {
      setError("La cantidad debe ser mayor a cero y no superar el stock disponible.");
      return;
    }
    if (damageObservation.trim().length < 2) {
      setError("Escribe el motivo del daño.");
      return;
    }
    setSaving(true);
    try {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/inventory/damage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ product_id: damageTarget.id, quantity, observation: damageObservation.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "No fue posible reportar el daño."));
      setProducts((current) => current.map((item) => item.id === damageTarget.id ? { ...item, stock: Number(result.stock_after) } : item));
      setDamageTarget(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible reportar el daño.");
    } finally {
      setSaving(false);
    }
  }

  const categoryName = (product: Product) => categories.find((category) => category.id === product.category_id)?.name.toLowerCase() ?? "";
  const visibleProducts = (section === "started" ? startedProducts : products).filter((product) => {
    if (section === "started") return product.name.toLowerCase().includes(search.toLowerCase());
    const name = categoryName(product);
    const matchesSection = section === "sale"
      ? product.is_saleable
      : !product.is_saleable && (section === "desechables" ? name === "desechables" : section === "limpieza" ? name === "gosen limpieza" : name === "insumos" || name === "aseo");
    return matchesSection && product.name.toLowerCase().includes(search.toLowerCase());
  });
  const stockMetrics = {
    productCount: visibleProducts.length,
    totalUnits: Number(visibleProducts.reduce((total, product) => total + Number(product.stock), 0).toFixed(3)),
  };

  function exportProducts() {
    downloadExcel(
      visibleProducts.map((product) => ({
        Producto: product.name,
        Tipo: product.is_saleable ? "Venta" : "Aseo",
        Precio: product.sale_price,
        Costo: product.acquisition_cost,
        Stock: product.unit === "UNIT" ? wholeNumber(product.stock) : Number(product.stock),
        "Stock mínimo": product.low_stock_threshold,
        Estado: product.is_active ? "Activo" : "Deshabilitado",
      })),
      "productos.xlsx",
      "Productos",
    );
  }

  return (
    <AdminPage title="Productos" description="Administra productos de venta y el stock interno de Aseo.">
      {showForm && (
        <label className="mb-6 block max-w-sm border border-[var(--line)] bg-white p-4 text-sm font-semibold">
          Reposición por botón
          <input
            required
            min="1"
            step="1"
            type="number"
            value={restockQuantity}
            onChange={(event) => setRestockQuantity(normalizeQuantityInput(event.target.value, unit))}
            className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
            Unidades que se sumarán al restablecer el stock.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="mb-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={exportProducts}
        className="mb-4 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
      >
        <Download size={16} /> Descargar Excel
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={() => void openDisabledProducts()}
          className="mb-4 ml-2 inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
        >
          <ArchiveRestore size={16} /> Ver deshabilitados
        </button>
      )}

      {loading && (
        <p className="mb-6 border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
          Cargando inventario...
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-[var(--line)]">
        <button
          type="button"
          onClick={() => setSection("sale")}
          className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "sale" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Cafetería
        </button>
        <button
          type="button"
          onClick={() => setSection("insumos")}
          className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "insumos" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Gosen Insumos
        </button>
        <button
          type="button"
          onClick={() => setSection("desechables")}
          className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "desechables" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Gosen Desechables
        </button>
        <button
          type="button"
          onClick={() => setSection("limpieza")}
          className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "limpieza" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Gosen Limpieza
        </button>
        <button
          type="button"
          onClick={() => setSection("started")}
          className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${section === "started" ? "border-[var(--blue-main)] text-[var(--blue-main)]" : "border-transparent text-[var(--muted)]"}`}
        >
          Productos comenzados
        </button>
      </div>

      {section !== "sale" && (
        <div className="mt-6 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
          <div className="bg-white p-5">
            <p className="text-sm text-[var(--muted)]">Artículos</p>
            <strong className="mt-2 block text-2xl">{stockMetrics.productCount}</strong>
          </div>
          <div className="bg-white p-5">
            <p className="text-sm text-[var(--muted)]">Stock disponible</p>
            <strong className="mt-2 block text-2xl">{stockMetrics.totalUnits}</strong>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search size={18} className="absolute left-3 top-3.5 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto"
            className="min-h-11 w-full border border-[var(--line)] pl-10 pr-4"
          />
        </label>
        {section !== "started" && <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} /> {section === "sale" ? "Nuevo producto" : "Añadir artículo"}
        </button>}
      </div>

      {showForm && (
        <form onSubmit={saveProduct} className="mt-6 border border-[var(--blue-secondary)] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editing ? "Editar producto" : section === "sale" ? "Crear producto" : `Añadir ${section === "desechables" ? "desechable" : section === "limpieza" ? "producto de limpieza" : "insumo"}`}
            </h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar formulario">
              <X size={19} />
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Nombre
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>

            {section === "sale" && (
              <>
                <label className="text-sm font-semibold">
                  Categoría
                  <select
                    required
                    value={categorySelection}
                    onChange={(event) => setCategorySelection(event.target.value)}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                    <option value="new">+ Crear nueva categoría</option>
                  </select>
                </label>

                {categorySelection === "new" && (
                  <label className="text-sm font-semibold">
                    Nueva categoría
                    <input
                      required
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Ej. Bebidas"
                      className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                    />
                  </label>
                )}
              </>
            )}

            {section === "sale" && (
              <>
                <label className="text-sm font-semibold">
                  Precio de venta
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold">
                  Costo
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={cost}
                    onChange={(event) => setCost(event.target.value)}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                  />
                </label>

                {editing ? (
                  <label className="text-sm font-semibold">
                    Stock
                    <input
                      required
                      min="0"
                      step={unit === "UNIT" ? "1" : "0.001"}
                      type="number"
                      value={stock}
                      onChange={(event) => setStock(normalizeQuantityInput(event.target.value, unit === "UNIT" ? "UNIT" : unit))}
                      className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                    />
                  </label>
                ) : (
                  <label className="text-sm font-semibold">
                    Stock inicial
                    <input
                      required
                      min="0"
                      step="1"
                      type="number"
                      value={stock}
                      onChange={(event) => setStock(normalizeQuantityInput(event.target.value, "UNIT"))}
                      className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                    />
                  </label>
                )}
              </>
            )}

            <label className="text-sm font-semibold sm:col-span-2">
              Imagen opcional
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="mt-2 block min-h-11 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-none file:border-0 file:bg-[var(--blue-light)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--blue-main)]"
              />
            </label>

            {section !== "sale" && (
              <>
                <label className="text-sm font-semibold">
                  Se mide en
                  <select
                    value={unit}
                    onChange={(event) => setUnit(event.target.value as Product["unit"])}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kilogramos (kg)</option>
                    <option value="ML">Mililitros (ml)</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Cantidad
                  <input
                    required
                    min="0"
                    step={unit === "UNIT" ? "1" : "0.001"}
                    type="number"
                    value={stock}
                    onChange={(event) => setStock(normalizeQuantityInput(event.target.value, unit))}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold">
                  Contenido por unidad (opcional)
                  <input min="0.001" step="0.001" type="number" value={contentQuantity} onChange={(event) => setContentQuantity(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" placeholder="Ej. 250" />
                </label>
                <label className="text-sm font-semibold">
                  Unidad del contenido
                  <select value={contentUnit} onChange={(event) => setContentUnit(event.target.value as "G" | "KG" | "ML" | "L")} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal">
                    <option value="G">Gramos (g)</option>
                    <option value="ML">Mililitros (ml)</option>
                    <option value="KG">Kilogramos (kg)</option>
                    <option value="L">Litros (l)</option>
                  </select>
                </label>

                <label className="text-sm font-semibold">
                  Costo unitario
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={cost}
                    onChange={(event) => setCost(event.target.value)}
                    className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
                  />
                </label>
              </>
            )}
          </div>

          <button
            disabled={saving}
            className="mt-5 min-h-11 bg-[var(--blue-main)] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Guardar producto"}
          </button>
        </form>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {visibleProducts.map((product) => (
          <article key={product.id} className="border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {imageUrl(product.image_url) ? (
                  <Image
                    src={imageUrl(product.image_url) as string}
                    alt={product.name}
                    width={52}
                    height={52}
                    unoptimized
                    className="size-12 rounded-sm object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center bg-[var(--blue-light)]">
                    <Package size={20} className="text-[var(--blue-main)]" />
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{product.name}</h3>
                  <p className="text-xs text-[var(--muted)]">{section === "sale" ? `Categoría #${product.category_id}` : section === "desechables" ? "Desechable" : section === "limpieza" ? "Gosen Limpieza" : "Insumo"}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${product.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                {product.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="border border-[var(--line)] bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{section === "sale" ? "Precio" : "Costo"}</p>
                <strong className="mt-1 block text-sm">{section === "sale" ? money(product.sale_price) : money(product.acquisition_cost)}</strong>
              </div>
              <div className="border border-[var(--line)] bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Stock</p>
                <strong className="mt-1 block text-sm">{formatStock(product)}</strong>
              </div>
              <div className="border border-[var(--line)] bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Reposición</p>
                <strong className="mt-1 block text-sm">+{product.unit === "UNIT" ? wholeNumber(product.restock_quantity) : product.restock_quantity}</strong>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                title="Editar producto"
                onClick={() => openEdit(product)}
                className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue-main)]"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                type="button"
                onClick={() => toggleProduct(product)}
                className="min-h-9 border border-[var(--line)] px-3 text-xs font-semibold"
              >
                {product.is_active ? "Deshabilitar" : "Habilitar"}
              </button>
              {section !== "sale" && section !== "started" ? (
                <button
                  type="button"
                  onClick={() => openPurchaseDialog(product)}
                  className="min-h-9 bg-[var(--blue-main)] px-3 text-xs font-semibold text-white"
                >
                  Comprar
                </button>
              ) : null}
              {section !== "sale" && <button
                type="button"
                onClick={() => openTakeDialog(product)}
                className="min-h-9 bg-[var(--blue-main)] px-3 text-xs font-semibold text-white"
              >
                Usar
              </button>}
              <button
                type="button"
                disabled={Number(product.stock) <= 0 || saving}
                onClick={() => openDamageDialog(product)}
                className="inline-flex min-h-9 items-center gap-2 border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PackageX size={14} /> Reportar daño
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => restockProduct(product)}
                className="min-h-9 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Restablecer (+{product.unit === "UNIT" ? wholeNumber(product.restock_quantity) : product.restock_quantity})
              </button>
              <button
                type="button"
                onClick={() => deleteProduct(product)}
                className="min-h-9 border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      {purchaseTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
          <form onSubmit={purchaseProduct} className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">Compra de inventario</p>
                <h2 className="mt-1 text-lg font-semibold">Comprar {purchaseTarget.name}</h2>
              </div>
              <button type="button" onClick={() => setPurchaseTarget(null)} aria-label="Cerrar compra">
                <X size={19} />
              </button>
            </div>

            <label className="mt-5 block text-sm font-semibold">
              Cantidad
              <input
                required
                min="1"
                  step={purchaseTarget?.unit === "UNIT" ? "1" : "0.001"}
                type="number"
                value={purchaseQuantity}
                onChange={(event) => setPurchaseQuantity(normalizeQuantityInput(event.target.value, purchaseTarget?.unit ?? "UNIT"))}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Costo unitario
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={purchaseCost}
                onChange={(event) => setPurchaseCost(event.target.value)}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Método de pago
              <select
                value={purchaseMethod}
                onChange={(event) => setPurchaseMethod(event.target.value as "CASH" | "NEQUI")}
                className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 font-normal"
              >
                <option value="CASH">Efectivo</option>
                <option value="NEQUI">Nequi</option>
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Observación
              <textarea
                value={purchaseObservation}
                onChange={(event) => setPurchaseObservation(event.target.value)}
                rows={3}
                className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPurchaseTarget(null)} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">
                Cancelar
              </button>
              <button disabled={saving} className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Guardando..." : "Registrar compra"}
              </button>
            </div>
          </form>
        </div>
      )}

      {damageTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
          <form onSubmit={reportDamage} className="w-full max-w-md border border-red-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Pérdida de inventario</p>
                <h2 className="mt-1 text-lg font-semibold">Reportar daño: {damageTarget.name}</h2>
              </div>
              <button type="button" onClick={() => setDamageTarget(null)} aria-label="Cerrar reporte de daño">
                <X size={19} />
              </button>
            </div>

            <label className="mt-5 block text-sm font-semibold">
              Cantidad disponible: {formatStock(damageTarget)}
              <input required min={damageTarget.unit === "UNIT" ? "1" : "0.001"} max={Number(damageTarget.stock)} step={damageTarget.unit === "UNIT" ? "1" : "0.001"} type="number" value={damageQuantity} onChange={(event) => setDamageQuantity(normalizeQuantityInput(event.target.value, damageTarget.unit))} className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal" />
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Motivo del daño
              <textarea required minLength={2} maxLength={500} value={damageObservation} onChange={(event) => setDamageObservation(event.target.value)} rows={3} className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal" />
            </label>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Se descontará el stock y se registrará un egreso por el costo de adquisición del producto.</p>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDamageTarget(null)} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">Cancelar</button>
              <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><PackageX size={16} /> {saving ? "Registrando..." : "Registrar daño"}</button>
            </div>
          </form>
        </div>
      )}

      {takeTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--ink)]/50 p-4">
          <form onSubmit={takeProduct} className="w-full max-w-md border border-[var(--line)] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">Uso interno</p>
                <h2 className="mt-1 text-lg font-semibold">Tomar {takeTarget.name}</h2>
              </div>
              <button type="button" onClick={() => setTakeTarget(null)} aria-label="Cerrar toma">
                <X size={19} />
              </button>
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={takeAll} onChange={(event) => setTakeAll(event.target.checked)} />
              ¿Te gastaste todo el producto?
            </label>

            {!takeAll && <label className="mt-4 block text-sm font-semibold">
              Cantidad gastada ({unitLabels[takeTarget.unit ?? "UNIT"]})
              <input
                required
                min="0.001"
                max={Number(takeTarget.stock)}
                step={takeTarget.unit === "UNIT" ? "1" : "0.001"}
                type="number"
                value={takeQuantity}
                onKeyDown={takeTarget.unit === "UNIT" ? preventDecimalKeys : undefined}
                inputMode={takeTarget.unit === "UNIT" ? "numeric" : "decimal"}
                onChange={(event) => setTakeQuantity(normalizeQuantityInput(event.target.value, takeTarget.unit))}
                className="mt-2 min-h-11 w-full border border-[var(--line)] px-3 font-normal"
              />
            </label>}

            <label className="mt-4 block text-sm font-semibold">
              Observación
              <textarea
                value={takeObservation}
                onChange={(event) => setTakeObservation(event.target.value)}
                rows={3}
                className="mt-2 w-full border border-[var(--line)] px-3 py-2 font-normal"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setTakeTarget(null)} className="min-h-11 border border-[var(--line)] px-4 text-sm font-semibold">
                Cancelar
              </button>
              <button disabled={saving} className="min-h-11 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Registrando..." : "Usar producto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {disabledModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--ink)]/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="disabled-products-title" className="w-full max-w-2xl border border-[var(--line)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Administración</p>
                <h2 id="disabled-products-title" className="mt-1 text-lg font-semibold">Productos deshabilitados</h2>
              </div>
              <button type="button" onClick={() => setDisabledModalOpen(false)} aria-label="Cerrar productos deshabilitados"><X size={19} /></button>
            </div>
            {disabledLoading ? <p className="p-8 text-center text-sm text-[var(--muted)]">Cargando productos...</p> : disabledProducts.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">No hay productos deshabilitados.</p> : <div className="mt-4 divide-y divide-[var(--line)]">{disabledProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 py-4"><div><strong>{product.name}</strong><p className="mt-1 text-xs text-[var(--muted)]">Stock: {product.stock} · {product.is_saleable ? "Cafeter·a" : "Inventario interno"}</p></div><button type="button" disabled={saving} onClick={() => void enableProduct(product)} className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white disabled:opacity-60"><ArchiveRestore size={15} /> Habilitar</button></div>)}</div>}
          </section>
        </div>
      )}
    </AdminPage>
  );
}

