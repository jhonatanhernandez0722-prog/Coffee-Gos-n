"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  FileSpreadsheet,
  FileDown,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Check,
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
  Volume2,
} from "lucide-react";
import { apiUrl, userFacingError } from "@/lib/api";
import { NavDrawer } from "@/components/nav-drawer";
import { downloadExcel } from "@/lib/excel";
import { downloadPdfReport } from "@/lib/pdf";

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
/** Fecha de hoy en la zona horaria del equipo (no en UTC). */
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}
function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : new Date(value).toLocaleDateString("es-CO");
}

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
  {
    label: "Configuración",
    href: "/configuracion",
    icon: Volume2,
    permission: "configuracion",
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
  const alertsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!alertsOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) setAlertsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAlertsOpen(false); };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [alertsOpen]);
  const knownAlertIds = useRef<Set<string> | null>(null);
  const unreadEventIds = useRef(new Set<string>());
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
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
  const [selectedDate, setSelectedDate] = useState(localToday);

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
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar el resumen.")))
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
      .catch((requestError: Error) => setError(userFacingError(requestError, "No fue posible cargar el informe mensual.")));
  }, [reportMonth]);

  useEffect(() => {
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
      if (!response.ok) return;

      const result = (await response.json()) as {
        alerts: AlertItem[];
        unread_count: number;
      };
      const eventAlerts = result.alerts.filter((alert) => alert.created_at !== null);
      const currentEventIds = new Set(eventAlerts.map((alert) => alert.id));

      if (knownAlertIds.current === null) {
        knownAlertIds.current = currentEventIds;
        unreadEventIds.current.clear();
      } else {
        const newAlertIds = Array.from(currentEventIds).filter(
          (alertId) => !knownAlertIds.current?.has(alertId),
        );
        for (const alertId of newAlertIds) {
          unreadEventIds.current.add(alertId);
        }
        if (newAlertIds.length > 0) {
          window.dispatchEvent(new Event("coffee-gosen-new-alert"));
        }
        for (const alertId of Array.from(unreadEventIds.current)) {
          if (!currentEventIds.has(alertId)) unreadEventIds.current.delete(alertId);
        }
        knownAlertIds.current = currentEventIds;
      }

      setAlerts(result.alerts);
      setUnreadAlerts(unreadEventIds.current.size);
    };
    void loadAlerts();
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
    if (response.ok) {
      unreadEventIds.current.clear();
      setUnreadAlerts(0);
    }
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
  async function exportSummaryPdf() {
    if (!summary) return;
    setError("");
    try {
      await downloadPdfReport({
        title: "Resumen del día",
        subtitle: formatDate(summary.date),
        filename: `resumen-${summary.date}.pdf`,
        summary: metrics.slice(0, 4).map((metric) => [metric.label, metric.value]),
        sections: [
          {
            heading: "Indicadores",
            columns: ["Indicador", "Valor", "Detalle"],
            rows: metrics.map((metric) => [metric.label, metric.value, metric.detail]),
          },
          {
            heading: "Rentabilidad por producto del día",
            columns: ["Producto", "Unidades", "Precio venta", "Ventas", "Costo", "Ganancia"],
            rows: dailyProducts.map((product) => [product.product_name, formatUnits(Number(product.units_sold)), formatCurrency(product.unit_price), formatCurrency(product.sales_total), formatCurrency(product.cost_total), formatCurrency(product.profit_total)]),
            emptyText: "No hay ventas cobradas para calcular rentabilidad en este día.",
          },
          ...(monthlyReport ? [{
            heading: `Resumen mensual (${reportMonth})`,
            columns: ["Día", "Ingresos cobrados", "Egresos", "Ventas"],
            rows: monthlyReport.days.map((day, index) => [day, formatCurrency(monthlyReport.income_by_day[index]), formatCurrency(monthlyReport.expenses_by_day[index]), monthlyReport.sales_by_day[index]]),
          }] : []),
        ],
      });
    } catch {
      setError("No fue posible generar el PDF del resumen.");
    }
  }
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
    <main className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="chrome no-scrollbar hidden border-r p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto print:hidden">
        <Link
          href="/"
          className="mb-10 flex items-center gap-3 px-1 font-heading text-lg font-bold tracking-tight text-white"
        >
          <span className="brand-mark size-10">
            <Coffee size={18} />
          </span>
          Coffee Gosen
        </Link>
        <p className="mb-3 px-3 text-xs font-semibold opacity-70">
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
                aria-current={href === "/dashboard" ? "page" : undefined}
                className="nav-pill w-full rounded-xl"
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-[var(--chrome-line)] bg-white/5 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--blue-light)] font-heading text-sm font-bold text-[var(--chrome)]">{(userName || "S").charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {userName || "Sesión de prueba"}
          </p>
          <p className="text-xs opacity-70">
            {userName ? "Usuario autenticado" : "Sin autenticación"}
          </p>
          </div>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-[var(--line)] bg-white/75 px-4 backdrop-blur-xl sm:px-6 lg:px-10 print:static">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 lg:hidden"><span className="brand-mark size-10"><Coffee size={18} /></span></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--blue-main)] sm:text-sm">
                {summary ? <>{greeting()} · <span className="inline-block first-letter:uppercase">{new Date(`${summary.date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</span></> : "Resumen operativo"}
              </p>
              <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight sm:text-2xl">
                {userName || "Resumen operativo"}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-[var(--line)] bg-white/90 p-1 shadow-sm">
            <div ref={alertsRef} className="relative">
              <button
                type="button"
                aria-label={`Ver alertas${unreadAlerts ? ` (${unreadAlerts} sin leer)` : ""}`}
                aria-expanded={alertsOpen}
                onClick={() => void openAlerts()}
                className={`relative grid size-10 place-items-center transition ${alertsOpen ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}
              >
                <Bell size={19} className={unreadAlerts > 0 ? "bell-ring" : ""} />
                {unreadAlerts > 0 && (
                  <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="pop absolute -right-24 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl sm:right-0">
                  <div className="screen !rounded-none flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Bell size={16} />
                      <strong className="text-sm">Alertas</strong>
                      {alerts.length > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{alerts.length}</span>}
                    </div>
                    <span className="screen-label text-xs">Últimas 24 horas</span>
                  </div>
                  <div className="max-h-[26rem] overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="grid place-items-center gap-2 px-6 py-10 text-center">
                        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Check size={22} /></span>
                        <p className="text-sm font-semibold">Todo en orden</p>
                        <p className="text-xs text-[var(--muted)]">No hay alertas nuevas por ahora.</p>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <Link
                          key={alert.id}
                          href={alert.href ?? "#"}
                          onClick={() => setAlertsOpen(false)}
                          className="flex gap-3 border-b border-[var(--line)] px-4 py-3.5 transition-colors last:border-0 hover:bg-[var(--canvas)]"
                        >
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${alert.kind === "LOW_STOCK" ? "bg-amber-50 text-amber-600" : "bg-[var(--blue-light)] text-[var(--blue-main)]"}`}>
                            {alert.kind === "LOW_STOCK" ? <TriangleAlert size={17} /> : <ShoppingBag size={17} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <strong className="text-sm leading-5">{alert.title}</strong>
                              {alert.created_at && <span className="shrink-0 text-[11px] text-[var(--muted)]">{timeAgo(alert.created_at)}</span>}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{alert.detail}</span>
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="lg:hidden">
              <button
                type="button"
                aria-label="Abrir menú de navegación"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="flex h-10 items-center gap-2 px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
              >
                <Menu size={18} />
                <span className="hidden sm:inline">Menú</span>
              </button>
            </span>
            <NavDrawer
              items={navigation.filter(({ adminOnly, permission }) => isAdmin || permission === "configuracion" || (!adminOnly && currentUser?.permissions?.includes(permission)))}
              activeHref="/dashboard"
              open={menuOpen}
              onClose={closeMenu}
            />

            <span className="mx-0.5 h-6 w-px bg-[var(--line)]" aria-hidden="true" />
            <Link
              href="/"
              aria-label="Cerrar sesión"
              onClick={() => { sessionStorage.removeItem("coffee_gosen_access_token"); sessionStorage.removeItem("coffee_gosen_user"); window.dispatchEvent(new Event("coffee-gosen-auth")); }}
              className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">Salir</span>
            </Link>
          </div>
        </header>
        <div className="p-6 lg:p-10">
          {isLoading && (
            <div className="flex items-center gap-3 border border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">
              <span className="brand-mark size-9 animate-pulse"><Coffee size={16} /></span>
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
              <section className="mb-8 flex flex-col gap-6 border border-[var(--line)] bg-white p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4">
                  <span className="brand-mark hidden size-14 shrink-0 rounded-2xl sm:grid"><CalendarDays size={24} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--blue-main)] first-letter:uppercase">
                        {new Date(`${summary.date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${selectedDate === localToday() ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                        {selectedDate === localToday() ? "Hoy" : "Día anterior"}
                      </span>
                    </div>
                    <h2 className="page-title mt-1 !text-4xl sm:!text-5xl">Resumen del día</h2>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center print:hidden">
                  <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-1">
                    <button type="button" aria-label="Día anterior" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="grid size-10 place-items-center text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)]">
                      <ChevronLeft size={18} />
                    </button>
                    <label className="relative">
                      <span className="sr-only">Seleccionar día</span>
                      <input
                        type="date"
                        value={selectedDate}
                        max={localToday()}
                        onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
                        className="h-10 min-w-0 !border-0 !bg-white px-3 text-sm font-semibold !shadow-sm"
                      />
                    </label>
                    <button type="button" aria-label="Día siguiente" disabled={selectedDate >= localToday()} onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="grid size-10 place-items-center text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent">
                      <ChevronRight size={18} />
                    </button>
                    {selectedDate !== localToday() && (
                      <button type="button" onClick={() => setSelectedDate(localToday())} className="h-10 px-3 text-sm font-semibold text-[var(--blue-main)] transition hover:bg-white">
                        Hoy
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-white p-1 shadow-sm">
                    <span className="hidden px-2 text-xs font-semibold text-[var(--muted)] sm:inline">Exportar</span>
                    <button
                      type="button"
                      onClick={() => void exportSummaryPdf()}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white"
                    >
                      <FileDown size={17} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={exportSummary}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <FileSpreadsheet size={17} /> Excel
                    </button>
                  </div>
                </div>
              </section>
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
                            <td className="p-3">{formatUnits(Number(product.units_sold))}</td>
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
                                <td className="p-3">{formatUnits(Number(product.units_sold))}</td>
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
