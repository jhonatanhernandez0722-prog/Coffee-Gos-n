import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BarChart3, Coffee, CreditCard, PackageCheck, ShieldCheck, ShoppingBag, WalletCards } from "lucide-react";

const facts = [
  { icon: BarChart3, value: "En un vistazo", label: "Ventas, ingresos y alertas del día" },
  { icon: PackageCheck, value: "Stock claro", label: "Cada movimiento queda trazado" },
  { icon: ShieldCheck, value: "Sin sorpresas", label: "Créditos y egresos bajo control" },
];

const orbit = [
  { icon: ShoppingBag, label: "Ventas", className: "left-[-4%] top-[14%]" },
  { icon: PackageCheck, label: "Inventario", className: "right-[-6%] top-[26%]" },
  { icon: CreditCard, label: "Créditos", className: "left-[2%] bottom-[12%]" },
  { icon: WalletCards, label: "Arqueo de caja", className: "right-[0%] bottom-[4%]" },
];

const modules = ["Comanda", "Productos", "Inventario", "Clientes", "Créditos", "Movimientos", "Egresos", "Donaciones", "QR de pago", "Métricas", "Arqueo de caja", "Balance general"];

export default function Home() {
  return (
    <main className="landing relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 font-heading text-lg font-bold tracking-tight">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--crema)] text-[var(--roast)] shadow-[0_10px_30px_-8px_rgba(233,184,114,0.6)]"><Coffee size={20} strokeWidth={2.5} /></span>
          <span>Coffee Gosen</span>
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center gap-2 shrink-0 rounded-full border border-[rgba(233,184,114,0.45)] bg-[rgba(255,246,234,0.04)] px-4 text-sm sm:px-5 font-semibold backdrop-blur transition hover:border-[var(--crema)] hover:bg-[var(--crema)] hover:text-[var(--roast)]">Entrar al sistema <ArrowUpRight size={16} /></Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-16">
        <div className="reveal">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-[rgba(233,184,114,0.3)] bg-[rgba(255,246,234,0.05)] px-4 py-2 text-sm font-semibold text-[var(--crema)]">
            <span className="pulse-dot size-2 rounded-full bg-emerald-300" />
            Coffee Gosen un lugar de provision fe y sabor
          </p>
          <h1 className="hero-word mt-8 max-w-4xl">El pulso de tu café, en orden.</h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#ecd6bd]">Una comanda ágil y una vista precisa de ventas, inventario, clientes y créditos para que el equipo atienda mejor.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="group inline-flex min-h-13 items-center gap-2 rounded-full bg-[var(--crema)] px-6 font-semibold text-[var(--roast)] shadow-[0_18px_40px_-14px_rgba(233,184,114,0.8)] transition hover:bg-[var(--foam)]">Abrir Coffee Gosen <ArrowUpRight size={18} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
            <a href="#vision" className="inline-flex min-h-13 items-center rounded-full border border-[rgba(255,246,234,0.25)] px-6 font-semibold transition hover:border-[var(--foam)] hover:bg-[rgba(255,246,234,0.06)]">Conocer el sistema</a>
          </div>
        </div>

        <div className="reveal reveal-delay">
          <div className="cup-stage">
            <div className="cup-ring" aria-hidden="true" />
            <div className="cup-ring inner" aria-hidden="true" />
            <div className="cup-core overflow-hidden">
              <Image src="/Coffe.png" alt="Logo de Coffee Gosen" fill priority sizes="(max-width: 1024px) 70vw, 30vw" className="scale-[1.18] object-cover" />
            </div>
            {orbit.map(({ icon: Icon, label, className }) => (
              <span key={label} className={`orbit-chip ${className}`}><Icon size={15} className="text-[var(--crema)]" />{label}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="ticker relative z-10 overflow-hidden border-y border-[rgba(233,184,114,0.2)] bg-[rgba(0,0,0,0.25)] py-5" aria-label="Módulos del sistema">
        <div className="ticker-track">
          {[...modules, ...modules].map((module, index) => (
            <span key={`${module}-${index}`} aria-hidden={index >= modules.length} className="flex items-center gap-3 font-heading text-2xl font-semibold tracking-tight text-[rgba(255,246,234,0.78)]">
              <span className="size-1.5 rounded-full bg-[var(--crema)]" />{module}
            </span>
          ))}
        </div>
      </div>

      <section id="vision" className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <h2 className="max-w-2xl font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Todo lo que pasa en la barra, claro y a tiempo.</h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {facts.map(({ icon: Icon, value, label }) => (
            <div key={value} className="group rounded-3xl border border-[rgba(233,184,114,0.18)] bg-[linear-gradient(160deg,rgba(255,246,234,0.07),rgba(255,246,234,0.015))] p-8 transition hover:border-[rgba(233,184,114,0.5)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-[rgba(233,184,114,0.12)] text-[var(--crema)] transition group-hover:bg-[var(--crema)] group-hover:text-[var(--roast)]"><Icon size={22} /></span>
              <p className="mt-8 font-heading text-2xl font-semibold tracking-tight text-[var(--foam)]">{value}</p>
              <p className="mt-2 max-w-xs leading-7 text-[#ecd6bd]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-[rgba(233,184,114,0.15)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[#cfb49a] lg:px-10">
          <span>Coffee Gosen</span>
          <Link href="/login" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--crema)] hover:text-[var(--foam)]">Entrar al sistema <ArrowUpRight size={15} /></Link>
        </div>
      </footer>
    </main>
  );
}
