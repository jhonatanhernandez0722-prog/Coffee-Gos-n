"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Download,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  QrCode,
  ReceiptText,
  Scale,
  ShoppingBag,
  TriangleAlert,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { downloadExcel } from "@/lib/excel";

type DashboardSummary = {
  date: string;
  balance_total: number;
  pending_credit_count: number;
  cash_balance: number;
  nequi_balance: number;
  income_today: number;
  donation_income_total: number;
  previous_income_total: number;
  expenses_today: number;
  cost_today: number;
  profit_today: number;
  sales_today: number;
  products_sold_today: number;
  pending_credits: number;
  low_stock_products: number;
  products: MonthlyProduct[];
};
type AlertItem = {
  id: string;
  kind: "LOW_STOCK" | "SALE";
  title: string;
  detail: string;
  created_at: string | null;
  href: string | null;
};
type CurrentUser = {
  full_name?: string;
  role?: string;
  permissions?: string[];
};
type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  href?: string;
};
type MonthlyProduct = {
  product_name: string;
  units_sold: number;
  sales_total: number;
  cost_total: number;
  profit_total: number;
  unit_price: number;
};
type MonthlyReport = {
  month: string;
  balance_total: number;
  days: string[];
  income_by_day: number[];
  expenses_by_day: number[];
  sales_by_day: number[];
  total_income: number;
  total_expenses: number;
  total_sales: number;
  products: MonthlyProduct[];
};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://backend-lemon-five-80.vercel.app/api/v1"
    : "http://localhost:8001/api/v1");
const navigation = [
  {
    label: "Resumen",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
  },
  {
    label: "Ventas",
    href: "/comanda",
    icon: ShoppingBag,
    permission: "comanda",
  },
  {
    label: "Productos",
    href: "/productos",
    icon: Package,
    permission: "productos",
  },
  { label: "Clientes", href: "/clientes", icon: Users, permission: "clientes" },
  {
    label: "Créditos",
    href: "/creditos",
    icon: CreditCard,
    permission: "creditos",
  },
  {
    label: "Movimientos",
    href: "/movimientos",
    icon: ReceiptText,
    permission: "movimientos",
  },
  {
    label: "Vendedores",
    href: "/vendedores",
    icon: UserCog,
    adminOnly: true,
    permission: "admin",
  },
  {
    label: "Egresos y costo",
    href: "/egresos",
    icon: ReceiptText,
    permission: "egresos",
  },
  {
    label: "Ingresar",
    href: "/ingresar",
    icon: CircleDollarSign,
    permission: "ingresos",
  },
  {
    label: "Donaciones",
    href: "/donaciones",
    icon: HandCoins,
    permission: "donaciones",
  },
  {
    label: "QR de pago",
    href: "/qr-pago",
    icon: QrCode,
    permission: "qr_pago",
  },
  {
    label: "Métricas",
    href: "/metricas",
    icon: BarChart3,
    permission: "metricas",
  },
  {
    label: "Arqueo de Caja",
    href: "/arqueo",
    icon: WalletCards,
    permission: "arqueo",
  },
  {
    label: "Balance General",
    href: "/balance",
    icon: Scale,
    permission: "balance",
  },
  {
    label: "Temas",
    href: "/temas",
    icon: Palette,
    permission: "temas",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUnits(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const userName = currentUser?.full_name ?? "";
  const isAdmin = currentUser?.role === "ADMIN";
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(
    null,
  );
  const [reportMonth, setReportMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  useEffect(() => {
    const loadCurrentUser = async () => {
      const storedUser = sessionStorage.getItem("coffee_gosen_user");
      if (storedUser) setCurrentUser(JSON.parse(storedUser) as CurrentUser);
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      if (!token) return;
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        sessionStorage.removeItem("coffee_gosen_access_token");
        sessionStorage.removeItem("coffee_gosen_user");
        router.replace("/login");
        return;
      }
      if (response.ok) {
        const user = (await response.json()) as CurrentUser;
        setCurrentUser(user);
        sessionStorage.setItem("coffee_gosen_user", JSON.stringify(user));
      }
    };
    void loadCurrentUser();
  }, [router]);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/dashboard/summary?date=${selectedDate}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          sessionStorage.removeItem("coffee_gosen_access_token");
          sessionStorage.removeItem("coffee_gosen_user");
          router.replace("/login");
        }
        if (!response.ok)
          throw new Error(result.detail ?? "No fue posible cargar el resumen.");
        return result as DashboardSummary;
      })
      .then(setSummary)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, [router, selectedDate]);

  useEffect(() => {
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    fetch(`${apiUrl}/dashboard/monthly-report?month=${reportMonth}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.detail ?? "No fue posible cargar el reporte mensual.",
          );
        return result as MonthlyReport;
      })
      .then(setMonthlyReport)
      .catch((requestError: Error) => setError(requestError.message));
  }, [reportMonth]);

  useEffect(() => {
    let isCurrent = true;
    const loadAlerts = async () => {
      const token = sessionStorage.getItem("coffee_gosen_access_token");
      const response = await fetch(`${apiUrl}/dashboard/alerts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.status === 401) {
        sessionStorage.removeItem("coffee_gosen_access_token");
        sessionStorage.removeItem("coffee_gosen_user");
        router.replace("/login");
        return;
      }
      if (!response.ok || !isCurrent) return;
      const result = (await response.json()) as {
        alerts: AlertItem[];
        unread_count: number;
      };
      setAlerts(result.alerts);
      setUnreadAlerts(result.unread_count);
    };
    void loadAlerts();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAlerts();
    }, 60000);
    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [router]);

  async function openAlerts() {
    const willOpen = !alertsOpen;
    setAlertsOpen(willOpen);
    if (!willOpen || alerts.length === 0) return;
    const token = sessionStorage.getItem("coffee_gosen_access_token");
    const response = await fetch(`${apiUrl}/dashboard/alerts/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ alert_ids: alerts.map((alert) => alert.id) }),
    });
    if (response.ok) setUnreadAlerts(0);
  }

  const balanceMetric: DashboardMetric | null = summary
    ? {
        label: "Saldo total",
        value: formatCurrency(summary.balance_total),
        detail: "Ingresos acumulados menos egresos",
        icon: CircleDollarSign,
      }
    : null;
  const dailyMetrics: DashboardMetric[] = summary
    ? [
        {
          label: "Ingresos de hoy",
          value: formatCurrency(summary.income_today),
          detail: `Costos ${formatCurrency(summary.cost_today)}`,
          icon: CircleDollarSign,
        },
        {
          label: "Ventas realizadas",
          value: String(summary.sales_today),
          detail: `${formatUnits(summary.products_sold_today)} productos`,
          icon: ShoppingBag,
        },
        {
          label: "Ganancia de hoy",
          value: formatCurrency(summary.profit_today),
          detail: `Egresos ${formatCurrency(summary.expenses_today)}`,
          icon: Package,
        },
        {
          label: "Donaciones digitadas",
          value: formatCurrency(summary.donation_income_total),
          detail: "Ingresos registrados, no ventas de hoy",
          icon: HandCoins,
          href: "/donaciones",
        },
        {
          label: "Ingresos anteriores",
          value: formatCurrency(summary.previous_income_total),
          detail: "Ingresos históricos digitados",
          icon: WalletCards,
          href: "/ingresar",
        },
      ]
    : [];
  const operatingMetrics: DashboardMetric[] = summary
    ? [
        {
          label: "Créditos pendientes",
          value: String(summary.pending_credit_count),
          detail: `Por cobrar ${formatCurrency(summary.pending_credits)}`,
          icon: CreditCard,
          href: "/creditos",
        },
        {
          label: "Saldo efectivo",
          value: formatCurrency(summary.cash_balance),
          detail: "Disponible acumulado",
          icon: CircleDollarSign,
        },
        {
          label: "Saldo Nequi",
          value: formatCurrency(summary.nequi_balance),
          detail: "Disponible acumulado",
          icon: CircleDollarSign,
        },
      ]
    : [];
  const metrics = balanceMetric
    ? [balanceMetric, ...dailyMetrics, ...operatingMetrics]
    : [];
  const dailyProducts = summary?.products ?? [];
  function exportSummary() {
    if (!summary) return;
    downloadExcel(
      [
        {
          Fecha: summary.date,
          "Saldo total": summary.balance_total,
          "Ingresos de hoy": summary.income_today,
          "Donaciones digitadas": summary.donation_income_total,
          "Ingresos anteriores": summary.previous_income_total,
          "Egresos de hoy": summary.expenses_today,
          Costos: summary.cost_today,
          Ganancia: summary.profit_today,
          Ventas: summary.sales_today,
          "Productos vendidos": summary.products_sold_today,
          "Cantidad de créditos pendientes": summary.pending_credit_count,
          "Saldo de créditos pendientes": summary.pending_credits,
          "Productos bajo stock": summary.low_stock_products,
        },
      ],
      "resumen-dashboard.xlsx",
      "Resumen",
    );
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <Link
          href="/"
          className="mb-12 flex items-center gap-3 font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center bg-[var(--blue-main)] text-white">
            <Coffee size={18} />
          </span>
          Coffee Gosen
        </Link>
        <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">
          Operación
        </p>
        <nav className="space-y-1">
          {navigation
            .filter(
              ({ adminOnly, permission }) =>
                isAdmin ||
                (!adminOnly && currentUser?.permissions?.includes(permission)),
            )
            .map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex min-h-11 items-center gap-3 px-3 text-sm font-semibold transition ${href === "/dashboard" ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
        </nav>
        <div className="mt-auto border-t border-[var(--line)] pt-5">
          <p className="truncate text-sm font-semibold">
            {userName || "Sesión de prueba"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {userName ? "Usuario autenticado" : "Sin autenticación"}
          </p>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="flex min-h-[72px] items-center justify-between border-b border-[var(--line)] bg-white px-6 lg:px-10">
          <div>
            <p className="text-sm text-[var(--muted)]">Resumen operativo</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {userName ? `Buen día, ${userName}` : "Dashboard"}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                aria-label={`Ver notificaciones${unreadAlerts ? ` (${unreadAlerts})` : ""}`}
                onClick={() => void openAlerts()}
                className="relative grid size-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] shadow-sm transition hover:border-[var(--blue-main)] hover:text-[var(--blue-main)]"
              >
                <Bell size={18} />
                {unreadAlerts > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--blue-main)] px-1 text-[10px] font-bold text-white">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="fixed left-1/2 top-24 z-50 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 border border-[var(--line)] bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                    <strong className="text-sm">Alertas</strong>
                    <span className="text-xs text-[var(--muted)]">
                      Últimas 24 horas
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="p-5 text-sm text-[var(--muted)]">
                        No hay alertas nuevas.
                      </p>
                    ) : (
                      alerts.map((alert) => (
                        <Link
                          key={alert.id}
                          href={alert.href ?? "#"}
                          onClick={() => setAlertsOpen(false)}
                          className="flex gap-3 border-b border-[var(--line)] p-4 hover:bg-[var(--canvas)]"
                        >
                          <span
                            className={`mt-0.5 ${alert.kind === "LOW_STOCK" ? "text-amber-600" : "text-[var(--blue-main)]"}`}
                          >
                            {alert.kind === "LOW_STOCK" ? (
                              <TriangleAlert size={17} />
                            ) : (
                              <ShoppingBag size={17} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <strong className="block text-sm">
                              {alert.title}
                            </strong>
                            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                              {alert.detail}
                            </span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative lg:hidden">
              <button
                aria-label="Abrir menú de navegación"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center justify-center rounded-xl border border-[var(--line)] bg-white p-2 text-[var(--ink)] shadow-sm transition hover:border-[var(--blue-main)] hover:text-[var(--blue-main)]"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-[var(--blue-light)] text-[var(--blue-main)]">
                  <Menu size={16} />
                </span>
              </button>

              {menuOpen && (
                <div className="fixed left-1/2 top-24 z-50 w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <strong className="text-sm text-[var(--ink)]">Navegación</strong>
                    <button type="button" onClick={() => setMenuOpen(false)} className="text-xs text-[var(--muted)]">Cerrar</button>
                  </div>
                  <nav className="grid gap-1">
                    {navigation
                      .filter(({ adminOnly, permission }) => isAdmin || (!adminOnly && currentUser?.permissions?.includes(permission)))
                      .map(({ label, href, icon: Icon }) => (
                        <Link
                          key={label}
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-semibold ${href === "/dashboard" ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}
                        >
                          <span className="grid size-6 place-items-center rounded-md bg-[var(--blue-light)] text-[var(--blue-main)]">
                            <Icon size={12} />
                          </span>
                          <span className="truncate">{label}</span>
                        </Link>
                      ))}
                  </nav>
                </div>
              )}
            </div>

            <Link
              href="/"
              aria-label="Cerrar sesión"
              className="grid size-11 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)] shadow-sm transition hover:border-[var(--blue-main)] hover:text-[var(--blue-main)]"
            >
              <LogOut size={17} />
            </Link>
          </div>
        </header>
        <div className="p-6 lg:p-10">
          {isLoading && (
            <div className="border border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">
              Cargando datos del negocio...
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="border border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {!isLoading && !error && summary && (
            <>
              <div className="mb-8 flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {formatDate(summary.date)}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                    Resumen del día
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                  <label className="text-sm font-semibold">
                    Día
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="ml-2 min-h-10 border border-[var(--line)] px-3 font-normal"
                    />
                  </label>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex min-h-10 items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"
                  >
                    <Download size={16} /> Exportar PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportSummary}
                    className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--blue-main)]"
                  >
                    <Download size={16} /> Descargar Excel
                  </button>
                </div>
              </div>
              <div className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map(({ label, value, detail, icon: Icon, href }) =>
                  href ? (
                    <Link
                      key={label}
                      href={href}
                      className="bg-white p-6 transition hover:bg-[var(--blue-light)]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--muted)]">{label}</p>
                        <Icon size={19} className="text-[var(--blue-main)]" />
                      </div>
                      <p className="mt-7 text-2xl font-semibold tracking-tight">
                        {value}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {detail}
                      </p>
                    </Link>
                  ) : (
                    <article key={label} className="bg-white p-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--muted)]">{label}</p>
                        <Icon size={19} className="text-[var(--blue-main)]" />
                      </div>
                      <p className="mt-7 text-2xl font-semibold tracking-tight">
                        {value}
                      </p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {detail}
                      </p>
                    </article>
                  ),
                )}
              </div>
              <div className="mt-8 border border-[var(--line)] bg-white p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Estado operativo</h3>
                  <ArrowUpRight size={18} className="text-[var(--blue-main)]" />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  El resumen se calcula con ventas, costos, egresos, créditos e
                  inventario registrados en la base de datos.
                </p>
              </div>
              <section className="mt-8 border border-[var(--line)] bg-white p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Periodo seleccionado</p>
                    <h2 className="mt-1 text-xl font-semibold">Rentabilidad por producto del día</h2>
                  </div>
                  <span className="text-sm text-[var(--muted)]">{dailyProducts.length} productos</span>
                </div>
                {dailyProducts.length === 0 ? (
                  <p className="mt-6 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
                    No hay ventas cobradas para calcular rentabilidad en este día.
                  </p>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                        <tr>
                          <th className="p-3 font-medium">Producto</th>
                          <th className="p-3 font-medium">Unidades</th>
                          <th className="p-3 font-medium">Precio venta</th>
                          <th className="p-3 font-medium">Ventas</th>
                          <th className="p-3 font-medium">Costo</th>
                          <th className="p-3 font-medium">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyProducts.map((product) => (
                          <tr key={product.product_name} className="border-b border-[var(--line)] last:border-0">
                            <td className="p-3 font-semibold">{product.product_name}</td>
                            <td className="p-3">{product.units_sold}</td>
                            <td className="p-3">{formatCurrency(product.unit_price)}</td>
                            <td className="p-3">{formatCurrency(product.sales_total)}</td>
                            <td className="p-3">{formatCurrency(product.cost_total)}</td>
                            <td className="p-3 font-semibold text-emerald-700">{formatCurrency(product.profit_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="mt-8 border border-[var(--line)] bg-white">
                <div className="flex flex-col gap-4 border-b border-[var(--line)] p-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm text-[var(--muted)]">
                      Reporte del mes calendario seleccionado
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      Resumen mensual
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm font-semibold">
                      Mes
                      <input
                        type="month"
                        value={reportMonth}
                        onChange={(event) => setReportMonth(event.target.value)}
                        className="ml-2 min-h-10 border border-[var(--line)] px-3 font-normal"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!monthlyReport}
                      onClick={() =>
                        monthlyReport &&
                        downloadExcel(
                          monthlyReport.days.map((day, index) => ({
                            Fecha: day,
                            "Saldo total": monthlyReport.balance_total,
                            Ingresos: monthlyReport.income_by_day[index],
                            Egresos: monthlyReport.expenses_by_day[index],
                            Ventas: monthlyReport.sales_by_day[index],
                          })),
                          `reporte-${reportMonth}.xlsx`,
                          "Reporte mensual",
                        )
                      }
                      className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] px-4 text-sm font-semibold text-[var(--blue-main)] disabled:opacity-50"
                    >
                      <Download size={16} /> Descargar reporte
                    </button>
                  </div>
                </div>
                {monthlyReport && (
                  <>
                    <div className="grid gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
                      <div className="bg-white p-5">
                        <p className="text-sm text-[var(--muted)]">
                          Saldo total arrastrado
                        </p>
                        <strong className="mt-2 block text-xl text-[var(--blue-main)]">
                          {formatCurrency(monthlyReport.balance_total)}
                        </strong>
                      </div>
                      <div className="bg-white p-5">
                        <p className="text-sm text-[var(--muted)]">
                          Ingresos cobrados
                        </p>
                        <strong className="mt-2 block text-xl text-emerald-700">
                          {formatCurrency(monthlyReport.total_income)}
                        </strong>
                      </div>
                      <div className="bg-white p-5">
                        <p className="text-sm text-[var(--muted)]">Egresos</p>
                        <strong className="mt-2 block text-xl text-red-700">
                          {formatCurrency(monthlyReport.total_expenses)}
                        </strong>
                      </div>
                      <div className="bg-white p-5">
                        <p className="text-sm text-[var(--muted)]">Ventas</p>
                        <strong className="mt-2 block text-xl">
                          {monthlyReport.total_sales}
                        </strong>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[950px] text-left text-sm">
                        <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                          <tr>
                            <th className="p-4 font-medium">Día</th>
                            <th className="p-4 font-medium">
                              Ingresos cobrados
                            </th>
                            <th className="p-4 font-medium">Egresos</th>
                            <th className="p-4 font-medium">Ventas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReport.days.map((day, index) => (
                            <tr
                              key={day}
                              className="border-b border-[var(--line)] last:border-0"
                            >
                              <td className="p-4">{day}</td>
                              <td className="p-4">
                                {formatCurrency(
                                  monthlyReport.income_by_day[index],
                                )}
                              </td>
                              <td className="p-4">
                                {formatCurrency(
                                  monthlyReport.expenses_by_day[index],
                                )}
                              </td>
                              <td className="p-4">
                                {monthlyReport.sales_by_day[index]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-[var(--line)] p-6">
                      <h3 className="font-semibold">
                        Rentabilidad por producto
                      </h3>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                            <tr>
                              <th className="p-3 font-medium">Producto</th>
                              <th className="p-3 font-medium">Unidades</th>
                              <th className="p-3 font-medium">Precio venta</th>
                              <th className="p-3 font-medium">Ventas</th>
                              <th className="p-3 font-medium">Costo</th>
                              <th className="p-3 font-medium">Ganancia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyReport.products.map((product) => (
                              <tr
                                key={product.product_name}
                                className="border-b border-[var(--line)] last:border-0"
                              >
                                <td className="p-3 font-semibold">
                                  {product.product_name}
                                </td>
                                <td className="p-3">{product.units_sold}</td>
                                <td className="p-3">
                                  {formatCurrency(product.unit_price)}
                                </td>
                                <td className="p-3">
                                  {formatCurrency(product.sales_total)}
                                </td>
                                <td className="p-3">
                                  {formatCurrency(product.cost_total)}
                                </td>
                                <td className="p-3 font-semibold text-emerald-700">
                                  {formatCurrency(product.profit_total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
