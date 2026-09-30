"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Coffee, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Panel lateral de navegación para tablet y celular. */
export function NavDrawer({ items, activeHref, open, onClose }: { items: NavItem[]; activeHref: string; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Se monta en <body>: dentro de una cabecera con desenfoque, "fixed" quedaría limitado al alto de la cabecera.
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Navegación">
      <button type="button" aria-label="Cerrar menú" onClick={onClose} className="drawer-backdrop absolute inset-0 !rounded-none bg-[var(--ink)]/50 backdrop-blur-sm" />
      <aside className="drawer-panel chrome absolute inset-y-0 right-0 flex w-[min(24rem,88vw)] flex-col border-l p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-3 font-heading text-lg font-bold text-white"><span className="brand-mark size-10"><Coffee size={18} /></span>Coffee Gosen</span>
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="chrome-btn !px-2.5"><X size={18} /></button>
        </div>
        <nav className="no-scrollbar mt-8 grid flex-1 content-start gap-2 overflow-y-auto sm:grid-cols-2" aria-label="Secciones">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link key={href} href={href} onClick={onClose} aria-current={active ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-sm font-semibold transition-colors ${active ? "border-transparent bg-[var(--blue-light)] text-[var(--chrome)]" : "border-[var(--chrome-line)] bg-white/5 text-[var(--chrome-text)] hover:bg-white/10 hover:text-white"}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? "bg-[var(--blue-main)] text-white" : "bg-white/10"}`}><Icon size={17} /></span>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>,
    document.body,
  );
}
