"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, CircleDollarSign, Coffee, CreditCard, Download, LayoutDashboard, LogOut, Package, ReceiptText, ShoppingBag, TriangleAlert, UserCog, Users } from "lucide-react";

type DashboardSummary = {
  date: string;
  income_today: number;
  expenses_today: number;
  cost_today: number;
  profit_today: number;
  sales_today: number;
  products_sold_today: number;
  pending_credits: number;
  low_stock_products: number;
};
type AlertItem = { id: string; kind: "LOW_STOCK" | "SALE"; title: string; detail: string; created_at: string | null; href: string | null };
type CurrentUser = { full_name?: string; role?: string; permissions?: string[] };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";
const navigation = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { label: "Comanda", href: "/comanda", icon: ShoppingBag, permission: "comanda" },
  { label: "Productos", href: "/productos", icon: Package, permission: "productos" },
  { label: "Clientes", href: "/clientes", icon: Users, permission: "clientes" },
  { label: "Créditos", href: "/creditos", icon: CreditCard, permission: "creditos" },
  { label: "Movimientos", href: "/movimientos", icon: ReceiptText, permission: "movimientos" },
  { label: "Vendedores", href: "/vendedores", icon: UserCog, adminOnly: true, permission: "admin" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatUnits(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const userName = currentUser?.full_name ?? "";
  const isAdmin = currentUser?.role === "ADMIN";
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const storedUser = sessionStorage.getItem("coffee_gosen_user");
      if (storedUser) setCurrentUser(JSON.parse(storedUser) as CurrentUser);
    });
  }, []);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/dashboard/summary?date=${selectedDate}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "No fue posible cargar el resumen.");
        return result as DashboardSummary;
      })
      .then(setSummary)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, [selectedDate]);

  useEffect(() => {
    let isCurrent = true;
    const loadAlerts = async () => {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/dashboard/alerts`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!response.ok || !isCurrent) return;
      const result = await response.json() as { alerts: AlertItem[] };
      setAlerts(result.alerts);
    };
    void loadAlerts();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void loadAlerts(); }, 60000);
    return () => { isCurrent = false; window.clearInterval(interval); };
  }, []);

  const metrics = summary ? [
    { label: "Ingresos de hoy", value: formatCurrency(summary.income_today), detail: `Costos ${formatCurrency(summary.cost_today)}`, icon: CircleDollarSign },
    { label: "Ventas realizadas", value: String(summary.sales_today), detail: `${formatUnits(summary.products_sold_today)} productos`, icon: ShoppingBag },
    { label: "Ganancia de hoy", value: formatCurrency(summary.profit_today), detail: `Egresos ${formatCurrency(summary.expenses_today)}`, icon: Package },
    { label: "Créditos pendientes", value: formatCurrency(summary.pending_credits), detail: `${summary.low_stock_products} productos con bajo stock`, icon: CreditCard },
  ] : [];

  return (
    <main className="min-h-screen bg-[var(--canvas)] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-white p-5 lg:flex lg:flex-col">
        <Link href="/" className="mb-12 flex items-center gap-3 font-semibold tracking-tight"><span className="grid size-9 place-items-center bg-[var(--blue-main)] text-white"><Coffee size={18} /></span>Coffee Gosen</Link>
        <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">Operación</p>
        <nav className="space-y-1">{navigation.filter(({ adminOnly, permission }) => (isAdmin || (!adminOnly && currentUser?.permissions?.includes(permission)))).map(({ label, href, icon: Icon }) => <Link key={label} href={href} className={`flex min-h-11 items-center gap-3 px-3 text-sm font-semibold transition ${href === "/dashboard" ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}><Icon size={18} />{label}</Link>)}</nav>
        <div className="mt-auto border-t border-[var(--line)] pt-5"><p className="truncate text-sm font-semibold">{userName || "Sesión de prueba"}</p><p className="text-xs text-[var(--muted)]">{userName ? "Usuario autenticado" : "Sin autenticación"}</p></div>
      </aside>
      <section className="min-w-0">
        <header className="flex min-h-[72px] items-center justify-between border-b border-[var(--line)] bg-white px-6 lg:px-10"><div><p className="text-sm text-[var(--muted)]">Resumen operativo</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{userName ? `Buen día, ${userName}` : "Dashboard"}</h1></div><div className="flex items-center gap-4"><div className="relative"><button aria-label={`Ver notificaciones${alerts.length ? ` (${alerts.length})` : ""}`} onClick={() => setAlertsOpen((open) => !open)} className="relative grid size-10 place-items-center border border-[var(--line)] text-[var(--muted)] hover:text-[var(--blue-main)]"><Bell size={18} />{alerts.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center bg-[var(--blue-main)] px-1 text-[10px] font-bold text-white">{alerts.length > 9 ? "9+" : alerts.length}</span>}</button>{alertsOpen && <div className="absolute right-0 z-10 mt-2 w-[min(22rem,calc(100vw-3rem))] border border-[var(--line)] bg-white shadow-xl"><div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><strong className="text-sm">Alertas</strong><span className="text-xs text-[var(--muted)]">Últimas 24 horas</span></div><div className="max-h-96 overflow-y-auto">{alerts.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">No hay alertas nuevas.</p> : alerts.map((alert) => <Link key={alert.id} href={alert.href ?? "#"} onClick={() => setAlertsOpen(false)} className="flex gap-3 border-b border-[var(--line)] p-4 hover:bg-[var(--canvas)]"><span className={`mt-0.5 ${alert.kind === "LOW_STOCK" ? "text-amber-600" : "text-[var(--blue-main)]"}`}>{alert.kind === "LOW_STOCK" ? <TriangleAlert size={17} /> : <ShoppingBag size={17} />}</span><span className="min-w-0"><strong className="block text-sm">{alert.title}</strong><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{alert.detail}</span></span></Link>)}</div></div>}</div><Link href="/" aria-label="Cerrar sesión" className="grid size-10 place-items-center border border-[var(--line)] text-[var(--muted)] hover:text-[var(--blue-main)]"><LogOut size={17} /></Link></div></header>
        <div className="p-6 lg:p-10">
          {isLoading && <div className="border border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">Cargando datos del negocio...</div>}
          {error && <div role="alert" className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
          {!isLoading && !error && summary && <><div className="mb-8 flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-[var(--muted)]">{formatDate(summary.date)}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Resumen del día</h2></div><div className="flex flex-wrap items-center gap-3 print:hidden"><label className="text-sm font-semibold">Día<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="ml-2 min-h-10 border border-[var(--line)] px-3 font-normal" /></label><button onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"><Download size={16} /> Exportar PDF</button></div></div><div className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon }) => <article key={label} className="bg-white p-6"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted)]">{label}</p><Icon size={19} className="text-[var(--blue-main)]" /></div><p className="mt-7 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-[var(--muted)]">{detail}</p></article>)}</div><div className="mt-8 border border-[var(--line)] bg-white p-6"><div className="flex items-center justify-between"><h3 className="font-semibold">Estado operativo</h3><ArrowUpRight size={18} className="text-[var(--blue-main)]" /></div><p className="mt-3 text-sm leading-6 text-[var(--muted)]">El resumen se calcula con ventas, costos, egresos, créditos e inventario registrados en la base de datos.</p></div></>}
        </div>
      </section>
    </main>
  );
}
