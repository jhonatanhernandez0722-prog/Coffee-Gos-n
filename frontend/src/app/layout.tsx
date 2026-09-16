import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Coffee Gosen | Gestión de ventas",
  description: "Ventas, inventario y gestión operativa para Coffee Gosen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
