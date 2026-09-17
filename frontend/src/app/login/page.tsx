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
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.8fr_1.2fr]">
      <section className="shell-grid hidden bg-[var(--blue-main)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3 font-semibold"><span className="grid size-10 place-items-center bg-white text-[var(--blue-main)]"><Coffee size={20} /></span> Coffee Gosen</Link>
        <div className="max-w-md"><p className="mb-5 text-sm font-semibold text-[var(--blue-light)]">Centro de operación</p><h1 className="text-5xl font-semibold leading-none tracking-[-0.05em]">Vende con calma. Decide con datos.</h1><p className="mt-6 leading-7 text-[var(--blue-light)]">Tu equipo tiene el ritmo. Coffee Gosen se encarga de que cada movimiento quede en su sitio.</p></div>
        <p className="text-sm text-[var(--blue-light)]">Sistema privado · Coffee Gosen</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--blue-main)]"><ArrowLeft size={16} /> Volver al inicio</Link>
          <div className="mb-10"><div className="mb-5 grid size-12 place-items-center bg-[var(--blue-light)] text-[var(--blue-main)]"><LockKeyhole size={21} /></div><h2 className="text-3xl font-semibold tracking-tight">Bienvenido de vuelta</h2><p className="mt-2 text-[var(--muted)]">Ingresa para continuar con la operación.</p></div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-semibold">Correo electrónico<input name="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="equipo@coffeegosen.com" className="mt-2 block min-h-12 w-full border border-[var(--line)] px-4 text-base outline-none transition focus:border-[var(--blue-main)] focus:ring-4 focus:ring-[var(--blue-light)]" /></label>
            <label className="block text-sm font-semibold">Contraseña o PIN<input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={4} placeholder="••••••••" className="mt-2 block min-h-12 w-full border border-[var(--line)] px-4 text-base outline-none transition focus:border-[var(--blue-main)] focus:ring-4 focus:ring-[var(--blue-light)]" /></label>
            {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="min-h-12 w-full bg-[var(--blue-main)] px-5 font-semibold text-white transition hover:bg-[var(--ink)] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Comprobando..." : "Iniciar sesión"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
