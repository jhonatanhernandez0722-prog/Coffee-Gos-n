"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, ChevronDown, CircleDollarSign, Coffee, CreditCard, HandCoins, LayoutDashboard, Package, Palette, QrCode, ReceiptText, Scale, ShoppingBag, UserRound, Users, Volume2, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiUrl } from "@/lib/api";

type RouteItem = { key: string; label: string; href: string; icon: LucideIcon };
const accessByRoute: Record<string, RouteItem> = {
  "/dashboard": { key: "dashboard", label: "Resumen", href: "/dashboard", icon: LayoutDashboard },
  "/comanda": { key: "comanda", label: "Ventas", href: "/comanda", icon: ShoppingBag },
  "/productos": { key: "productos", label: "Productos", href: "/productos", icon: Package },
  "/clientes": { key: "clientes", label: "Clientes", href: "/clientes", icon: Users },
  "/creditos": { key: "creditos", label: "Créditos", href: "/creditos", icon: CreditCard },
  "/movimientos": { key: "movimientos", label: "Movimientos", href: "/movimientos", icon: ReceiptText },
  "/vendedores": { key: "admin", label: "Vendedores", href: "/vendedores", icon: UserRound },
  "/egresos": { key: "egresos", label: "Egresos y costo", href: "/egresos", icon: ReceiptText },
  "/ingresar": { key: "ingresos", label: "Ingresar", href: "/ingresar", icon: CircleDollarSign },
  "/donaciones": { key: "donaciones", label: "Donaciones", href: "/donaciones", icon: HandCoins },
  "/qr-pago": { key: "qr_pago", label: "QR de pago", href: "/qr-pago", icon: QrCode },
  "/metricas": { key: "metricas", label: "Métricas", href: "/metricas", icon: BarChart3 },
  "/arqueo": { key: "arqueo", label: "Arqueo de Caja", href: "/arqueo", icon: WalletCards },
  "/balance": { key: "balance", label: "Balance General", href: "/balance", icon: Scale },
  "/temas": { key: "temas", label: "Temas", href: "/temas", icon: Palette },
  "/configuracion": { key: "configuracion", label: "Configuración", href: "/configuracion", icon: Volume2 },
};
const navigation = Object.values(accessByRoute);

export function AdminPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [homeRoute, setHomeRoute] = useState("/dashboard");
  const [currentUser, setCurrentUser] = useState<{ role?: string; permissions?: string[] } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdminUser = currentUser?.role === "ADMIN";
  const visibleNavigation = navigation.filter((item) => {
    if (!currentUser || isAdminUser) return true;
    if (item.key === "admin") return currentUser.role === "VIEWER";
    if (item.key === "configuracion") return true;
    return (currentUser.permissions ?? []).includes(item.key);
  });

  useEffect(() => {
    const loadCurrentUser = async () => {
      const routeAccess = accessByRoute[pathname];
      const storedUser = sessionStorage.getItem("coffee_gosen_user");

      if (!storedUser || !routeAccess) {
        setAccessChecked(true);
        return;
      }

      let user = JSON.parse(storedUser) as { role?: string; permissions?: string[] };
      setCurrentUser(user);
      const token = sessionStorage.getItem("coffee_gosen_access_token");

      if (!token) {
        setAccessChecked(true);
        router.replace("/login");
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        window.clearTimeout(timeoutId);

        if (response.status === 401) {
          sessionStorage.removeItem("coffee_gosen_access_token");
          sessionStorage.removeItem("coffee_gosen_user");
          setAccessChecked(true);
          router.replace("/login");
          return;
        }

        if (response.ok) {
          user = await response.json() as { role?: string; permissions?: string[] };
          setCurrentUser(user);
          sessionStorage.setItem("coffee_gosen_user", JSON.stringify(user));
        }
      } catch {
        setAccessChecked(true);
        return;
      }

      if (user.role === "ADMIN") {
        setAccessChecked(true);
        return;
      }

      const permissions = user.permissions ?? [];
      const firstPermission = ["dashboard", "comanda", "productos", "clientes", "creditos", "movimientos", "egresos", "ingresos", "donaciones", "qr_pago", "metricas", "arqueo", "balance", "temas", "configuracion"].find((permission) => permissions.includes(permission));
      const routes: Record<string, string> = { dashboard: "/dashboard", comanda: "/comanda", productos: "/productos", clientes: "/clientes", creditos: "/creditos", movimientos: "/movimientos", egresos: "/egresos", ingresos: "/ingresar", donaciones: "/donaciones", qr_pago: "/qr-pago", metricas: "/metricas", arqueo: "/arqueo", balance: "/balance", temas: "/temas", configuracion: "/configuracion" };

      if (firstPermission) setHomeRoute(routes[firstPermission] ?? "/dashboard");
      if ((routeAccess.key === "admin" && user.role !== "VIEWER") || (routeAccess.key !== "admin" && routeAccess.key !== "configuracion" && !permissions.includes(routeAccess.key))) {
        router.replace(firstPermission ? routes[firstPermission] : "/login");
        return;
      }

      setAccessChecked(true);
    };

    void loadCurrentUser();
  }, [pathname, router]);

  const CurrentIcon = accessByRoute[pathname]?.icon ?? LayoutDashboard;
  if (!accessChecked) return <main className="grid min-h-screen place-items-center text-sm text-[var(--muted)]"><span className="flex items-center gap-3"><span className="brand-mark size-9 animate-pulse"><Coffee size={17} /></span>Comprobando permisos...</span></main>;
  return (
    <main className="min-h-screen">
      <header className="chrome sticky top-0 z-30 border-b print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3 font-heading text-lg font-bold tracking-tight text-white"><span className="brand-mark size-10"><Coffee size={18} /></span>Coffee Gosen</Link>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((prev) => !prev)} aria-expanded={menuOpen} className="chrome-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                <span className="hidden sm:inline">Menú</span>
              </button>
              {menuOpen && (
                <div className="reveal absolute right-0 z-40 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--line)] bg-white p-2 text-[var(--ink)] shadow-2xl">
                  <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <strong className="text-sm text-[var(--ink)]">Navegación</strong>
                    <button type="button" onClick={() => setMenuOpen(false)} className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]">Cerrar</button>
                  </div>
                  <nav className="grid max-h-[70vh] gap-1 overflow-y-auto">
                    {visibleNavigation.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${pathname === href ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}><span className={`grid size-8 place-items-center rounded-lg ${pathname === href ? "bg-[var(--blue-main)] text-white" : "bg-[var(--canvas)] text-[var(--blue-main)]"}`}><Icon size={15} /></span>{label}</Link>
                    ))}
                  </nav>
                </div>
              )}
            </div>
            <Link href={homeRoute} className="chrome-btn"><ArrowLeft size={16} /> Volver</Link>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:flex lg:px-8" aria-label="Secciones">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="nav-pill">
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <details className="group border-b border-[var(--line)] bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:hidden print:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--blue-main)] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3"><span className="brand-mark size-9"><CurrentIcon size={16} /></span>{accessByRoute[pathname]?.label ?? "Ir a sección"}</span>
          <ChevronDown aria-hidden="true" size={19} className="text-[var(--muted)] transition-transform group-open:rotate-180" />
        </summary>
        <nav className="mt-2 grid gap-1 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-2 sm:grid-cols-2" aria-label="Navegación de secciones">
          {visibleNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === href ? "bg-[var(--blue-light)] text-[var(--blue-main)]" : "text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"}`}><Icon size={17} />{label}</Link>)}
        </nav>
      </details>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="reveal flex items-start gap-5">
          <span className="brand-mark hidden size-14 shrink-0 rounded-2xl sm:grid"><CurrentIcon size={24} /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--blue-main)]">Operación</p>
            <h1 className="page-title mt-2">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{description}</p>
            <div className="page-title-rule mt-6" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-10">{children}</div>
      </section>
    </main>
  );
}
