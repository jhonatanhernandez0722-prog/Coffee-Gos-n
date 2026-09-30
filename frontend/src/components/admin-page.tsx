"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CircleDollarSign, Coffee, CreditCard, HandCoins, LayoutDashboard, LogOut, Menu, Package, Palette, QrCode, ReceiptText, Scale, ShoppingBag, UserRound, Users, Volume2, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { NavDrawer } from "@/components/nav-drawer";

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
  const [currentUser, setCurrentUser] = useState<{ role?: string; permissions?: string[]; full_name?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
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

      let user = JSON.parse(storedUser) as { role?: string; permissions?: string[]; full_name?: string };
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
          user = await response.json() as { role?: string; permissions?: string[]; full_name?: string };
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
  const userName = currentUser?.full_name ?? "";
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="chrome no-scrollbar hidden border-r p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto print:hidden">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3 px-1 font-heading text-lg font-bold tracking-tight text-white"><span className="brand-mark size-10"><Coffee size={18} /></span>Coffee Gosen</Link>
        <p className="mb-3 px-3 text-xs font-semibold opacity-70">Operación</p>
        <nav className="space-y-1" aria-label="Secciones">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="nav-pill w-full">
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-[var(--chrome-line)] bg-white/5 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--blue-light)] font-heading text-sm font-bold text-[var(--chrome)]">{(userName || "S").charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName || "Sesión de prueba"}</p>
            <p className="text-xs opacity-70">{userName ? "Usuario autenticado" : "Sin autenticación"}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="chrome sticky top-0 z-30 border-b lg:hidden print:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-3 font-heading text-lg font-bold tracking-tight text-white"><span className="brand-mark size-10"><Coffee size={18} /></span>Coffee Gosen</Link>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} className="chrome-btn">
                <Menu size={17} />
                <span className="hidden sm:inline">Menú</span>
              </button>
              <Link href={homeRoute} className="chrome-btn"><ArrowLeft size={16} /><span className="hidden sm:inline">Volver</span></Link>
            </div>
          </div>
        </header>
        <header className="sticky top-0 z-30 hidden min-h-[64px] items-center justify-between lg:flex print:hidden border-b border-[var(--line)] bg-white/75 px-10 backdrop-blur-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"><CurrentIcon size={16} className="text-[var(--blue-main)]" />{accessByRoute[pathname]?.label ?? title}</p>
            <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-white/90 p-1 shadow-sm">
              <Link href={homeRoute} className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--canvas)] hover:text-[var(--ink)]"><ArrowLeft size={16} /> Volver</Link>
              <span className="mx-0.5 h-6 w-px bg-[var(--line)]" aria-hidden="true" />
              <Link href="/" aria-label="Cerrar sesión" onClick={() => { sessionStorage.removeItem("coffee_gosen_access_token"); sessionStorage.removeItem("coffee_gosen_user"); window.dispatchEvent(new Event("coffee-gosen-auth")); }} className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-red-50 hover:text-red-700"><LogOut size={16} /> Salir</Link>
            </div>
        </header>
        <NavDrawer items={visibleNavigation} activeHref={pathname} open={menuOpen} onClose={closeMenu} />

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
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
      </div>
    </main>
  );
}
