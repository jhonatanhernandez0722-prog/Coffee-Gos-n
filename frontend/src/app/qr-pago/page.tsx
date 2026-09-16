"use client";

import { ChangeEvent, useState } from "react";
import Image from "next/image";
import { ImagePlus, QrCode, Trash2, Upload } from "lucide-react";
import { AdminPage } from "@/components/admin-page";

const storageKey = "coffee_gosen_payment_qr";

export default function PaymentQrPage() {
  const [qrImage, setQrImage] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(storageKey) ?? "");
  const [error, setError] = useState("");

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen PNG, JPG o WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      localStorage.setItem(storageKey, result);
      setQrImage(result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function removeQr() {
    localStorage.removeItem(storageKey);
    setQrImage("");
  }

  return (
    <AdminPage title="QR de pago" description="Carga el código QR que usarán tus clientes para pagar por Nequi u otro medio digital.">
      <section className="max-w-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4 border-b border-[var(--line)] pb-6">
          <span className="grid size-12 shrink-0 place-items-center bg-[var(--blue-light)] text-[var(--blue-main)]">
            <QrCode size={26} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Código QR de cobro</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">La imagen queda disponible en este navegador para mostrarla durante el cobro.</p>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
          <div>
            <label htmlFor="payment-qr" className="inline-flex min-h-11 cursor-pointer items-center gap-2 bg-[var(--blue-main)] px-4 text-sm font-semibold text-white outline-none transition hover:bg-[var(--blue-secondary)] focus-within:ring-2 focus-within:ring-[var(--blue-main)]">
              <Upload size={17} /> {qrImage ? "Reemplazar QR" : "Cargar QR"}
            </label>
            <input id="payment-qr" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="sr-only" />
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Formatos permitidos: PNG, JPG o WEBP. Tamaño máximo: 5 MB.</p>
            {qrImage && <button type="button" onClick={removeQr} className="mt-5 inline-flex min-h-10 items-center gap-2 border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"><Trash2 size={16} /> Eliminar QR</button>}
          </div>
          <div className="grid aspect-square place-items-center border border-dashed border-[var(--line)] bg-[var(--canvas)] p-4">
            {qrImage ? <Image src={qrImage} alt="Código QR de pago" width={320} height={320} unoptimized className="size-full object-contain" /> : <div className="text-center text-[var(--muted)]"><ImagePlus className="mx-auto" size={28} /><p className="mt-3 text-sm">Aún no hay un QR cargado.</p></div>}
          </div>
        </div>
      </section>
    </AdminPage>
  );
}
