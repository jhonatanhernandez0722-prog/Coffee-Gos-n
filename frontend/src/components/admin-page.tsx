"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Coffee } from "lucide-react";

const accessByRoute: Record<string, { key: string; label: string; href: string }> = {
  "/dashboard": { key: "dashboard", label: "Resumen", href: "/dashboard" },
  "/comanda": { key: "comanda", label: "Ventas", href: "/comanda" },
  "/productos": { key: "productos", label: "Productos", href: "/productos" },
  "/clientes": { key: "clientes", label: "Clientes", href: "/clientes" },
  "/creditos": { key: "creditos", label: "Créditos", href: "/creditos" },
  "/movimientos": { key: "movimientos", label: "Movimientos", href: "/movimientos" },
  "/vendedores": { key: "admin", label: "Vendedores", href: "/vendedores" },
  "/egresos": { key: "egresos", label: "Egresos y costo", href: "/egresos" },
  "/ingresar": { key: "ingresos", label: "Ingresar", href: "/ingresar" },
  "/donaciones": { key: "donaciones", label: "Donaciones", href: "/donaciones" },
  "/qr-pago": { key: "qr_pago", label: "QR de pago", href: "/qr-pago" },
  "/metricas": { key: "metricas", label: "Métricas", href: "/metricas" },
  "/arqueo": { key: "arqueo", label: "Arqueo de Caja", href: "/arqueo" },
  "/balance": { key: "balance", label: "Balance General", href: "/balance" },
  "/temas": { key: "temas", label: "Temas", href: "/temas" },
};
const navigation = Object.values(accessByRoute).filter((item) => item.key !== "admin");

export function AdminPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [homeRoute, setHomeRoute] = useState("/dashboard");
  const [currentUser, setCurrentUser] = useState<{ role?: string; permissions?: string[] } | null>(null);

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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://backend-lemon-five-80.vercel.app/api/v1" : "http://localhost:8001/api/v1")}/auth/me`, {
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
      const firstPermission = ["dashboard", "comanda", "productos", "clientes", "creditos", "movimientos", "egresos", "ingresos", "donaciones", "qr_pago", "metricas", "arqueo", "balance", "temas"].find((permission) => permissions.includes(permission));
      const routes: Record<string, string> = { dashboard: "/dashboard", comanda: "/comanda", productos: "/productos", clientes: "/clientes", creditos: "/creditos", movimientos: "/movimientos", egresos: "/egresos", ingresos: "/ingresar", donaciones: "/donaciones", qr_pago: "/qr-pago", metricas: "/metricas", arqueo: "/arqueo", balance: "/balance", temas: "/temas" };

      if (firstPermission) setHomeRoute(routes[firstPermission] ?? "/dashboard");
      if (routeAccess.key === "admin" || !permissions.includes(routeAccess.key)) {
        router.replace(firstPermission ? routes[firstPermission] : "/login");
        return;
      }

      setAccessChecked(true);
    };

    void loadCurrentUser();
  }, [pathname, router]);

  if (!accessChecked) return <main className="grid min-h-screen place-items-center bg-[var(--canvas)] text-sm text-[var(--muted)]">Comprobando permisos...</main>;
  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-white px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center bg-[var(--blue-main)] text-white"><Coffee size={18} /></span>Coffee Gosen</Link>
          <Link href={homeRoute} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--blue-main)]"><ArrowLeft size={16} /> Volver</Link>
        </div>
      </header>
      <div className="border-b border-[var(--line)] bg-white px-6 py-3 lg:hidden">
        <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="tablet-navigation">Ir a sección
          <select id="tablet-navigation" value={pathname} onChange={(event) => router.push(event.target.value)} className="mt-2 min-h-11 w-full border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] focus:border-[var(--blue-main)]">
            {navigation.filter((item) => currentUser?.role === "ADMIN" || currentUser?.permissions?.includes(item.key)).map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><p className="text-sm text-[var(--muted)]">Operación</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-2xl text-[var(--muted)]">{description}</p><div className="mt-8">{children}</div></section>
    </main>
  );
}
