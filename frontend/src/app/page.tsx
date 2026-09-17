import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BarChart3, Coffee, PackageCheck, ShieldCheck } from "lucide-react";

const facts = [
  { icon: BarChart3, value: "En un vistazo", label: "Ventas, ingresos y alertas del día" },
  { icon: PackageCheck, value: "Stock claro", label: "Cada movimiento queda trazado" },
  { icon: ShieldCheck, value: "Sin sorpresas", label: "Créditos y egresos bajo control" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#5a2e1f] text-[#fff8ef]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid size-10 place-items-center bg-[#e6b566] text-[#35180d] shadow-[6px_6px_0_#35180d]"><Coffee size={20} strokeWidth={2.5} /></span><span>Coffee Gosen</span></Link>
        <Link href="/login" className="inline-flex min-h-11 items-center gap-2 border border-[#f5dcc0] px-4 text-sm font-semibold transition hover:bg-[#f5dcc0] hover:text-[#35180d]">Entrar al sistema <ArrowUpRight size={16} /></Link>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-20">
        <div className="reveal"><p className="mb-6 flex items-center gap-3 text-sm font-semibold text-[#f3c879]"><span className="h-px w-10 bg-[#f3c879]" /> Operación diaria, sin ruido</p><h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#fff8ef] sm:text-7xl">El pulso de tu café, en orden.</h1><p className="mt-4 text-base font-semibold uppercase tracking-[0.18em] text-[#f3c879]">Coffee Gosen un lugar de provision fe y sabor</p><p className="mt-8 max-w-xl text-lg leading-8 text-[#f5dcc0]">Una comanda ágil y una vista precisa de ventas, inventario, clientes y créditos para que el equipo atienda mejor.</p><div className="mt-10 flex flex-wrap gap-3"><Link href="/login" className="inline-flex min-h-12 items-center gap-2 bg-[#e6b566] px-5 font-semibold text-[#35180d] transition hover:bg-[#fff8ef]">Abrir Coffee Gosen <ArrowUpRight size={18} /></Link><a href="#vision" className="inline-flex min-h-12 items-center border border-[#d9a879] bg-transparent px-5 font-semibold text-[#fff8ef] transition hover:border-[#fff8ef]">Conocer el sistema</a></div></div>
        <div className="reveal reveal-delay relative min-h-[380px] overflow-hidden border border-[#e6b566] bg-[#35180d] shadow-[14px_14px_0_#2b150d]"><Image src="/Coffe.png" alt="Logo de Coffee Gosen" fill priority sizes="(max-width: 1024px) 100vw, 40vw" className="object-contain p-5 sm:p-8" /></div>
      </section>
      <section id="vision" className="border-t border-[#b8754e] bg-[#6a3928]"><div className="mx-auto grid max-w-7xl gap-0 px-6 lg:grid-cols-3 lg:px-10">{facts.map(({ icon: Icon, value, label }) => <div key={value} className="border-b border-[#b8754e] py-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0"><Icon className="text-[#f3c879]" size={22} /><p className="mt-5 font-semibold text-[#fff8ef]">{value}</p><p className="mt-2 max-w-xs text-sm leading-6 text-[#f5dcc0]">{label}</p></div>)}</div></section>
    </main>
  );
}
