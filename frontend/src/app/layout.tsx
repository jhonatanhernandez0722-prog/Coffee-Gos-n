import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AlertSoundMonitor } from "@/components/alert-sound-monitor";

export const metadata: Metadata = {
  title: "Coffee Gosen | Gestión de ventas",
  description: "Coffee Gosen un lugar de provision fe y sabor",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body><ThemeProvider><AlertSoundMonitor />{children}</ThemeProvider></body>
    </html>
  );
}
