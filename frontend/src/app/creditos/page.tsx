import { CreditCard } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

export default function CreditsPage() {
  return <AdminPage title="Créditos" description="Consulta y gestiona los créditos generados automáticamente desde ventas a crédito."><div className="border border-[var(--line)] bg-white p-8"><div className="flex items-start gap-4"><CreditCard className="mt-1 text-[var(--blue-main)]" size={26} /><div><h2 className="font-semibold">No hay créditos pendientes</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Un crédito aparecerá aquí únicamente cuando confirmes una venta con método de pago Crédito y un comprador seleccionado.</p></div></div></div></AdminPage>;
}
