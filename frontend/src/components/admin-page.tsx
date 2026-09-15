"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Coffee } from "lucide-react";

export function AdminPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const accessByRoute: Record<string, { key: string; label: string; href: string }> = {
    "/dashboard": { key: "dashboard", label: "Resumen", href: "/dashboard" },
    "/comanda": { key: "comanda", label: "Comanda", href: "/comanda" },
    "/productos": { key: "productos", label: "Productos", href: "/productos" },
    "/clientes": { key: "clientes", label: "Clientes", href: "/clientes" },
    "/creditos": { key: "creditos", label: "Créditos", href: "/creditos" },
    "/movimientos": { key: "movimientos", label: "Movimientos", href: "/movimientos" },
    "/vendedores": { key: "admin", label: "Vendedores", href: "/vendedores" },
  };
  const currentAccess = accessByRoute[pathname];
  const [homeRoute, setHomeRoute] = useState("/dashboard");

  useEffect(() => {
    Promise.resolve().then(() => {
      const storedUser = sessionStorage.getItem("coffee_gosen_user");
      if (!storedUser || !currentAccess) { setAccessChecked(true); return; }
      const user = JSON.parse(storedUser) as { role?: string; permissions?: string[] };
      if (user.role === "ADMIN") { setAccessChecked(true); return; }
      const permissions = user.permissions ?? [];
      const firstPermission = ["dashboard", "comanda", "productos", "clientes", "creditos", "movimientos"].find((permission) => permissions.includes(permission));
      if (firstPermission) setHomeRoute(`/` + firstPermission);
      if (currentAccess.key === "admin" || !permissions.includes(currentAccess.key)) {
        const routes: Record<string, string> = { dashboard: "/dashboard", comanda: "/comanda", productos: "/productos", clientes: "/clientes", creditos: "/creditos", movimientos: "/movimientos" };
        router.replace(firstPermission ? routes[firstPermission] : "/login");
        return;
      }
      setAccessChecked(true);
    });
  }, [currentAccess, router]);

  if (!accessChecked) return <main className="grid min-h-screen place-items-center bg-[var(--canvas)] text-sm text-[var(--muted)]">Comprobando permisos...</main>;
  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-white px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center bg-[var(--blue-main)] text-white"><Coffee size={18} /></span>Coffee Gosen</Link>
          <Link href={homeRoute} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--blue-main)]"><ArrowLeft size={16} /> Volver</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><p className="text-sm text-[var(--muted)]">Operación</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-2xl text-[var(--muted)]">{description}</p><div className="mt-8">{children}</div></section>
    </main>
  );
}
