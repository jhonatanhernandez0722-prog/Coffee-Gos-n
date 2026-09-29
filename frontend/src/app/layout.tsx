import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AlertSoundMonitor } from "@/components/alert-sound-monitor";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Coffee Gosen | Gestión de ventas",
  description: "Coffee Gosen un lugar de provision fe y sabor",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body><ThemeProvider><AlertSoundMonitor />{children}</ThemeProvider></body>
    </html>
  );
}
