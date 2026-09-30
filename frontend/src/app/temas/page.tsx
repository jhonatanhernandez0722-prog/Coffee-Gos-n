"use client";

import { Check, Palette } from "lucide-react";
import { AdminPage } from "@/components/admin-page";
import { themes, useTheme } from "@/components/theme-provider";

export default function ThemesPage() {
  const { theme, setTheme } = useTheme();
  const activeTheme = themes.find((item) => item.name === theme) ?? themes[0];
  return <AdminPage title="Temas" description="Personaliza los colores de tu cuenta. El cambio solo se guarda para tu usuario en este navegador.">
    <section className="screen mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/10"><Palette size={22} /></span>
        <div><p className="screen-label text-sm">Tema activo</p><p className="screen-amount mt-1 text-3xl">{activeTheme.label}</p></div>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">{["--blue-main", "--blue-secondary", "--blue-light", "--canvas"].map((token) => <span key={token} className="size-8 rounded-full border-2 border-white/30" style={{ backgroundColor: activeTheme.colors[token] }} />)}</div>
    </section>
    <section className="border border-[var(--line)] bg-white p-5 sm:p-6">
      <div><h2 className="text-lg font-bold">Elige tu ambiente</h2><p className="mt-1 text-sm text-[var(--muted)]">Los temas no cambian datos ni afectan a otras cuentas.</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((item) => {
          const selected = theme === item.name;
          const chrome = `color-mix(in oklab, ${item.colors["--ink"]} 86%, #000)`;
          return <button key={item.name} type="button" aria-pressed={selected} onClick={() => setTheme(item.name)} className={`group relative overflow-hidden !rounded-2xl border-2 bg-white p-2 text-left transition hover:-translate-y-0.5 ${selected ? "border-[var(--blue-main)] shadow-[0_14px_30px_-16px_var(--glow)]" : "border-[var(--line)] hover:border-[var(--blue-main)]"}`}>
            <div className="overflow-hidden rounded-xl border border-black/5" style={{ backgroundColor: item.colors["--canvas"] }} aria-hidden="true">
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: chrome }}>
                <span className="size-4 rounded-md" style={{ backgroundColor: item.colors["--blue-main"] }} />
                <span className="h-1.5 w-12 rounded-full bg-white/70" />
                <span className="ml-auto h-3 w-8 rounded-full" style={{ backgroundColor: item.colors["--blue-light"] }} />
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                <span className="col-span-3 h-2 w-2/3 rounded-full" style={{ backgroundColor: item.colors["--ink"] }} />
                <span className="h-10 rounded-lg" style={{ background: `linear-gradient(150deg, color-mix(in oklab, ${item.colors["--ink"]} 72%, #000), ${chrome})` }} />
                <span className="h-10 rounded-lg border bg-white" style={{ borderColor: item.colors["--line"] }} />
                <span className="h-10 rounded-lg border bg-white" style={{ borderColor: item.colors["--line"] }} />
                <span className="col-span-3 h-6 rounded-lg" style={{ backgroundColor: item.colors["--blue-main"] }} />
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pb-1 pt-3">
              <span className="flex items-center gap-2 font-semibold"><span className="size-3 rounded-full" style={{ backgroundColor: item.colors["--blue-main"] }} />{item.label}</span>
              {selected ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--blue-main)] px-2.5 py-1 text-xs font-semibold text-white"><Check size={13} /> Activo</span> : <span className="text-xs font-semibold text-[var(--muted)] opacity-0 transition group-hover:opacity-100">Usar</span>}
            </div>
          </button>;
        })}
      </div>
    </section>
  </AdminPage>;
}
