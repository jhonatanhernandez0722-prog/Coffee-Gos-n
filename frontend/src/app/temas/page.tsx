"use client";

import { Check, Palette } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { themes, useTheme } from "@/components/theme-provider";

export default function ThemesPage() {
  const { theme, setTheme } = useTheme();
  return <AdminPage title="Temas" description="Personaliza los colores de tu cuenta. El cambio solo se guarda para tu usuario en este navegador.">
    <section className="border border-[var(--line)] bg-white p-6"><div className="flex items-center gap-3 border-b border-[var(--line)] pb-5"><span className="grid size-11 place-items-center bg-[var(--blue-light)] text-[var(--blue-main)]"><Palette size={22} /></span><div><h2 className="font-semibold">Elige tu ambiente</h2><p className="mt-1 text-sm text-[var(--muted)]">Los temas no cambian datos ni afectan a otras cuentas.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{themes.map((item) => <button key={item.name} type="button" onClick={() => setTheme(item.name)} className={`relative overflow-hidden border-2 p-4 text-left transition hover:-translate-y-0.5 ${theme === item.name ? "border-[var(--blue-main)]" : "border-[var(--line)]"}`}><div className="flex h-24 gap-2 p-3" style={{ backgroundColor: item.colors["--canvas"] }}><span className="h-full w-1/4" style={{ backgroundColor: item.colors["--blue-main"] }} /><span className="flex-1 space-y-2"><i className="block h-3 w-3/4" style={{ backgroundColor: item.colors["--ink"] }} /><i className="block h-7 w-full" style={{ backgroundColor: item.colors["--blue-light"] }} /><i className="block h-3 w-1/2" style={{ backgroundColor: item.colors["--blue-secondary"] }} /></span></div><div className="mt-4 flex items-center justify-between"><span className="font-semibold">{item.label}</span>{theme === item.name && <span className="grid size-7 place-items-center bg-[var(--blue-main)] text-white" aria-label="Tema seleccionado"><Check size={16} /></span>}</div></button>)}</div></section>
  </AdminPage>;
}