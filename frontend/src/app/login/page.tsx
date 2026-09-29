"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coffee, LockKeyhole } from "lucide-react";
import { apiUrl } from "@/lib/api";

const sectionRoutes: Record<string, string> = { dashboard: "/dashboard", comanda: "/comanda", productos: "/productos", clientes: "/clientes", creditos: "/creditos", movimientos: "/movimientos", egresos: "/egresos", ingresos: "/ingresar", donaciones: "/donaciones", metricas: "/metricas", arqueo: "/arqueo", balance: "/balance", temas: "/temas" };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail ?? "No fue posible iniciar sesión.");
      }
      sessionStorage.setItem("coffee_gosen_access_token", result.access_token);
      sessionStorage.setItem("coffee_gosen_user", JSON.stringify(result.user));
      window.dispatchEvent(new Event("coffee-gosen-auth"));
      const firstRoute = result.user.role === "ADMIN" ? "/dashboard" : sectionRoutes[result.user.permissions?.[0]] ?? "/login";
      router.push(firstRoute);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No fue posible iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="chrome relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-1/3 size-[34rem] rounded-full border border-[var(--chrome-line)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-[calc(33%+5rem)] size-[24rem] rounded-full border border-dashed border-[var(--chrome-line)]" />
        <Link href="/" className="relative flex items-center gap-3 font-heading text-lg font-bold text-white"><span className="brand-mark size-11"><Coffee size={20} /></span> Coffee Gosen</Link>
        <div className="relative max-w-lg">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--chrome-line)] px-3 py-1.5 text-sm font-semibold"><span className="pulse-dot size-2 rounded-full bg-emerald-300" />Centro de operación</p>
          <h1 className="font-heading text-6xl font-bold leading-[0.95] tracking-[-0.05em] text-white xl:text-7xl">Vende con calma. Decide con datos.</h1>
          <p className="mt-8 max-w-md text-lg leading-8">Tu equipo tiene el ritmo. Coffee Gosen se encarga de que cada movimiento quede en su sitio.</p>
        </div>
        <p className="relative text-sm">Sistema privado · Coffee Gosen</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="reveal w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--blue-main)]"><ArrowLeft size={16} /> Volver al inicio</Link>
          <div className="rounded-[28px] border border-[var(--line)] bg-white/85 p-7 shadow-[0_30px_80px_-40px_var(--glow)] backdrop-blur sm:p-9">
            <div className="mb-8"><div className="brand-mark mb-6 size-12"><LockKeyhole size={21} /></div><h2 className="text-3xl font-bold tracking-tight">Bienvenido de vuelta</h2><p className="mt-2 text-[var(--muted)]">Ingresa para continuar con la operación.</p></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block text-sm font-semibold">Correo electrónico<input name="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="equipo@coffeegosen.com" className="mt-2 block min-h-12 w-full border border-[var(--line)] px-4 text-base" /></label>
              <label className="block text-sm font-semibold">Contraseña o PIN<input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={4} placeholder="••••••••" className="mt-2 block min-h-12 w-full border border-[var(--line)] px-4 text-base" /></label>
              {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={isSubmitting} className="min-h-12 w-full bg-[var(--blue-main)] px-5 font-semibold text-white transition hover:bg-[var(--blue-secondary)] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Comprobando..." : "Iniciar sesión"}</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
